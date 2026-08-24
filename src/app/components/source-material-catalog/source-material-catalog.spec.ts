import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
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
    items: { id: number; title: string; medium: number; canonType: number }[],
    unitCounts?: Record<number, number>,
    unitsByItem?: Record<number, readonly Record<string, unknown>[]>,
  ): void {
    catalogService.invalidateEntity('source-materials');
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush(items);
    fixture.detectChanges();
    // Trigger probe and flush probe requests for each material.
    if (items.length > 0) {
      (component as any).probeUnitPresence();
      for (const item of items) {
        const custom = unitsByItem?.[item.id];
        const units =
          custom ??
          Array.from({ length: unitCounts?.[item.id] ?? 0 }, (_, i) => ({
            id: item.id * 100 + i + 1,
            sourceMaterialId: item.id,
            unitType: 0,
            parentUnitId: null,
            number: i + 1,
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
      { id: 11, title: 'Star Wars: Episode IV - A New Hope', medium: 0, canonType: 2 },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Star Wars: Episode IV - A New Hope');
    expect(text).toContain('Movie');
    expect(text).toContain('Canon & Legends');
  });

  it('shows a validation error for a blank title on add', () => {
    component.openAddMaterial('Movie');
    component.newTitle.set('   ');
    fixture.detectChanges();
    component.submitAddMaterial();

    expect(component.addError()).toBe('A title is required.');
    expect(component.adding()).toBe(false);
  });

  it('creates a source material from the medium popup with mapped enum codes and reloads', () => {
    component.openAddMaterial('Live Action Show');
    component.newTitle.set('Ahsoka');
    component.newCanonType.set('Legends');
    fixture.detectChanges();
    component.submitAddMaterial();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials'));
    expect(post.request.body).toEqual({ title: 'Ahsoka', medium: 4, canonType: 1 });
    post.flush({ id: 19, title: 'Ahsoka', medium: 4, canonType: 1 });

    // Mutation auto-invalidates the cache → re-fetch fires automatically.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([
      { id: 19, title: 'Ahsoka', medium: 4, canonType: 1 },
    ]);
    fixture.detectChanges();

    expect(component.newTitle()).toBe('');
    expect(component.addMaterialMedium()).toBeNull();
    expect(component.materials()).toEqual([
      { id: 19, title: 'Ahsoka', medium: 'Live Action Show', canonType: 'Legends' },
    ]);
  });

  it('surfaces a server error when adding a duplicate title', () => {
    component.openAddMaterial('Movie');
    component.newTitle.set('Ahsoka');
    fixture.detectChanges();
    component.submitAddMaterial();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'A source material with this title already exists.' }, { status: 400, statusText: 'Bad Request' });

    expect(component.addError()).toBe('A source material with this title already exists.');
  });

  it('edits a source material and reloads', () => {
    loadMaterials([{ id: 11, title: 'Old', medium: 0, canonType: 0 }]);

    const mapped: ApiSourceMaterial = { id: 11, title: 'Old', medium: 'Movie', canonType: 'Canon' };
    component.beginEdit(mapped);
    component.editTitle.set('Renamed');
    component.editCanonType.set('Legends');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/source-materials/11'));
    expect(put.request.body).toEqual({ title: 'Renamed', medium: 0, canonType: 1 });
    put.flush({ id: 11, title: 'Renamed', medium: 0, canonType: 1 });

    // Mutation auto-invalidates → re-fetch.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([
      { id: 11, title: 'Renamed', medium: 0, canonType: 1 },
    ]);
    fixture.detectChanges();

    expect(component.editId()).toBeNull();
    expect(component.materials()).toEqual([
      { id: 11, title: 'Renamed', medium: 'Movie', canonType: 'Legends' },
    ]);
  });

  it('surfaces the conflict message when deleting a referenced material', () => {
    loadMaterials([{ id: 11, title: 'Linked', medium: 0, canonType: 0 }]);

    const mapped: ApiSourceMaterial = { id: 11, title: 'Linked', medium: 'Movie', canonType: 'Canon' };
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
    expect(component.confirmDeleteId()).toBe(11);
  });

  it('expands a material and loads its units', async () => {
    vi.useFakeTimers();
    loadMaterials(
      [{ id: 11, title: 'The Mandalorian', medium: 4, canonType: 0 }],
      undefined,
      {
        11: [
          { id: 101, sourceMaterialId: 11, unitType: 3, parentUnitId: null, number: 1, title: null },
          { id: 201, sourceMaterialId: 11, unitType: 0, parentUnitId: 101, number: 1, title: 'Cat and Mouse' },
        ],
      },
    );

    // The probe populated the cache. toggleUnits uses the cached data.
    component.toggleUnits(11);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.expandedMaterialId()).toBe(11);
    expect(component.unitsByMaterial()[11]).toEqual([
      {
        id: 101,
        sourceMaterialId: 11,
        unitType: 'Season',
        parentUnitId: null,
        number: 1,
        title: null,
      },
      {
        id: 201,
        sourceMaterialId: 11,
        unitType: 'Episode',
        parentUnitId: 101,
        number: 1,
        title: 'Cat and Mouse',
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('1 unit');

    component.toggleSeason(11, 101);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cat and Mouse');
    vi.useRealTimers();
  });

  it('auto-collapses a material with no units and hides its expand toggle', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 11, title: 'Ahsoka', medium: 4, canonType: 0 }]);

    component.toggleUnits(11);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.expandedMaterialId()).toBeNull();
    expect(component.materialsWithUnits().has(11)).toBe(false);

    const expandButton = fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton).toBeNull();
    vi.useRealTimers();
  });

  it('adds a unit to a material through the add-unit popup and reloads its units', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 21, title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    // Probe returns 0 units → material is not in materialsWithUnits.
    component.toggleUnits(21);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();
    expect(component.expandedMaterialId()).toBeNull();

    // Manually add a unit (the expand section is hidden, but the method still works).
    component.openAddUnitPopup({ materialId: 21, parentUnitId: null, childType: 'Episode' });
    component.popupNumber.set(9);
    component.popupTitle.set('Chapter 9: The Marshal');
    fixture.detectChanges();
    component.submitAddUnit();

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/21/units'),
    );
    expect(post.request.body).toEqual({ unitType: 0, parentUnitId: null, number: 9, title: 'Chapter 9: The Marshal' });
    post.flush({
      id: 209,
      sourceMaterialId: 21,
      unitType: 0,
      parentUnitId: null,
      number: 9,
      title: 'Chapter 9: The Marshal',
    });

    // Service invalidates cache → loadUnits triggers a fresh fetch.
    const reloadUnits = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/units'));
    reloadUnits.flush([
      {
        id: 209,
        sourceMaterialId: 21,
        unitType: 0,
        parentUnitId: null,
        number: 9,
        title: 'Chapter 9: The Marshal',
      },
    ]);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(component.unitPopupContext()).toBeNull();
    expect(component.unitsByMaterial()[21]).toHaveLength(1);
    expect(component.materialsWithUnits().has(21)).toBe(true);
    vi.useRealTimers();
  });

  it('rejects a unit add without a valid number', () => {
    component.openAddUnitPopup({ materialId: 21, parentUnitId: null, childType: 'Episode' });
    component.popupNumber.set(0);
    fixture.detectChanges();
    component.submitAddUnit();

    expect(component.unitAddError()).toBe('A unit number of at least one is required.');
  });

  it('surfaces the conflict message when deleting a referenced unit', () => {
    loadMaterials([{ id: 11, title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    const unit: ApiSourceMaterialUnit = {
      id: 201,
      sourceMaterialId: 11,
      unitType: 'Episode',
      parentUnitId: null,
      number: 1,
      title: 'Chapter 1: The Mandalorian',
    };
    component.expandedMaterialId.set(11);
    component.unitsByMaterial.set({ 11: [unit] });
    component.expandedSeasonKeys.update((s) => new Set([...s, '11:201']));
    fixture.detectChanges();

    component.requestUnitDelete(11, unit);
    component.confirmUnitDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { detail: 'Unit is referenced by timeline events or user progress and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.actionError()).toContain('cannot be deleted');
    expect(component.unitConfirmDeleteKey()).toEqual({ materialId: 11, unitId: 201 });
  });

  it('filters materials by search term', () => {
    loadMaterials([
      { id: 21, title: 'Star Wars: Episode IV', medium: 0, canonType: 0 },
      { id: 22, title: 'Ahsoka', medium: 4, canonType: 0 },
      { id: 23, title: 'Darth Bane', medium: 1, canonType: 1 },
    ]);

    component.searchTerm.set('ahsoka');
    fixture.detectChanges();

    expect(component.filteredMaterials()).toEqual([
      { id: 22, title: 'Ahsoka', medium: 'Live Action Show', canonType: 'Canon' },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Ahsoka');
    expect(fixture.nativeElement.textContent).not.toContain('Darth Bane');
  });

  it('shows a no-results message when the search matches nothing', () => {
    loadMaterials([{ id: 21, title: 'Ahsoka', medium: 4, canonType: 0 }]);

    component.searchTerm.set('Nonexistent');
    fixture.detectChanges();

    expect(component.filteredMaterials()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No source materials match your search.');
  });

  it('search is case-insensitive', () => {
    loadMaterials([{ id: 21, title: 'The Mandalorian', medium: 4, canonType: 0 }]);

    component.searchTerm.set('MANDALORIAN');
    fixture.detectChanges();

    expect(component.filteredMaterials()).toEqual([
      { id: 21, title: 'The Mandalorian', medium: 'Live Action Show', canonType: 'Canon' },
    ]);
  });

  /** Two seasons: Season 1 with two episodes, Season 2 with one. */
  function cloneWarsUnits(): Record<number, readonly Record<string, unknown>[]> {
    return {
      21: [
        { id: 101, sourceMaterialId: 21, unitType: 3, parentUnitId: null, number: 1, title: null },
        { id: 102, sourceMaterialId: 21, unitType: 3, parentUnitId: null, number: 2, title: null },
        { id: 201, sourceMaterialId: 21, unitType: 0, parentUnitId: 101, number: 1, title: 'Unit 1' },
        { id: 202, sourceMaterialId: 21, unitType: 0, parentUnitId: 101, number: 2, title: 'Unit 2' },
        { id: 203, sourceMaterialId: 21, unitType: 0, parentUnitId: 102, number: 1, title: 'Unit 3' },
      ],
    };
  }

  it('groups units into seasons when a material is expanded', async () => {
    vi.useFakeTimers();
    loadMaterials(
      [{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }],
      undefined,
      cloneWarsUnits(),
    );

    component.toggleUnits(21);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('Season 2');
    expect(fixture.nativeElement.textContent).toContain('2 units');
    expect(fixture.nativeElement.textContent).toContain('1 unit');
    vi.useRealTimers();
  });

  it('expands and collapses individual seasons', async () => {
    vi.useFakeTimers();
    loadMaterials(
      [{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }],
      undefined,
      cloneWarsUnits(),
    );

    component.toggleUnits(21);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Unit 1');
    expect(fixture.nativeElement.textContent).not.toContain('Unit 3');

    component.toggleSeason(21, 101);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 2');
    expect(fixture.nativeElement.textContent).not.toContain('Unit 3');

    component.toggleSeason(21, 102);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unit 3');

    component.toggleSeason(21, 101);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Unit 1');
    vi.useRealTimers();
  });

  it('clears expanded season keys when collapsing a material', async () => {
    vi.useFakeTimers();
    loadMaterials(
      [{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }],
      undefined,
      cloneWarsUnits(),
    );

    component.toggleUnits(21);
    fixture.detectChanges();

    component.toggleSeason(21, 101);
    expect(component.isSeasonExpanded(21, 101)).toBe(true);

    component.toggleUnits(21);
    expect(component.expandedMaterialId()).toBeNull();
    expect(component.isSeasonExpanded(21, 101)).toBe(false);
    vi.useRealTimers();
  });

  it('shows flat layout for books with no season grouping', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 21, title: 'Darth Bane: Path of Destruction', medium: 1, canonType: 1 }], { 21: 2 });

    component.toggleUnits(21);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 2');
    vi.useRealTimers();
  });

  it('shows flat layout for video games with no season grouping', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 21, title: 'Jedi: Fallen Order', medium: 5, canonType: 0 }], { 21: 2 });

    component.toggleUnits(21);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Season 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 1');
    expect(fixture.nativeElement.textContent).toContain('Unit 2');
    vi.useRealTimers();
  });

  it('shows volume grouping for comics', async () => {
    vi.useFakeTimers();
    loadMaterials(
      [{ id: 21, title: 'Darth Vader', medium: 2, canonType: 0 }],
      undefined,
      {
        21: [
          { id: 301, sourceMaterialId: 21, unitType: 4, parentUnitId: null, number: 1, title: null },
          { id: 302, sourceMaterialId: 21, unitType: 4, parentUnitId: null, number: 2, title: null },
          { id: 401, sourceMaterialId: 21, unitType: 2, parentUnitId: 301, number: 1, title: 'Unit 1' },
          { id: 402, sourceMaterialId: 21, unitType: 2, parentUnitId: 301, number: 2, title: 'Unit 2' },
          { id: 403, sourceMaterialId: 21, unitType: 2, parentUnitId: 302, number: 1, title: 'Unit 3' },
        ],
      },
    );

    component.toggleUnits(21);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Volume 1');
    expect(fixture.nativeElement.textContent).toContain('Volume 2');
    expect(fixture.nativeElement.textContent).not.toContain('Season 1');
    vi.useRealTimers();
  });

  it('hides expand toggle when material has no units', () => {
    loadMaterials([{ id: 21, title: 'A New Hope', medium: 0, canonType: 0 }]);

    const expandButton = () => fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton()).toBeNull();
    expect(component.materialsWithUnits().has(21)).toBe(false);
  });

  it('keeps expand toggle visible for materials with units', () => {
    loadMaterials([{ id: 21, title: 'Ahsoka', medium: 4, canonType: 0 }], { 21: 1 });

    const expandButton = () => fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton()).toBeTruthy();
    expect(component.materialsWithUnits().has(21)).toBe(true);
  });

  it('shows expand toggle again after adding first unit to empty material', async () => {
    vi.useFakeTimers();
    loadMaterials([{ id: 21, title: 'Ahsoka', medium: 4, canonType: 0 }]);

    const expandButton = () => fixture.nativeElement.querySelector('.source-expand[type="button"]');
    expect(expandButton()).toBeNull();

    component.openAddUnitPopup({ materialId: 21, parentUnitId: null, childType: 'Episode' });
    component.popupNumber.set(1);
    component.popupTitle.set('Part 1');
    fixture.detectChanges();
    component.submitAddUnit();

    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/units')).flush({
      id: 211, sourceMaterialId: 21, unitType: 0, parentUnitId: null, number: 1, title: 'Part 1',
    });
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/units')).flush([
      { id: 211, sourceMaterialId: 21, unitType: 0, parentUnitId: null, number: 1, title: 'Part 1' },
    ]);
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    expect(expandButton()).toBeTruthy();
    expect(component.materialsWithUnits().has(21)).toBe(true);
    vi.useRealTimers();
  });

  // ─── Admin add & convert UX ───────────────────────────────────────────────

  describe('admin add & convert UX', () => {
    /** Returns the loaded material with the given id, failing loudly when absent. */
    function findMaterial(id: number): ApiSourceMaterial {
      const found = component.materials().find((m) => m.id === id);
      if (!found) {
        throw new Error(`Material ${id} was not loaded.`);
      }
      return found;
    }

    /** Returns the rendered material row containing the given title. */
    function rowFor(title: string): HTMLElement {
      const rows = fixture.nativeElement.querySelectorAll('.source-item') as NodeListOf<HTMLElement>;
      const row = Array.from(rows).find((li) => li.textContent?.includes(title));
      if (!row) {
        throw new Error(`No material row rendered for "${title}".`);
      }
      return row;
    }

    /** The material-row Add button of a row, if present. */
    function materialAddButton(row: HTMLElement): HTMLButtonElement | null {
      return row.querySelector('button[title="Add a unit to this source material"]');
    }

    /** Marks a material as having units and seeds its known unit list. */
    function seedUnits(id: number, units: ApiSourceMaterialUnit[]): void {
      component.materialsWithUnits.update((set) => new Set(set).add(id));
      component.unitsByMaterial.set({ ...component.unitsByMaterial(), [id]: units });
      fixture.detectChanges();
    }

    it('renders an add button on every medium header, including movies', () => {
      loadMaterials([
        { id: 11, title: 'A New Hope', medium: 0, canonType: 0 },
        { id: 12, title: 'Darth Bane', medium: 1, canonType: 0 },
        { id: 13, title: 'The Mandalorian', medium: 4, canonType: 0 },
      ]);

      const headerButtons = fixture.nativeElement.querySelectorAll('.medium-add-button');
      expect(headerButtons.length).toBe(3);

      // The movie group is the first rendered; its header Add opens the dialog.
      (headerButtons[0] as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component.addMaterialMedium()).toBe('Movie');
      const dialog = fixture.nativeElement.querySelector('app-material-add-dialog .admin-popup');
      expect(dialog).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-material-add-dialog h3')?.textContent?.trim()).toBe(
        'Add Movie',
      );

      component.cancelAddMaterial();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-material-add-dialog')).toBeNull();
    });

    it('routes the material-row Add by medium and omits it for movies', () => {
      loadMaterials([
        { id: 31, title: 'Show', medium: 4, canonType: 0 },
        { id: 32, title: 'Game', medium: 5, canonType: 0 },
        { id: 33, title: 'Comic', medium: 2, canonType: 0 },
        { id: 34, title: 'Film', medium: 0, canonType: 0 },
      ]);

      component.onMaterialAddClick('Live Action Show', findMaterial(31));
      expect(component.unitPopupContext()).toEqual({
        materialId: 31,
        parentUnitId: null,
        childType: 'Season',
      });
      component.cancelAddUnit();

      component.onMaterialAddClick('Video Game', findMaterial(32));
      expect(component.unitPopupContext()!.childType).toBe('Level');
      component.cancelAddUnit();

      component.onMaterialAddClick('Comic', findMaterial(33));
      expect(component.unitPopupContext()!.childType).toBe('Volume');
      component.cancelAddUnit();

      // Movies have no units to add: no button on the row (its medium header
      // still offers creating a new movie source material).
      expect(materialAddButton(rowFor('Film'))).toBeNull();
    });

    it('opens the book choice dialog for a book without units and routes both options', () => {
      loadMaterials([{ id: 41, title: 'Empty novel', medium: 1, canonType: 0 }]);

      component.onMaterialAddClick('Book', findMaterial(41));
      fixture.detectChanges();

      expect(component.bookChoiceMaterialId()).toBe(41);
      expect(
        fixture.nativeElement.querySelector('app-book-choice-dialog .admin-popup'),
      ).toBeTruthy();

      component.chooseBookChapter(41);
      fixture.detectChanges();
      expect(component.bookChoiceMaterialId()).toBeNull();
      expect(component.unitPopupContext()).toEqual({
        materialId: 41,
        parentUnitId: null,
        childType: 'Chapter',
      });
      component.cancelAddUnit();

      // Choosing "Start collection" opens the multi-book creation popup with
      // the collection name prefilled from the material title.
      component.onMaterialAddClick('Book', findMaterial(41));
      component.requestStartCollection(41);
      fixture.detectChanges();

      expect(component.bookChoiceMaterialId()).toBeNull();
      expect(component.startCollectionMaterialId()).toBe(41);
      expect(component.startCollectionName()).toBe('Empty novel');
      expect(
        fixture.nativeElement.querySelector('app-start-collection-dialog .admin-popup'),
      ).toBeTruthy();

      component.cancelStartCollection();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-start-collection-dialog')).toBeNull();
    });

    it('infers chapter adds with the next free number for standalone books', () => {
      loadMaterials([{ id: 42, title: 'Novel', medium: 1, canonType: 0 }]);
      seedUnits(42, [
        { id: 501, sourceMaterialId: 42, unitType: 'Chapter', parentUnitId: null, number: 1, title: null },
        { id: 502, sourceMaterialId: 42, unitType: 'Chapter', parentUnitId: null, number: 2, title: null },
      ]);

      component.onMaterialAddClick('Book', findMaterial(42));

      expect(component.unitPopupContext()).toEqual({
        materialId: 42,
        parentUnitId: null,
        childType: 'Chapter',
      });
      expect(component.popupNumber()).toBe(3);
      component.cancelAddUnit();
    });

    it('infers book adds for collections and nests chapter adds beneath containers', () => {
      loadMaterials([{ id: 21, title: 'Trilogy', medium: 1, canonType: 0 }]);
      seedUnits(21, [
        { id: 601, sourceMaterialId: 21, unitType: 'Book', parentUnitId: null, number: 1, title: 'Book One' },
        { id: 602, sourceMaterialId: 21, unitType: 'Chapter', parentUnitId: 601, number: 1, title: null },
        { id: 603, sourceMaterialId: 21, unitType: 'Chapter', parentUnitId: 601, number: 2, title: null },
      ]);

      // A collection offers another Book at the top level.
      component.onMaterialAddClick('Book', findMaterial(21));
      expect(component.unitPopupContext()).toEqual({
        materialId: 21,
        parentUnitId: null,
        childType: 'Book',
      });
      expect(component.popupNumber()).toBe(2);
      component.cancelAddUnit();

      // Expanding reveals per-container Add buttons prefilling nested chapters.
      component.expandedMaterialId.set(21);
      fixture.detectChanges();

      const containerButton = fixture.nativeElement.querySelector(
        '.container-add-button',
      ) as HTMLButtonElement;
      expect(containerButton).toBeTruthy();
      containerButton.click();
      fixture.detectChanges();

      const context = component.unitPopupContext();
      expect(context).toEqual({ materialId: 21, parentUnitId: 601, childType: 'Chapter' });
      expect(component.popupNumber()).toBe(3);
      expect(component.unitPopupHeading(context!)).toBe('Add chapter to Book One');
    });

    it('shows convert only for standalone books with chapters and posts the conversion', async () => {
      vi.useFakeTimers();
      loadMaterials([{ id: 43, title: 'Standalone', medium: 1, canonType: 0 }]);
      seedUnits(43, [
        { id: 701, sourceMaterialId: 43, unitType: 'Chapter', parentUnitId: null, number: 1, title: null },
        { id: 702, sourceMaterialId: 43, unitType: 'Chapter', parentUnitId: null, number: 2, title: null },
      ]);
      const material = findMaterial(43);
      expect(component.isConvertibleStandaloneBook(material)).toBe(true);

      const convertButton = Array.from(rowFor('Standalone').querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Convert to Collection'),
      ) as HTMLButtonElement | undefined;
      expect(convertButton).toBeTruthy();

      convertButton!.click();
      fixture.detectChanges();
      expect(component.convertPopupMaterialId()).toBe(43);
      // The dialog prefills the collection title with the current material title.
      expect(component.convertTitle()).toBe('Standalone');
      expect(
        fixture.nativeElement.querySelector('app-convert-collection-dialog'),
      ).toBeTruthy();

      component.convertTitle.set('Thrawn Trilogy');
      component.submitConvert();

      const post = httpMock.expectOne(
        (r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/43/convert-to-collection'),
      );
      expect(post.request.body).toEqual({ collectionTitle: 'Thrawn Trilogy' });
      post.flush([]);

      // Cache invalidations fire refetches; flush each explicitly.
      const unitsReq = httpMock.expectOne((r) => r.url.endsWith('/units'));
      const materialsReq = httpMock.expectOne((r) => r.url.endsWith('/api/source-materials'));
      unitsReq.flush([
        { id: 801, sourceMaterialId: 43, unitType: 7, number: 1, title: 'Standalone', parentUnitId: null },
        { id: 701, sourceMaterialId: 43, unitType: 1, parentUnitId: 801, number: 1, title: null },
      ]);
      materialsReq.flush([{ id: 43, title: 'Thrawn Trilogy', medium: 1, canonType: 0 }]);
      await vi.advanceTimersByTimeAsync(100);
      fixture.detectChanges();

      expect(component.convertPopupMaterialId()).toBeNull();
      expect(component.unitsByMaterial()[43].length).toBe(2);
      // The converted shape is no longer convertible.
      expect(component.isConvertibleStandaloneBook(findMaterial(43))).toBe(false);
      vi.useRealTimers();
    });

    it('hides convert for collections and empty books', () => {
      loadMaterials([{ id: 44, title: 'Collection', medium: 1, canonType: 0 }]);
      seedUnits(44, [
        { id: 901, sourceMaterialId: 44, unitType: 'Book', parentUnitId: null, number: 1, title: 'Book One' },
        { id: 902, sourceMaterialId: 44, unitType: 'Chapter', parentUnitId: 901, number: 1, title: null },
      ]);
      expect(component.isConvertibleStandaloneBook(findMaterial(44))).toBe(false);
      expect(rowFor('Collection').textContent).not.toContain('Convert to Collection');

      loadMaterials([{ id: 45, title: 'Empty book', medium: 1, canonType: 0 }]);
      expect(component.isConvertibleStandaloneBook(findMaterial(45))).toBe(false);
      expect(rowFor('Empty book').textContent).not.toContain('Convert to Collection');
    });
    it('labels the material title "Book Title or Collection Name" only when creating a book', () => {
      loadMaterials([
        { id: 21, title: 'Trilogy', medium: 1, canonType: 0 },
        { id: 22, title: 'Show', medium: 4, canonType: 0 },
      ]);

      // Creating a NEW Book source material: ambiguous → custom label.
      component.openAddMaterial('Book');
      fixture.detectChanges();
      const materialLabels = fixture.nativeElement.querySelectorAll(
        'app-material-add-dialog .source-field > span',
      ) as NodeListOf<HTMLElement>;
      expect(materialLabels[0].textContent?.trim()).toBe('Book Title or Collection Name');
      component.cancelAddMaterial();

      // Other media keep the plain Title label.
      component.openAddMaterial('Live Action Show');
      fixture.detectChanges();
      const showLabels = fixture.nativeElement.querySelectorAll(
        'app-material-add-dialog .source-field > span',
      ) as NodeListOf<HTMLElement>;
      expect(showLabels[0].textContent?.trim()).toBe('Title');
      component.cancelAddMaterial();

      // Adding a unit INSIDE an existing collection: unambiguous → plain Title.
      seedUnits(21, [
        { id: 601, sourceMaterialId: 21, unitType: 'Book', parentUnitId: null, number: 1, title: 'Book One' },
        { id: 602, sourceMaterialId: 21, unitType: 'Chapter', parentUnitId: 601, number: 1, title: null },
      ]);
      component.onMaterialAddClick('Book', findMaterial(21));
      fixture.detectChanges();
      const unitLabels = fixture.nativeElement.querySelectorAll(
        'app-unit-add-dialog .source-field > span',
      ) as NodeListOf<HTMLElement>;
      const labelTexts = Array.from(unitLabels).map((span) => span.textContent?.trim());
      expect(labelTexts).toContain('Title');
      expect(labelTexts).not.toContain('Book Title or Collection Name');
      component.cancelAddUnit();
    });

    it('renames the material and creates numbered books when starting a collection', async () => {
      vi.useFakeTimers();
      loadMaterials([{ id: 41, title: 'Empty novel', medium: 1, canonType: 0 }]);
      component.requestStartCollection(41);
      component.startCollectionName.set('Thrawn Trilogy');

      component.submitStartCollection({
        collectionName: 'Thrawn Trilogy',
        bookTitles: ['Thrawn', 'Dark Force Rising', 'The Last Command'],
      });
      expect(component.startingCollectionFor()).toBe(41);

      // The rename fires first since the collection name differs.
      const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/source-materials/41'));
      expect(put.request.body).toEqual({ title: 'Thrawn Trilogy', medium: 1, canonType: 0 });
      put.flush({ id: 41, title: 'Thrawn Trilogy', medium: 1, canonType: 0 });
      // Updating the material auto-invalidates the materials cache.
      httpMock
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'))
        .flush([{ id: 41, title: 'Thrawn Trilogy', medium: 1, canonType: 0 }]);

      // Books are created sequentially with numbers assigned by list position.
      const expectedBooks = [
        { number: 1, title: 'Thrawn' },
        { number: 2, title: 'Dark Force Rising' },
        { number: 3, title: 'The Last Command' },
      ];
      for (const expected of expectedBooks) {
        const post = httpMock.expectOne(
          (r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/41/units'),
        );
        expect(post.request.body).toEqual({
          unitType: 7,
          parentUnitId: null,
          number: expected.number,
          title: expected.title,
        });
        post.flush({
          id: 900 + expected.number,
          sourceMaterialId: 41,
          unitType: 7,
          parentUnitId: null,
          number: expected.number,
          title: expected.title,
        });
      }

      // Success closes the popup and reloads the material's units.
      httpMock
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/41/units'))
        .flush(expectedBooks.map((book) => ({ id: 0, sourceMaterialId: 41, unitType: 7, parentUnitId: null, ...book })));
      await vi.advanceTimersByTimeAsync(100);
      fixture.detectChanges();

      expect(component.startingCollectionFor()).toBeNull();
      expect(component.startCollectionMaterialId()).toBeNull();
      expect(component.unitsByMaterial()[41].length).toBe(3);
      vi.useRealTimers();
    });

    it('skips the rename when the collection keeps the material title', () => {
      vi.useFakeTimers();
      loadMaterials([{ id: 45, title: 'Empty novel', medium: 1, canonType: 0 }]);
      component.requestStartCollection(45);
      // Collection name stays as the material title.

      component.submitStartCollection({ collectionName: 'Empty novel', bookTitles: ['Only Book'] });

      const post = httpMock.expectOne(
        (r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/45/units'),
      );
      expect(post.request.body).toEqual({ unitType: 7, parentUnitId: null, number: 1, title: 'Only Book' });
      post.flush({ id: 950, sourceMaterialId: 45, unitType: 7, parentUnitId: null, number: 1, title: 'Only Book' });
      httpMock
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/45/units'))
        .flush([{ id: 950, sourceMaterialId: 45, unitType: 7, parentUnitId: null, number: 1, title: 'Only Book' }]);
      vi.advanceTimersByTime(100);

      expect(component.startCollectionMaterialId()).toBeNull();
      expect(httpMock.match((r) => r.method === 'PUT').length).toBe(0);
      vi.useRealTimers();
    });

    it('validates the collection name and book titles before any request', () => {
      loadMaterials([{ id: 46, title: 'Empty novel', medium: 1, canonType: 0 }]);
      component.requestStartCollection(46);

      component.submitStartCollection({ collectionName: '   ', bookTitles: ['Book'] });
      expect(component.actionError()).toBe('A collection name is required.');

      component.submitStartCollection({ collectionName: 'Saga', bookTitles: ['Book', '   '] });
      expect(component.actionError()).toBe('Every book needs a title.');

      component.submitStartCollection({ collectionName: 'Saga', bookTitles: [] });
      expect(component.actionError()).toBe('Every book needs a title.');
      expect(component.startingCollectionFor()).toBeNull();

      // No requests were made while validating.
      fixture.detectChanges();
      expect(component.materials().length).toBe(1);
    });
  });

  // ─── Non-admin tracking ──────────────────────────────────────────────────

  describe('tracking (non-admin)', () => {
    beforeEach(() => {
      mockAuthService.currentUser.set({ id: 'test-user' } as any);
      fixture.componentRef.setInput('isAdmin', false);
      fixture.detectChanges();
    });

    it('shows a track dropdown for non-grouped materials and calls addTracked on change', () => {
      loadMaterials([{ id: 21, title: 'A New Hope', medium: 0, canonType: 2 }]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      expect(select).toBeTruthy();

      select.value = 'Completed';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(mockLibraryService.addTracked).toHaveBeenCalledWith(
        'test-user',
        { id: 21, title: 'A New Hope', medium: 'Movie' },
        'Completed',
      );
    });

    it('calls removeTracked when selecting "Remove From Library" on a tracked material', () => {
      loadMaterials([{ id: 21, title: 'A New Hope', medium: 0, canonType: 2 }]);
      mockLibraryService.items.set([
        { id: 21, title: 'A New Hope', medium: 'Movie', status: 'Completed', favorite: false },
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

      expect(mockLibraryService.removeTracked).toHaveBeenCalledWith('test-user', 21);
    });

    it('displays the current tracking status on load with all statuses plus remove', () => {
      loadMaterials([{ id: 21, title: 'A New Hope', medium: 0, canonType: 2 }]);
      mockLibraryService.items.set([
        { id: 21, title: 'A New Hope', medium: 'Movie', status: 'Completed', favorite: false },
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
      loadMaterials([{ id: 21, title: 'A New Hope', medium: 0, canonType: 2 }]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      expect(select.value).toBe('');

      const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
      expect(values).toEqual(['', 'In progress', 'Completed', 'Wish Listed']);
    });

    it('calls setStatus instead of addTracked when changing an already-tracked material', () => {
      loadMaterials([{ id: 21, title: 'A New Hope', medium: 0, canonType: 2 }]);
      mockLibraryService.items.set([
        { id: 21, title: 'A New Hope', medium: 'Movie', status: 'Completed', favorite: false },
      ]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('.track-select') as HTMLSelectElement;
      select.value = 'In progress';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(mockLibraryService.setStatus).toHaveBeenCalledWith('test-user', 21, 'In progress');
      expect(mockLibraryService.addTracked).not.toHaveBeenCalled();
    });

    /** Loads a single show and runs the unit probe so its units are synced. */
    async function loadShowWithUnits(units: any[]): Promise<HTMLElement> {
      vi.useFakeTimers();
      catalogService.invalidateEntity('source-materials');
      httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(MATERIALS_URL)).flush([
        { id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 },
      ]);
      fixture.detectChanges();

      (component as any).autoProbe();
      await vi.advanceTimersByTimeAsync(60);
      httpMock
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/21/units'))
        .flush(units);
      await vi.advanceTimersByTimeAsync(100);
      component.completeProbe();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('expands a season under a show to display its episodes without tracking dropdowns', async () => {
      const root = await loadShowWithUnits([
        { id: 101, sourceMaterialId: 21, unitType: 3, parentUnitId: null, number: 1, title: null },
        { id: 201, sourceMaterialId: 21, unitType: 0, parentUnitId: 101, number: 1, title: 'Cat and Mouse' },
        { id: 202, sourceMaterialId: 21, unitType: 0, parentUnitId: 101, number: 2, title: 'A Hidden Enemy' },
      ]);

      // The show is auto-expanded for non-admins without clicking the material arrow.
      expect(component.isAutoExpanded(21)).toBe(true);
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

    it('collects episodes with dangling parents into an ungrouped group without a track select', async () => {
      const root = await loadShowWithUnits([
        { id: 101, sourceMaterialId: 21, unitType: 3, parentUnitId: null, number: 1, title: null },
        { id: 201, sourceMaterialId: 21, unitType: 0, parentUnitId: 999, number: 1, title: 'Cat and Mouse' },
        { id: 202, sourceMaterialId: 21, unitType: 0, parentUnitId: 999, number: 2, title: 'A Hidden Enemy' },
        { id: 203, sourceMaterialId: 21, unitType: 0, parentUnitId: null, number: 3, title: 'Chapter 1' },
      ]);

      expect(component.isAutoExpanded(21)).toBe(true);
      const headers = root.querySelectorAll('.season-header');
      expect(headers.length).toBe(2);
      expect(root.textContent).toContain('Season 1');
      expect(root.textContent).toContain('Ungrouped');

      // Only the real Season group carries a tracking dropdown.
      expect(root.querySelectorAll('.group-track-select').length).toBe(1);

      (headers[1] as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(root.querySelectorAll('.season-episodes .unit-item').length).toBe(3);
      expect(root.textContent).toContain('Cat and Mouse');
      vi.useRealTimers();
    });

    it('hides seasons when toggling an auto-expanded show closed and restores them on re-expand', async () => {
      const root = await loadShowWithUnits([
        { id: 101, sourceMaterialId: 21, unitType: 3, parentUnitId: null, number: 1, title: null },
        { id: 201, sourceMaterialId: 21, unitType: 0, parentUnitId: 101, number: 1, title: 'Cat and Mouse' },
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

    function season(id: number, number: number, title: string): ApiSourceMaterialUnit {
      return { id, sourceMaterialId: 21, unitType: 'Season', parentUnitId: null, number, title };
    }

    it('auto-expands shows for non-admin viewing Season groups', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1'), season(102, 2, 'Season 2')] });
      fixture.detectChanges();

      expect(component.isAutoExpanded(21)).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Season 1');
    });

    it('renders per-group track selects for Season/Volume units', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1'), season(102, 2, 'Season 2')] });
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      expect(selects.length).toBe(2);
    });

    it('calls setStatus with unitId when selecting a season status', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1'), season(102, 2, 'Season 2')] });
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      const firstSelect = selects[0] as HTMLSelectElement;

      firstSelect.value = 'In progress';
      firstSelect.dispatchEvent(new Event('change'));

      expect(mockLibraryService.setStatus).toHaveBeenCalledWith(
        'test-user',
        21,
        'In progress',
        expect.any(Number),
      );
    });

    it('creates the library entry before recording season status for an untracked show', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1')] });
      fixture.detectChanges();

      const groupSelect = fixture.nativeElement.querySelector('.group-track-select') as HTMLSelectElement;
      groupSelect.value = 'Completed';
      groupSelect.dispatchEvent(new Event('change'));

      expect(mockLibraryService.addTracked).toHaveBeenCalledTimes(1);
      expect(mockLibraryService.setStatus).toHaveBeenCalledWith(
        'test-user',
        21,
        'Completed',
        expect.any(Number),
      );

      // The library entry must be created before the season status is recorded.
      const addOrder = mockLibraryService.addTracked.mock.invocationCallOrder[0];
      const statusOrder = mockLibraryService.setStatus.mock.invocationCallOrder.at(-1)!;
      expect(addOrder).toBeLessThan(statusOrder);
    });

    it('shows "Remove From Library" option in group track selects', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1'), season(102, 2, 'Season 2')] });

      // Pre-track the material with Season 1 tracked
      mockLibraryService.items.set([
        { id: 21, title: 'The Clone Wars', medium: 'Live Action Show', status: null, favorite: false, units: [
          { id: 101, unitType: 'Season', number: 1, title: 'Season 1', status: 'In progress' },
        ] },
      ]);
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      const options = selects[0].querySelectorAll('option');
      const removeOption = Array.from(options as any).find((o: any) => o.textContent?.includes('Remove From Library'));
      expect(removeOption).toBeTruthy();
    });

    it('displays the tracked season status in group track selects', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1'), season(102, 2, 'Season 2')] });

      // Season 1 is tracked and completed; Season 2 is untracked.
      mockLibraryService.items.set([
        { id: 21, title: 'The Clone Wars', medium: 'Live Action Show', status: null, favorite: false, units: [
          { id: 101, unitType: 'Season', number: 1, title: 'Season 1', status: 'Completed' },
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
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [season(101, 1, 'Season 1'), season(102, 2, 'Season 2')] });

      // Pre-track the material with Season 1 tracked
      mockLibraryService.items.set([
        { id: 21, title: 'The Clone Wars', medium: 'Live Action Show', status: null, favorite: false, units: [
          { id: 101, unitType: 'Season', number: 1, title: 'Season 1', status: 'In progress' },
        ] },
      ]);
      fixture.detectChanges();

      const selects = fixture.nativeElement.querySelectorAll('.group-track-select');
      const firstSelect = selects[0] as HTMLSelectElement;

      firstSelect.value = 'remove';
      firstSelect.dispatchEvent(new Event('change'));

      expect(mockLibraryService.clearUnitProgress).toHaveBeenCalledWith('test-user', 21, 101);
      expect(mockLibraryService.removeTracked).not.toHaveBeenCalled();
    });

    it('derives each season status independently from its own children only', () => {
      loadMaterials([{ id: 21, title: 'The Clone Wars', medium: 4, canonType: 0 }], { 21: 4 });
      fixture.detectChanges();

      // Set units with Season unitType to trigger group tracking
      (component as any).unitsByMaterial.set({ 21: [
        season(101, 1, 'Season 1'),
        season(102, 2, 'Season 2'),
        season(103, 3, 'Season 3'),
      ] });

      // Mirrors the reported bug scenario: Season 1 has completed episodes only,
      // Season 2 was just set to 'In progress' (tracked, nothing completed), and
      // Season 3 is untouched. Each select must reflect its own season alone.
      mockLibraryService.items.set([
        {
          id: 21,
          title: 'The Clone Wars',
          medium: 'Live Action Show',
          status: null,
          favorite: false,
          units: [
            { id: 111, unitType: 'Episode', number: 1, parentUnitId: 101, status: 'Completed' },
            { id: 112, unitType: 'Episode', number: 2, parentUnitId: 101, status: 'Completed' },
            { id: 101, unitType: 'Season', number: 1, title: 'Season 1', status: null },
            { id: 102, unitType: 'Season', number: 2, title: 'Season 2', status: 'In progress' },
            { id: 121, unitType: 'Episode', number: 1, parentUnitId: 102, status: 'In progress' },
            { id: 122, unitType: 'Episode', number: 2, parentUnitId: 102, status: 'In progress' },
            { id: 103, unitType: 'Season', number: 3, title: 'Season 3', status: null },
            { id: 131, unitType: 'Episode', number: 1, parentUnitId: 103, status: null },
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
