import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpeciesService } from '../../services/species.service';
import { SpeciesCatalog } from './species-catalog';

const SPECIES_URL = '/api/species';
const LOCATIONS_URL = '/api/locations';

/** Flushes the two initial GETs fired by ngOnInit. */
function flushInitialFetch(
  httpMock: HttpTestingController,
  species: {
    id: number;
    name: string;
    homePlanetId: number | null;
    homePlanetName: string | null;
  }[] = [],
  locations: { id: number; name: string }[] = [],
): void {
  httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(SPECIES_URL)).flush(species);
  httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(LOCATIONS_URL)).flush(locations);
}

describe('SpeciesCatalog', () => {
  let component: SpeciesCatalog;
  let fixture: ComponentFixture<SpeciesCatalog>;
  let httpMock: HttpTestingController;
  let speciesService: SpeciesService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SpeciesCatalog],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeciesCatalog);
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    speciesService = TestBed.inject(SpeciesService);
    fixture.detectChanges();

    flushInitialFetch(
      httpMock,
      [],
      [
        { id: 11, name: 'Tatooine' },
        { id: 12, name: 'Coruscant' },
      ],
    );
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Triggers a species re-fetch and flushes it with the given items. */
  function loadSpecies(
    items: {
      id: number;
      name: string;
      homePlanetId: number | null;
      homePlanetName: string | null;
    }[],
  ): void {
    speciesService.invalidate();
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(SPECIES_URL)).flush(items);
    fixture.detectChanges();
  }

  it('renders the title and empty state', () => {
    expect(fixture.nativeElement.textContent).toContain('Species');
    expect(component.items()).toEqual([]);
  });

  it('opens the add dialog from the header button and cancels it', () => {
    const header = fixture.nativeElement.querySelector('.catalog-header') as HTMLElement;
    const addButton = header.querySelector('.catalog-add-button') as HTMLButtonElement;
    expect(header.querySelector('h2')?.textContent).toContain('Species');
    expect(header.lastElementChild).toBe(addButton);

    addButton.click();
    fixture.detectChanges();
    expect(component.addOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Add species');

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.addOpen()).toBe(false);
  });

  it('shows a validation error for a blank name on add', () => {
    component.openAdd();
    fixture.detectChanges();
    component.newName.set('   ');
    component.submitAdd();

    expect(component.addError()).toBe('A name is required.');
    expect(component.adding()).toBe(false);
  });

  it('creates a species without a home planet and reloads the list', () => {
    component.openAdd();
    component.newName.set('Twi\u2019lek');
    fixture.detectChanges();
    component.submitAdd();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(SPECIES_URL));
    expect(post.request.body).toEqual({ name: 'Twi\u2019lek', homePlanetId: null });
    post.flush({ id: 3, name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null });

    loadSpecies([{ id: 3, name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null }]);

    expect(component.addOpen()).toBe(false);
    expect(component.newName()).toBe('');
    expect(component.items()).toEqual([
      { id: 3, name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Twi\u2019lek');
  });

  it('creates a species with a home planet', () => {
    component.openAdd();
    component.newName.set('Togruta');
    component.newHomePlanetId.set(11);
    fixture.detectChanges();
    component.submitAdd();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(SPECIES_URL));
    expect(post.request.body).toEqual({ name: 'Togruta', homePlanetId: 11 });
    post.flush({ id: 4, name: 'Togruta', homePlanetId: 11, homePlanetName: 'Tatooine' });

    loadSpecies([{ id: 4, name: 'Togruta', homePlanetId: 11, homePlanetName: 'Tatooine' }]);

    expect(fixture.nativeElement.textContent).toContain('Home: Tatooine');
  });

  it('surfaces a server error inside the dialog when creating a duplicate', () => {
    component.openAdd();
    component.newName.set('Human');
    fixture.detectChanges();
    component.submitAdd();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush(
        { detail: 'A species with this name already exists.' },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();

    expect(component.addError()).toBe('A species with this name already exists.');
  });

  it('edits a species name and home planet, then reloads the list', () => {
    loadSpecies([{ id: 3, name: 'Old', homePlanetId: 11, homePlanetName: 'Tatooine' }]);

    component.beginEdit({ id: 3, name: 'Old', homePlanetId: 11, homePlanetName: 'Tatooine' });
    component.editName.set('New');
    component.editHomePlanetId.set(12);
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${SPECIES_URL}/3`));
    expect(put.request.body).toEqual({ name: 'New', homePlanetId: 12 });
    put.flush({ id: 3, name: 'New', homePlanetId: 12, homePlanetName: 'Coruscant' });

    loadSpecies([{ id: 3, name: 'New', homePlanetId: 12, homePlanetName: 'Coruscant' }]);

    expect(component.editId()).toBeNull();
    expect(component.items()[0]!.homePlanetName).toBe('Coruscant');
  });

  it('offers the no-planet option when editing a species that has a planet, so it can be cleared', () => {
    loadSpecies([{ id: 3, name: 'Zabrak', homePlanetId: 11, homePlanetName: 'Tatooine' }]);

    component.beginEdit({ id: 3, name: 'Zabrak', homePlanetId: 11, homePlanetName: 'Tatooine' });
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector(
      'select[name="editHomePlanetId"]',
    ) as HTMLSelectElement;
    const options = Array.from(select.options).map((o: HTMLOptionElement) => o.textContent?.trim());
    expect(options).toContain('No home planet');
  });

  it('sends a null home planet to clear the stored value', () => {
    loadSpecies([{ id: 3, name: 'Zabrak', homePlanetId: 11, homePlanetName: 'Tatooine' }]);

    component.beginEdit({ id: 3, name: 'Zabrak', homePlanetId: 11, homePlanetName: 'Tatooine' });
    component.editHomePlanetId.set(0);
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${SPECIES_URL}/3`));
    expect(put.request.body).toEqual({ name: 'Zabrak', homePlanetId: null });
    put.flush({ id: 3, name: 'Zabrak', homePlanetId: null, homePlanetName: null });

    loadSpecies([{ id: 3, name: 'Zabrak', homePlanetId: null, homePlanetName: null }]);

    expect(component.items()[0]!.homePlanetName).toBeNull();
  });

  it('requires a name when saving an edit', () => {
    loadSpecies([{ id: 3, name: 'Old', homePlanetId: null, homePlanetName: null }]);

    component.beginEdit({ id: 3, name: 'Old', homePlanetId: null, homePlanetName: null });
    component.editName.set('   ');
    fixture.detectChanges();
    component.saveEdit();

    expect(component.actionError()).toBe('A name is required.');
    expect(component.savingId()).toBeNull();
  });

  it('deletes a species after inline confirmation', () => {
    loadSpecies([{ id: 3, name: 'Delete me', homePlanetId: null, homePlanetName: null }]);

    component.requestDelete({ id: 3, name: 'Delete me', homePlanetId: null, homePlanetName: null });
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Delete \u201CDelete me\u201D');

    component.confirmDelete();

    const del = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.url.endsWith(`${SPECIES_URL}/3`),
    );
    del.flush(null, { status: 204, statusText: 'No Content' });

    loadSpecies([]);

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('cancels an in-progress delete', () => {
    loadSpecies([{ id: 3, name: 'Keep me', homePlanetId: null, homePlanetName: null }]);

    component.requestDelete({ id: 3, name: 'Keep me', homePlanetId: null, homePlanetName: null });
    component.cancelDelete();

    expect(component.confirmDeleteId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Keep me');
  });

  it('filters items by search term', () => {
    loadSpecies([
      { id: 3, name: 'Human', homePlanetId: null, homePlanetName: null },
      { id: 4, name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null },
      { id: 5, name: 'Wookiee', homePlanetId: null, homePlanetName: null },
    ]);

    component.searchTerm.set('twi');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([
      { id: 4, name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Twi\u2019lek');
    expect(fixture.nativeElement.textContent).not.toContain('Wookiee');
  });

  it('hides admin actions for non-admin users', () => {
    fixture.componentRef.setInput('isAdmin', false);
    fixture.detectChanges();
    loadSpecies([{ id: 3, name: 'Human', homePlanetId: null, homePlanetName: null }]);

    expect(fixture.nativeElement.querySelector('.species-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.catalog-add-button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Human');
  });
});
