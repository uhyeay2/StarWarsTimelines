import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { CatalogService } from '../../services/catalog/catalog.service';
import { SourceMaterialAdmin } from './source-material-admin';

const MATERIALS_URL = '/api/source-materials';

describe('SourceMaterialAdmin', () => {
  let component: SourceMaterialAdmin;
  let fixture: ComponentFixture<SourceMaterialAdmin>;
  let httpMock: HttpTestingController;
  let catalogService: CatalogService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SourceMaterialAdmin],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SourceMaterialAdmin);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    catalogService = TestBed.inject(CatalogService);
    fixture.detectChanges();

    // Flush the initial fetch triggered by the constructor.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Triggers a new fetch and flushes it with the given items. */
  function loadMaterials(items: { id: string; title: string; medium: number; canonType: number }[]): void {
    catalogService.fetchSourceMaterials();
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush(items);
    fixture.detectChanges();
  }

  it('renders an empty state', () => {
    expect(component.materials()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Source materials');
  });

  it('lists source materials with their metadata', () => {
    loadMaterials([
      { id: 'material-1', title: 'Star Wars: Episode IV - A New Hope', medium: 0, canonType: 2 },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Star Wars: Episode IV - A New Hope');
    expect(text).toContain('Movie · Canon & Legends');
  });

  it('shows a validation error for a blank title on add', () => {
    component.newTitle.set('   ');
    fixture.detectChanges();
    component.add();

    expect(component.addError()).toBe('A title is required.');
    expect(component.adding()).toBe(false);
  });

  it('creates a source material with mapped enum codes and reloads', () => {
    component.newTitle.set('Ahsoka');
    component.newMedium.set('Live Action Show');
    component.newCanonType.set('Legends');
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials'));
    expect(post.request.body).toEqual({ title: 'Ahsoka', medium: 4, canonType: 1 });
    post.flush({ id: 'material-9', title: 'Ahsoka', medium: 4, canonType: 1 });

    // Mutation auto-invalidates the cache → re-fetch fires automatically.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([
      { id: 'material-9', title: 'Ahsoka', medium: 4, canonType: 1 },
    ]);
    fixture.detectChanges();

    expect(component.newTitle()).toBe('');
    expect(component.materials()).toEqual([
      { id: 'material-9', title: 'Ahsoka', medium: 'Live Action Show', canonType: 'Legends' },
    ]);
  });

  it('surfaces a server error when adding a duplicate title', () => {
    component.newTitle.set('Ahsoka');
    fixture.detectChanges();
    component.add();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'A source material with this title already exists.' }, { status: 400, statusText: 'Bad Request' });

    expect(component.addError()).toBe('A source material with this title already exists.');
  });

  it('edits a source material and reloads', () => {
    loadMaterials([{ id: 'material-1', title: 'Old', medium: 0, canonType: 0 }]);

    const mapped: ApiSourceMaterial = { id: 'material-1', title: 'Old', medium: 'Movie', canonType: 'Canon' };
    component.beginEdit(mapped);
    component.editTitle.set('Renamed');
    component.editCanonType.set('Legends');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/source-materials/material-1'));
    expect(put.request.body).toEqual({ title: 'Renamed', medium: 0, canonType: 1 });
    put.flush({ id: 'material-1', title: 'Renamed', medium: 0, canonType: 1 });

    // Mutation auto-invalidates → re-fetch.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([
      { id: 'material-1', title: 'Renamed', medium: 0, canonType: 1 },
    ]);
    fixture.detectChanges();

    expect(component.editId()).toBeNull();
    expect(component.materials()).toEqual([
      { id: 'material-1', title: 'Renamed', medium: 'Movie', canonType: 'Legends' },
    ]);
  });

  it('surfaces the conflict message when deleting a referenced material', () => {
    loadMaterials([{ id: 'material-1', title: 'Linked', medium: 0, canonType: 0 }]);

    const mapped: ApiSourceMaterial = { id: 'material-1', title: 'Linked', medium: 'Movie', canonType: 'Canon' };
    component.requestDelete(mapped);
    component.confirmDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { detail: 'Source material is referenced by timeline events or user libraries and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.actionError()).toContain('cannot be deleted');
    expect(component.confirmDeleteId()).toBe('material-1');
  });

  it('expands a material and loads its units', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'material-1', title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    component.toggleUnits('material-1');

    const unitsRequest = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/material-1/units'),
    );
    unitsRequest.flush([
      {
        id: 'unit-1',
        sourceMaterialId: 'material-1',
        unitType: 0,
        groupNumber: 1,
        number: 1,
        title: 'Chapter 1: The Mandalorian',
      },
    ]);

    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.expandedMaterialId()).toBe('material-1');
    expect(component.unitsByMaterial()['material-1']).toEqual([
      {
        id: 'unit-1',
        sourceMaterialId: 'material-1',
        unitType: 'Episode',
        groupNumber: 1,
        number: 1,
        title: 'Chapter 1: The Mandalorian',
      },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Chapter 1: The Mandalorian');
    vi.useRealTimers();
  });

  it('collapses a material on second toggle', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'material-1', title: 'Ahsoka', medium: 4, canonType: 0 }]);

    component.toggleUnits('material-1');
    const first = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/units'));
    first.flush([]);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    component.toggleUnits('material-1');
    expect(component.expandedMaterialId()).toBeNull();
    vi.useRealTimers();
  });

  it('adds a unit to a material and reloads its units', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'material-1', title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    component.toggleUnits('material-1');
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/units')).flush([]);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    component.newUnitType.set('Episode');
    component.newUnitGroup.set(1);
    component.newUnitNumber.set(9);
    component.newUnitTitle.set('Chapter 9: The Marshal');
    fixture.detectChanges();
    component.addUnit('material-1');

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/material-1/units'),
    );
    expect(post.request.body).toEqual({ unitType: 0, groupNumber: 1, number: 9, title: 'Chapter 9: The Marshal' });
    post.flush({
      id: 'unit-9',
      sourceMaterialId: 'material-1',
      unitType: 0,
      groupNumber: 1,
      number: 9,
      title: 'Chapter 9: The Marshal',
    });

    const reloadUnits = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/units'));
    reloadUnits.flush([
      {
        id: 'unit-9',
        sourceMaterialId: 'material-1',
        unitType: 0,
        groupNumber: 1,
        number: 9,
        title: 'Chapter 9: The Marshal',
      },
    ]);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.newUnitNumber()).toBeNull();
    expect(component.unitsByMaterial()['material-1']).toHaveLength(1);
    vi.useRealTimers();
  });

  it('rejects a unit add without a valid number', () => {
    component.newUnitNumber.set(0);
    fixture.detectChanges();
    component.addUnit('material-1');

    expect(component.unitAddError()).toBe('A unit number of at least one is required.');
  });

  it('surfaces the conflict message when deleting a referenced unit', () => {
    loadMaterials([{ id: 'material-1', title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    const unit = {
      id: 'unit-1',
      sourceMaterialId: 'material-1',
      unitType: 'Episode' as const,
      groupNumber: 1,
      number: 1,
      title: 'Chapter 1: The Mandalorian',
    };
    component.unitsByMaterial.set({ 'material-1': [unit] });
    fixture.detectChanges();

    component.requestUnitDelete('material-1', unit);
    component.confirmUnitDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { detail: 'Unit is referenced by timeline events or user progress and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.actionError()).toContain('cannot be deleted');
    expect(component.unitConfirmDeleteKey()).toEqual({ materialId: 'material-1', unitId: 'unit-1' });
  });

  it('filters materials by search term', () => {
    loadMaterials([
      { id: 'm-1', title: 'Star Wars: Episode IV', medium: 0, canonType: 0 },
      { id: 'm-2', title: 'Ahsoka', medium: 4, canonType: 0 },
      { id: 'm-3', title: 'Darth Bane', medium: 1, canonType: 1 },
    ]);

    component.searchTerm.set('ahsoka');
    fixture.detectChanges();

    expect(component.filteredMaterials()).toEqual([
      { id: 'm-2', title: 'Ahsoka', medium: 'Live Action Show', canonType: 'Canon' },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Ahsoka');
    expect(fixture.nativeElement.textContent).not.toContain('Darth Bane');
  });

  it('shows a no-results message when the search matches nothing', () => {
    loadMaterials([{ id: 'm-1', title: 'Ahsoka', medium: 4, canonType: 0 }]);

    component.searchTerm.set('Nonexistent');
    fixture.detectChanges();

    expect(component.filteredMaterials()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No source materials match your search.');
  });

  it('search is case-insensitive', () => {
    loadMaterials([{ id: 'm-1', title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    component.searchTerm.set('MANDALORIAN');
    fixture.detectChanges();

    expect(component.filteredMaterials()).toEqual([
      { id: 'm-1', title: 'The Mandalorian', medium: 'Live Action Show', canonType: 'Canon' },
    ]);
  });
});
