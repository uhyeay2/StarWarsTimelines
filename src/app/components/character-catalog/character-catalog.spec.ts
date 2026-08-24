import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogService } from '../../services/catalog/catalog.service';
import { CharacterCatalog } from './character-catalog';

const CHARACTERS_URL = '/api/characters';
const LOCATIONS_URL = '/api/locations';
const SPECIES_URL = '/api/species';

type BioFields = {
  id: number;
  name: string;
  planetBornOnId?: number | null;
  planetBornOnName?: string | null;
  yearOfBirthEarliest?: number | null;
  yearOfBirthLatest?: number | null;
  yearOfDeathEarliest?: number | null;
  yearOfDeathLatest?: number | null;
  speciesId?: number | null;
  speciesName?: string | null;
};

/** Flushes the three initial GETs fired by ngOnInit. */
function flushInitialFetch(
  httpMock: HttpTestingController,
  characters: BioFields[] = [],
): void {
  httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(CHARACTERS_URL)).flush(characters);
  httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(LOCATIONS_URL)).flush([
    { id: 11, name: 'Tatooine' },
    { id: 12, name: 'Coruscant' },
    { id: 13, name: 'Naboo' },
  ]);
  httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(SPECIES_URL)).flush([
    { id: 3, name: 'Human', homePlanetId: null, homePlanetName: null },
    { id: 4, name: 'Wookiee', homePlanetId: null, homePlanetName: null },
  ]);
}

describe('CharacterCatalog', () => {
  let component: CharacterCatalog;
  let fixture: ComponentFixture<CharacterCatalog>;
  let httpMock: HttpTestingController;
  let catalogService: CatalogService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CharacterCatalog],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterCatalog);
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    catalogService = TestBed.inject(CatalogService);
    fixture.detectChanges();

    flushInitialFetch(httpMock);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Triggers a characters re-fetch and flushes it with the given items. */
  function loadCharacters(items: BioFields[]): void {
    catalogService.invalidateEntity('characters');
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(CHARACTERS_URL)).flush(items);
    fixture.detectChanges();
  }

  it('renders the title and empty state', () => {
    expect(fixture.nativeElement.textContent).toContain('Characters');
    expect(component.items()).toEqual([]);
  });

  it('shows a validation error for a blank name on add', () => {
    component.newName.set('   ');
    fixture.detectChanges();
    component.add();

    expect(component.addError()).toBe('A name is required.');
    expect(component.adding()).toBe(false);
  });

  it('creates a name-only character', () => {
    component.newName.set('BD-1');
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(CHARACTERS_URL));
    expect(post.request.body).toEqual({
      name: 'BD-1',
      planetBornOnId: null,
      yearOfBirthEarliest: null,
      yearOfBirthLatest: null,
      yearOfDeathEarliest: null,
      yearOfDeathLatest: null,
      speciesId: null,
    });
    post.flush({ id: 7, name: 'BD-1' });

    loadCharacters([{ id: 7, name: 'BD-1' }]);

    expect(component.newName()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('BD-1');
  });

  it('creates a character with a full biography', () => {
    component.newName.set('Grogu');
    component.newSpeciesId.set(4);
    component.newPlanetBornOnId.set(11);
    component.newBirthFrom.set(-41);
    component.newBirthTo.set(-41);
    component.newDeathFrom.set(12);
    component.newDeathTo.set(15);
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(CHARACTERS_URL));
    expect(post.request.body).toEqual({
      name: 'Grogu',
      planetBornOnId: 11,
      yearOfBirthEarliest: -41,
      yearOfBirthLatest: -41,
      yearOfDeathEarliest: 12,
      yearOfDeathLatest: 15,
      speciesId: 4,
    });
    post.flush({ id: 8, name: 'Grogu' });

    loadCharacters([
      {
        id: 8,
        name: 'Grogu',
        planetBornOnName: 'Tatooine',
        yearOfBirthEarliest: -41,
        yearOfBirthLatest: -41,
        yearOfDeathEarliest: 12,
        yearOfDeathLatest: 15,
        speciesName: 'Wookiee',
      },
    ]);

    expect(component.items()[0]).toEqual({
      id: 8,
      name: 'Grogu',
      planetBornOnName: 'Tatooine',
      yearOfBirthEarliest: -41,
      yearOfBirthLatest: -41,
      yearOfDeathEarliest: 12,
      yearOfDeathLatest: 15,
      speciesName: 'Wookiee',
    });
  });

  it('rejects a half-filled birth-year pair without calling the API', () => {
    component.newName.set('Yoda');
    component.newBirthFrom.set(-900);
    fixture.detectChanges();
    component.add();

    expect(component.addError()).toBe('Birth years require both earliest and latest values.');
    httpMock.expectNone(() => true);
  });

  it('rejects an inverted death-year range without calling the API', () => {
    component.newName.set('Yoda');
    component.newDeathFrom.set(35);
    component.newDeathTo.set(4);
    fixture.detectChanges();
    component.add();

    expect(component.addError()).toBe('The earliest death year cannot come after the latest.');
    httpMock.expectNone(() => true);
  });

  it('surfaces a server error when creating a duplicate', () => {
    component.newName.set('Luke Skywalker');
    fixture.detectChanges();
    component.add();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'A character with this name already exists.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.addError()).toBe('A character with this name already exists.');
  });

  it('edits a character biography and reloads the list', () => {
    loadCharacters([
      {
        id: 9,
        name: 'Palpatine',
        planetBornOnId: 13,
        planetBornOnName: 'Naboo',
        yearOfBirthEarliest: -88,
        yearOfBirthLatest: -84,
        yearOfDeathEarliest: 4,
        yearOfDeathLatest: 35,
        speciesId: 3,
        speciesName: 'Human',
      },
    ]);
    const original = {
      id: 9,
      name: 'Palpatine',
      planetBornOnId: 13,
      planetBornOnName: 'Naboo',
      yearOfBirthEarliest: -88,
      yearOfBirthLatest: -84,
      yearOfDeathEarliest: 4,
      yearOfDeathLatest: 35,
      speciesId: 3,
      speciesName: 'Human',
    };

    component.beginEdit(original);
    component.editName.set('Emperor Palpatine');
    component.editPlanetBornOnId.set(12);
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${CHARACTERS_URL}/9`));
    expect(put.request.body).toEqual({
      name: 'Emperor Palpatine',
      planetBornOnId: 12,
      yearOfBirthEarliest: -88,
      yearOfBirthLatest: -84,
      yearOfDeathEarliest: 4,
      yearOfDeathLatest: 35,
      speciesId: 3,
    });
    put.flush({ id: 9, name: 'Emperor Palpatine' });

    loadCharacters([
      {
        id: 9,
        name: 'Emperor Palpatine',
        planetBornOnName: 'Coruscant',
        yearOfBirthEarliest: -88,
        yearOfBirthLatest: -84,
        yearOfDeathEarliest: 4,
        yearOfDeathLatest: 35,
        speciesName: 'Human',
      },
    ]);

    expect(component.editId()).toBeNull();
    expect(component.items()[0].planetBornOnName).toBe('Coruscant');
    expect(fixture.nativeElement.textContent).toContain('Human \u00b7 Born Coruscant, 84\u201388 BBY \u00b7 Died 4\u201335 ABY');
  });

  it('offers the unknown option in dropdowns when editing a character that has values, so values can be cleared', () => {
    loadCharacters([
      {
        id: 9,
        name: 'Luke',
        planetBornOnId: 11,
        planetBornOnName: 'Tatooine',
        yearOfBirthEarliest: -19,
        yearOfBirthLatest: -19,
        speciesId: 3,
        speciesName: 'Human',
      },
    ]);

    component.beginEdit({
      id: 9,
      name: 'Luke',
      planetBornOnId: 11,
      planetBornOnName: 'Tatooine',
      yearOfBirthEarliest: -19,
      yearOfBirthLatest: -19,
      speciesId: 3,
      speciesName: 'Human',
    });
    fixture.detectChanges();

    const speciesSelect = fixture.nativeElement.querySelector(
      'select[name="editSpeciesId"]',
    ) as HTMLSelectElement;
    const planetSelect = fixture.nativeElement.querySelector(
      'select[name="editPlanetBornOnId"]',
    ) as HTMLSelectElement;
    expect(
      Array.from(speciesSelect.options).some((o) => o.textContent?.trim() === 'Unknown'),
    ).toBe(true);
    expect(
      Array.from(planetSelect.options).some((o) => o.textContent?.trim() === 'Unknown'),
    ).toBe(true);
  });

  it('prefills the edit form with the stored biography and sends the full payload when saving', () => {
    loadCharacters([
      {
        id: 9,
        name: 'Luke',
        planetBornOnId: 11,
        planetBornOnName: 'Tatooine',
        yearOfBirthEarliest: -19,
        yearOfBirthLatest: -19,
        speciesId: 3,
        speciesName: 'Human',
      },
    ]);

    component.beginEdit({
      id: 9,
      name: 'Luke',
      planetBornOnId: 11,
      planetBornOnName: 'Tatooine',
      yearOfBirthEarliest: -19,
      yearOfBirthLatest: -19,
      speciesId: 3,
      speciesName: 'Human',
    });
    fixture.detectChanges();

    component.saveEdit();

    const http = httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/characters/9'));
    expect(http.request.body).toEqual({
      name: 'Luke',
      planetBornOnId: 11,
      yearOfBirthEarliest: -19,
      yearOfBirthLatest: -19,
      yearOfDeathEarliest: null,
      yearOfDeathLatest: null,
      speciesId: 3,
    });
    http.flush({ id: 9, name: 'Luke' });
    // The auto-refetch triggered by the mutation must also be flushed.
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url.endsWith(CHARACTERS_URL))
      .flush([
        {
          id: 9,
          name: 'Luke',
          planetBornOnId: 11,
          planetBornOnName: 'Tatooine',
          yearOfBirthEarliest: -19,
          yearOfBirthLatest: -19,
          speciesId: 3,
          speciesName: 'Human',
        },
      ]);
  });

  it('requires a name when saving an edit', () => {
    loadCharacters([{ id: 7, name: 'Old' }]);

    component.beginEdit({ id: 7, name: 'Old' });
    component.editName.set('   ');
    fixture.detectChanges();
    component.saveEdit();

    expect(component.actionError()).toBe('A name is required.');
    expect(component.savingId()).toBeNull();
  });

  it('deletes a character after inline confirmation', () => {
    loadCharacters([{ id: 7, name: 'Delete me' }]);

    component.requestDelete({ id: 7, name: 'Delete me' });
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe(7);

    component.confirmDelete();

    const del = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith(`${CHARACTERS_URL}/7`));
    del.flush(null, { status: 204, statusText: 'No Content' });

    loadCharacters([]);

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('surfaces the conflict message when deleting a linked character', () => {
    loadCharacters([{ id: 7, name: 'Linked' }]);

    component.requestDelete({ id: 7, name: 'Linked' });
    component.confirmDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { detail: 'Character is linked to one or more timeline events and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.actionError()).toBe(
      'Character is linked to one or more timeline events and cannot be deleted.',
    );
    expect(component.confirmDeleteId()).toBe(7);
  });

  it('filters items by search term', () => {
    loadCharacters([
      { id: 7, name: 'Luke Skywalker' },
      { id: 8, name: 'Leia Organa' },
      { id: 9, name: 'Yoda' },
    ]);

    component.searchTerm.set('leia');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([{ id: 8, name: 'Leia Organa' }]);
    expect(fixture.nativeElement.textContent).not.toContain('Yoda');
  });

  it('shows no details line for characters without biographical data', () => {
    loadCharacters([{ id: 77, name: 'BD-1' }]);

    expect(component.detailLine({ id: 77, name: 'BD-1' })).toBeNull();
    expect(fixture.nativeElement.querySelector('.character-meta')).toBeNull();
  });

  it('hides admin actions for non-admin users', () => {
    fixture.componentRef.setInput('isAdmin', false);
    fixture.detectChanges();
    loadCharacters([{ id: 7, name: 'Human' }]);

    expect(fixture.nativeElement.querySelector('.character-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.character-add')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Human');
  });
});
