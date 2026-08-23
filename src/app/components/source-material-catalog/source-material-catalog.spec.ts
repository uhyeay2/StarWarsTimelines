import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { LibraryItem } from '../../models/library-item';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';
import { AuthService } from '../../services/auth/auth.service';
import { SourceMaterialCatalog } from './source-material-catalog';

const MATERIALS_URL = '/api/source-materials';

describe('SourceMaterialCatalog', () => {
  let component!: SourceMaterialCatalog;
  let fixture!: ComponentFixture<SourceMaterialCatalog>;
  let httpMock!: HttpTestingController;
  let catalogService!: CatalogService;
  let mockLibraryService: any;
  let mockAuthService: any;

  beforeEach(async () => {
    sessionStorage.clear();
    mockLibraryService = {
      items: signal<readonly LibraryItem[]>([]),
      addTracked: vi.fn().mockReturnValue(of(undefined)),
      removeTracked: vi.fn().mockReturnValue(of(undefined)),
      setStatus: vi.fn().mockReturnValue(of(undefined)),
      setUnitProgress: vi.fn().mockReturnValue(of(undefined)),
      clearUnitProgress: vi.fn().mockReturnValue(of(undefined)),
    };
    mockAuthService = {
      currentUser: signal<{ id: string } | null>(null),
    };
    await TestBed.configureTestingModule({
      imports: [SourceMaterialCatalog],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LibraryService, useValue: mockLibraryService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SourceMaterialCatalog);
    fixture.componentRef.setInput('isAdmin', true);
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
  function loadMaterials(
    items: { id: string; title: string; medium: number; canonType: number }[],
    unitCounts?: Record<string, number>,
  ): void {
    catalogService.invalidateEntity('source-materials');
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush(items);
    fixture.detectChanges();
    // Trigger probe and flush probe requests for each material.
    if (items.length > 0) {
      (component as any).probeUnitPresence();
      for (const item of items) {
        const count = unitCounts?.[item.id] ?? 0;
        const unitsPerGroup = 2;
        const units = Array.from({ length: count }, (_, i) => ({
          id: `probe-${item.id}-${i}`,
          sourceMaterialId: item.id,
          unitType: 0,
          groupNumber: Math.floor(i / unitsPerGroup) + 1,
          number: (i % unitsPerGroup) + 1,
          title: `Unit ${i + 1}`,
        }));
        httpMock
          .expectOne((r) => r.method === 'GET' && r.url.endsWith(`/api/source-materials/${item.id}/units`))
          .flush(units);
      }
      component.completeProbe();
    }
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
    expect(text).toContain('Movie');
    expect(text).toContain('Canon & Legends');
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
    loadMaterials([{ id: 'material-1', title: 'The Mandalorian', medium: 4, canonType: 0 }], { 'material-1': 1 });

    // The probe populated the cache. toggleUnits uses the cached data.
    component.toggleUnits('material-1');
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.expandedMaterialId()).toBe('material-1');
    expect(component.unitsByMaterial()['material-1']).toEqual([
      {
        id: 'probe-material-1-0',
        sourceMaterialId: 'material-1',
        unitType: 'Episode',
        groupNumber: 1,
        number: 1,
        title: 'Unit 1',
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('1 unit');

    component.toggleSeason('material-1', 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    vi.useRealTimers();
  });

  it('auto-collapses a material with no units and hides its expand toggle', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'material-1', title: 'Ahsoka', medium: 4, canonType: 0 }]);

    component.toggleUnits('material-1');
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.expandedMaterialId()).toBeNull();
    expect(component.materialsWithUnits().has('material-1')).toBe(false);

    const expandButton = fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton).toBeNull();
    vi.useRealTimers();
  });

  it('adds a unit to a material and reloads its units', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'material-1', title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    // Probe returns 0 units → material is not in materialsWithUnits.
    component.toggleUnits('material-1');
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();
    expect(component.expandedMaterialId()).toBeNull();

    // Manually add a unit (the expand section is hidden, but the method still works).
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

    // Service invalidates cache → loadUnits triggers a fresh fetch.
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
    expect(component.materialsWithUnits().has('material-1')).toBe(true);
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

    component.expandedMaterialId.set('material-1');
    component.unitsByMaterial.set({ 'material-1': [{ id: 'unit-1', sourceMaterialId: 'material-1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Chapter 1: The Mandalorian', parentUnitId: null }] });
    component.expandedSeasonKeys.update((s) => new Set([...s, 'material-1:1']));
    fixture.detectChanges();

    const unit = {
      id: 'unit-1',
      sourceMaterialId: 'material-1',
      unitType: 'Episode' as const,
      groupNumber: 1,
      number: 1,
      title: 'Chapter 1: The Mandalorian',
      parentUnitId: null,
    };
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

  it('groups units into seasons when a material is expanded', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 3 });

    component.toggleUnits('m-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('2 units');
    expect(fixture.nativeElement.textContent).toContain('1 unit');
    vi.useRealTimers();
  });

  it('expands and collapses individual seasons', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 3 });

    component.toggleUnits('m-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Unit 1');
    expect(fixture.nativeElement.textContent).not.toContain('Unit 3');

    component.toggleSeason('m-1', 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 2');
    expect(fixture.nativeElement.textContent).not.toContain('Unit 3');

    component.toggleSeason('m-1', 2);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unit 3');

    component.toggleSeason('m-1', 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Unit 1');
    vi.useRealTimers();
  });

  it('clears expanded season keys when collapsing a material', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 1 });

    component.toggleUnits('m-1');
    fixture.detectChanges();

    component.toggleSeason('m-1', 1);
    expect(component.isSeasonExpanded('m-1', 1)).toBe(true);

    component.toggleUnits('m-1');
    expect(component.expandedMaterialId()).toBeNull();
    expect(component.isSeasonExpanded('m-1', 1)).toBe(false);
    vi.useRealTimers();
  });

  it('shows flat layout for books with no season grouping', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'Darth Bane: Path of Destruction', medium: 1, canonType: 1 }], { 'm-1': 2 });

    component.toggleUnits('m-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 2');
    vi.useRealTimers();
  });

  it('shows flat layout for video games with no season grouping', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'Jedi: Fallen Order', medium: 5, canonType: 0 }], { 'm-1': 2 });

    component.toggleUnits('m-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 2');
    vi.useRealTimers();
  });

  it('shows volume grouping for comics', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'Darth Vader', medium: 2, canonType: 0 }], { 'm-1': 3 });

    component.toggleUnits('m-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Volume 1');
    expect(fixture.nativeElement.textContent).toContain('Volume 2');
    expect(fixture.nativeElement.textContent).not.toContain('Season 1');
    vi.useRealTimers();
  });

  it('hides expand toggle when material has no units', () => {
    loadMaterials([{ id: 'm-1', title: 'A New Hope', medium: 0, canonType: 0 }]);

    const expandButton = () => fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton()).toBeNull();
    expect(component.materialsWithUnits().has('m-1')).toBe(false);
  });

  it('keeps expand toggle visible for materials with units', () => {
    loadMaterials([{ id: 'm-1', title: 'Ahsoka', medium: 4, canonType: 0 }], { 'm-1': 1 });

    const expandButton = () => fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton()).toBeTruthy();
    expect(component.materialsWithUnits().has('m-1')).toBe(true);
  });

  it('shows expand toggle again after adding first unit to empty material', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 'm-1', title: 'Ahsoka', medium: 4, canonType: 0 }]);

    const expandButton = () => fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton()).toBeNull();

    component.newUnitType.set('Episode');
    component.newUnitGroup.set(1);
    component.newUnitNumber.set(1);
    component.newUnitTitle.set('Part 1');
    fixture.detectChanges();
    component.addUnit('m-1');

    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/units')).flush({
      id: 'u-1', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 1, title: 'Part 1',
    });
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/units')).flush([
      { id: 'u-1', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 1, title: 'Part 1' },
    ]);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(expandButton()).toBeTruthy();
    expect(component.materialsWithUnits().has('m-1')).toBe(true);
    vi.useRealTimers();
  });

  // ─── Non-admin tracking ──────────────────────────────────────────────────

    describe('tracking (non-admin)', () => {
    beforeEach(() => {
      mockAuthService.currentUser.set({ id: 'test-user' } as any);
      fixture.componentRef.setInput('isAdmin', false);
      fixture.detectChanges();
    });

    it('shows a track dropdown for non-grouped materials and calls addTracked on change', () => {
      loadMaterials([{ id: 'm-1', title: 'A New Hope', medium: 0, canonType: 2 }]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      expect(select).toBeTruthy();

      select.value = 'Completed';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(mockLibraryService.addTracked).toHaveBeenCalledWith(
        'test-user',
        { id: 'm-1', title: 'A New Hope', medium: 'Movie' },
        'Completed',
      );
    });

    it('calls removeTracked when selecting "Remove From Library" on a tracked material', () => {
      loadMaterials([{ id: 'm-1', title: 'A New Hope', medium: 0, canonType: 2 }]);
      mockLibraryService.items.set([
        { id: 'm-1', title: 'A New Hope', medium: 'Movie', status: 'Completed', favorite: false },
      ]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      const removeOption = Array.from(select.querySelectorAll('option')).find((o) =>
        o.textContent?.includes('Remove From Library'),
      );
      expect(removeOption).toBeTruthy();

      select.value = 'remove';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(mockLibraryService.removeTracked).toHaveBeenCalledWith('test-user', 'm-1');
    });

    it('displays the current tracking status on load with all statuses plus remove', () => {
      loadMaterials([{ id: 'm-1', title: 'A New Hope', medium: 0, canonType: 2 }]);
      mockLibraryService.items.set([
        { id: 'm-1', title: 'A New Hope', medium: 'Movie', status: 'Completed', favorite: false },
      ]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      expect(select.value).toBe('Completed');

      const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
      expect(values).toContain('Wish Listed');
      expect(values).toContain('In progress');
      expect(values).toContain('Completed');
      expect(values).toContain('remove');
    });

    it('shows the Track placeholder with all statuses and no remove option when untracked', () => {
      loadMaterials([{ id: 'm-1', title: 'A New Hope', medium: 0, canonType: 2 }]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      expect(select.value).toBe('');

      const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
      expect(values).toEqual(['', 'In progress', 'Completed', 'Wish Listed']);
    });

    it('calls setStatus instead of addTracked when changing an already-tracked material', () => {
      loadMaterials([{ id: 'm-1', title: 'A New Hope', medium: 0, canonType: 2 }]);
      mockLibraryService.items.set([
        { id: 'm-1', title: 'A New Hope', medium: 'Movie', status: 'Completed', favorite: false },
      ]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      select.value = 'In progress';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(mockLibraryService.setStatus).toHaveBeenCalledWith('test-user', 'm-1', 'In progress');
      expect(mockLibraryService.addTracked).not.toHaveBeenCalled();
    });

    /** Loads a single show and runs the unit probe so its units are synced. */
    async function loadShowWithUnits(units: any[]): Promise<HTMLElement> {
      vi.useFakeTimers();
      catalogService.invalidateEntity('source-materials');
      httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([
        { id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 },
      ]);
      fixture.detectChanges();

      (component as any).autoProbe();
      await vi.advanceTimersByTimeAsync(60);
      httpMock
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/m-1/units'))
        .flush(units);
      await vi.advanceTimersByTimeAsync(100);
      component.completeProbe();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('expands a season under a show to display its episodes without tracking dropdowns', async () => {
      const root = await loadShowWithUnits([
        { id: 's1', sourceMaterialId: 'm-1', unitType: 3, groupNumber: 1, number: 1, title: null },
        { id: 'e1', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 1, title: 'Cat and Mouse' },
        { id: 'e2', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 2, title: 'A Hidden Enemy' },
      ]);

      // The show is auto-expanded for non-admins without clicking the material arrow.
      expect(component.isAutoExpanded('m-1')).toBe(true);
      expect(root.textContent).toContain('Season 1');
      expect(root.querySelectorAll('.season-episodes .unit-item').length).toBe(0);

      const seasonHeader = root.querySelector('.season-header') as HTMLButtonElement;
      expect(seasonHeader).toBeTruthy();
      seasonHeader.click();
      fixture.detectChanges();

      const episodeItems = root.querySelectorAll('.season-episodes .unit-item');
      expect(episodeItems.length).toBe(2);
      expect(root.textContent).toContain('Cat and Mouse');
      expect(root.textContent).toContain('A Hidden Enemy');

      // Episodes must not have tracking dropdowns.
      expect(root.querySelectorAll('.season-episodes select').length).toBe(0);
      vi.useRealTimers();
    });

    it('shows synthesized season groups for shows with only episode group numbers', async () => {
      const root = await loadShowWithUnits([
        { id: 'e1', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 1, title: 'Cat and Mouse' },
        { id: 'e2', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 2, title: 'A Hidden Enemy' },
        { id: 'e3', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 2, number: 1, title: 'Chapter 1' },
      ]);

      expect(component.isAutoExpanded('m-1')).toBe(true);
      expect(root.textContent).toContain('Season 1');
      expect(root.textContent).toContain('Season 2');
      expect(root.querySelectorAll('.season-header').length).toBe(2);

      const headers = root.querySelectorAll('.season-header');
      (headers[0] as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(root.querySelectorAll('.season-episodes .unit-item').length).toBe(2);
      expect(root.textContent).toContain('Cat and Mouse');

      // Synthesized groups have no Season container unit, so no tracking dropdowns at all.
      expect(root.querySelectorAll('.group-track-select').length).toBe(0);
      vi.useRealTimers();
    });

    it('hides seasons when toggling an auto-expanded show closed and restores them on re-expand', async () => {
      const root = await loadShowWithUnits([
        { id: 's1', sourceMaterialId: 'm-1', unitType: 3, groupNumber: 1, number: 1, title: null },
        { id: 'e1', sourceMaterialId: 'm-1', unitType: 0, groupNumber: 1, number: 1, title: 'Cat and Mouse' },
      ]);

      const expandButton = () =>
        root.querySelector('.source-expand[type="button"]') as HTMLButtonElement;
      expect(expandButton()).toBeTruthy();
      expect(expandButton().textContent?.trim()).toBe('▾');
      expect(root.querySelector('.season-header')).toBeTruthy();

      // Toggle the show closed → seasons/volumes are hidden.
      expandButton().click();
      fixture.detectChanges();
      expect(root.querySelector('.season-header')).toBeNull();
      expect(root.querySelector('.group-track-section')).toBeNull();
      expect(expandButton().textContent?.trim()).toBe('▸');

      // Toggle open again → seasons return.
      expandButton().click();
      fixture.detectChanges();
      expect(root.querySelector('.season-header')).toBeTruthy();
      expect(expandButton().textContent?.trim()).toBe('▾');
      vi.useRealTimers();
    });

    it('auto-expands shows for non-admin viewing Season groups', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1' },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2' },
      ] });
      fixture.detectChanges();

      expect(component.isAutoExpanded('m-1')).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Season 1');
    });

    it('renders per-group track selects for Season/Volume units', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1' },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2' },
      ] });
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      expect(selects.length).toBe(2);
    });

    it('calls setStatus with unitId when selecting a season status', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1' },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2' },
      ] });
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      const firstSelect = selects[0] as HTMLSelectElement;

      firstSelect.value = 'In progress';
      firstSelect.dispatchEvent(new Event('change'));

      expect(mockLibraryService.setStatus).toHaveBeenCalledWith(
        'test-user',
        'm-1',
        'In progress',
        expect.any(String),
      );
    });

    it('creates the library entry before recording season status for an untracked show', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1' },
      ] });
      fixture.detectChanges();

      const groupSelect = fixture.nativeElement.querySelector('.group-track-select') as HTMLSelectElement;
      groupSelect.value = 'Completed';
      groupSelect.dispatchEvent(new Event('change'));

      expect(mockLibraryService.addTracked).toHaveBeenCalledTimes(1);
      expect(mockLibraryService.setStatus).toHaveBeenCalledWith(
        'test-user',
        'm-1',
        'Completed',
        expect.any(String),
      );

      // The library entry must be created before the season status is recorded.
      const addOrder = mockLibraryService.addTracked.mock.invocationCallOrder[0];
      const statusOrder = mockLibraryService.setStatus.mock.invocationCallOrder.at(-1)!;
      expect(addOrder).toBeLessThan(statusOrder);
    });

    it('shows "Remove From Library" option in group track selects', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', parentUnitId: null },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2', parentUnitId: null },
      ] });

      // Pre-track the material with Season 1 tracked
      mockLibraryService.items.set([
        { id: 'm-1', title: 'The Clone Wars', medium: 'Live Action Show', status: null, favorite: false, units: [
          { id: 's1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', status: 'In progress' },
        ] },
      ]);
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      const options = selects[0].querySelectorAll('option');
      const removeOption = Array.from(options as any).find((o: any) => o.textContent?.includes('Remove From Library'));
      expect(removeOption).toBeTruthy();
    });

    it('displays the tracked season status in group track selects', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', parentUnitId: null },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2', parentUnitId: null },
      ] });

      // Season 1 is tracked and completed; Season 2 is untracked.
      mockLibraryService.items.set([
        { id: 'm-1', title: 'The Clone Wars', medium: 'Live Action Show', status: null, favorite: false, units: [
          { id: 's1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', status: 'Completed' },
        ] },
      ]);
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      expect((selects[0] as HTMLSelectElement).value).toBe('Completed');
      expect((selects[1] as HTMLSelectElement).value).toBe('');

      const values = Array.from((selects[0] as HTMLSelectElement).querySelectorAll('option')).map(
        (o) => o.value,
      );
      expect(values).toContain('Wish Listed');
      expect(values).toContain('In progress');
      expect(values).toContain('Completed');
      expect(values).toContain('remove');
    });

    it('calls clearUnitProgress when selecting "Remove From Library" on a season', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', parentUnitId: null },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2', parentUnitId: null },
      ] });

      // Pre-track the material with Season 1 tracked
      mockLibraryService.items.set([
        { id: 'm-1', title: 'The Clone Wars', medium: 'Live Action Show', status: null, favorite: false, units: [
          { id: 's1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', status: 'In progress' },
        ] },
      ]);
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      const firstSelect = selects[0] as HTMLSelectElement;

      firstSelect.value = 'remove';
      firstSelect.dispatchEvent(new Event('change'));

      expect(mockLibraryService.clearUnitProgress).toHaveBeenCalledWith('test-user', 'm-1', 's1');
      expect(mockLibraryService.removeTracked).not.toHaveBeenCalled();
    });

    it('derives each season status independently from its own children only', () => {
      loadMaterials([{ id: 'm-1', title: 'The Clone Wars', medium: 4, canonType: 0 }], { 'm-1': 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 'm-1': [
        { id: 's1', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', parentUnitId: null },
        { id: 's2', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2', parentUnitId: null },
        { id: 's3', sourceMaterialId: 'm-1', unitType: 'Season' as const, groupNumber: 1, number: 3, title: 'Season 3', parentUnitId: null },
      ] });

      // Mirrors the reported bug scenario: Season 1 has completed episodes only,
      // Season 2 was just set to 'In progress' (tracked, nothing completed), and
      // Season 3 is untouched. Each select must reflect its own season alone.
      mockLibraryService.items.set([
        {
          id: 'm-1',
          title: 'The Clone Wars',
          medium: 'Live Action Show',
          status: null,
          favorite: false,
          units: [
            { id: 's1e1', unitType: 'Episode' as const, groupNumber: 1, number: 1, parentUnitId: 's1', status: 'Completed' },
            { id: 's1e2', unitType: 'Episode' as const, groupNumber: 1, number: 2, parentUnitId: 's1', status: 'Completed' },
            { id: 's1', unitType: 'Season' as const, groupNumber: 1, number: 1, title: 'Season 1', status: null },
            { id: 's2', unitType: 'Season' as const, groupNumber: 1, number: 2, title: 'Season 2', status: 'In progress' },
            { id: 's2e1', unitType: 'Episode' as const, groupNumber: 2, number: 1, parentUnitId: 's2', status: 'In progress' },
            { id: 's2e2', unitType: 'Episode' as const, groupNumber: 2, number: 2, parentUnitId: 's2', status: 'In progress' },
            { id: 's3', unitType: 'Season' as const, groupNumber: 1, number: 3, title: 'Season 3', status: null },
            { id: 's3e1', unitType: 'Episode' as const, groupNumber: 3, number: 1, parentUnitId: 's3', status: null },
          ],
        },
      ]);
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      expect(selects.length).toBe(3);
      expect((selects[0] as HTMLSelectElement).value).toBe('Completed');
      expect((selects[1] as HTMLSelectElement).value).toBe('In progress');
      expect((selects[2] as HTMLSelectElement).value).toBe('');
    });
  });
});
