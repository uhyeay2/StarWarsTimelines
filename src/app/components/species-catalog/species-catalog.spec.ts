import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogService } from '../../services/catalog/catalog.service';
import { SpeciesAdmin } from './species-admin';

const SPECIES_URL = '/api/species';
const LOCATIONS_URL = '/api/locations';

/** Flushes the two initial GETs fired by ngOnInit. */
function flushInitialFetch(
  httpMock: HttpTestingController,
  species: { id: string; name: string; homePlanetId: string | null; homePlanetName: string | null }[] = [],
  locations: { id: string; name: string }[] = [],
): void {
  httpMock
    .expectOne((r) => r.method === 'GET' && r.url.endsWith(SPECIES_URL))
    .flush(species);
  httpMock
    .expectOne((r) => r.method === 'GET' && r.url.endsWith(LOCATIONS_URL))
    .flush(locations);
}

describe('SpeciesAdmin', () => {
  let component: SpeciesAdmin;
  let fixture: ComponentFixture<SpeciesAdmin>;
  let httpMock: HttpTestingController;
  let catalogService: CatalogService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SpeciesAdmin],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeciesAdmin);
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    catalogService = TestBed.inject(CatalogService);
    fixture.detectChanges();

    flushInitialFetch(httpMock, [], [{ id: 'loc-1', name: 'Tatooine' }, { id: 'loc-2', name: 'Coruscant' }]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Triggers a species re-fetch and flushes it with the given items. */
  function loadSpecies(items: { id: string; name: string; homePlanetId: string | null; homePlanetName: string | null }[]): void {
    catalogService.invalidateEntity('species');
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(SPECIES_URL)).flush(items);
    fixture.detectChanges();
  }

  it('renders the title and empty state', () => {
    expect(fixture.nativeElement.textContent).toContain('Species');
    expect(component.items()).toEqual([]);
  });

  it('shows a validation error for a blank name on add', () => {
    component.newName.set('   ');
    fixture.detectChanges();
    component.add();

    expect(component.addError()).toBe('A name is required.');
    expect(component.adding()).toBe(false);
  });

  it('creates a species without a home planet and reloads the list', () => {
    component.newName.set('Twi\u2019lek');
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(SPECIES_URL));
    expect(post.request.body).toEqual({ name: 'Twi\u2019lek', homePlanetId: null });
    post.flush({ id: 'sp-1', name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null });

    loadSpecies([{ id: 'sp-1', name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null }]);

    expect(component.newName()).toBe('');
    expect(component.items()).toEqual([{ id: 'sp-1', name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null }]);
    expect(fixture.nativeElement.textContent).toContain('Twi\u2019lek');
  });

  it('creates a species with a home planet', () => {
    component.newName.set('Togruta');
    component.newHomePlanetId.set('loc-1');
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(SPECIES_URL));
    expect(post.request.body).toEqual({ name: 'Togruta', homePlanetId: 'loc-1' });
    post.flush({ id: 'sp-2', name: 'Togruta', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' });

    loadSpecies([{ id: 'sp-2', name: 'Togruta', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' }]);

    expect(fixture.nativeElement.textContent).toContain('Home: Tatooine');
  });

  it('surfaces a server error when creating a duplicate', () => {
    component.newName.set('Human');
    fixture.detectChanges();
    component.add();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'A species with this name already exists.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.addError()).toBe('A species with this name already exists.');
  });

  it('edits a species name and home planet, then reloads the list', () => {
    loadSpecies([{ id: 'sp-1', name: 'Old', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' }]);

    component.beginEdit({ id: 'sp-1', name: 'Old', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' });
    component.editName.set('New');
    component.editHomePlanetId.set('loc-2');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${SPECIES_URL}/sp-1`));
    expect(put.request.body).toEqual({ name: 'New', homePlanetId: 'loc-2' });
    put.flush({ id: 'sp-1', name: 'New', homePlanetId: 'loc-2', homePlanetName: 'Coruscant' });

    loadSpecies([{ id: 'sp-1', name: 'New', homePlanetId: 'loc-2', homePlanetName: 'Coruscant' }]);

    expect(component.editId()).toBeNull();
    expect(component.items()[0].homePlanetName).toBe('Coruscant');
  });

  it('offers the no-planet option when editing a species that has a planet, so it can be cleared', () => {
    loadSpecies([{ id: 'sp-1', name: 'Zabrak', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' }]);

    component.beginEdit({ id: 'sp-1', name: 'Zabrak', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' });
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select[name="editHomePlanetId"]') as HTMLSelectElement;
    const options = Array.from(select.options).map((o: HTMLOptionElement) => o.value);
    expect(options).toContain('');
  });

  it('sends a null home planet to clear the stored value', () => {
    loadSpecies([{ id: 'sp-1', name: 'Zabrak', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' }]);

    component.beginEdit({ id: 'sp-1', name: 'Zabrak', homePlanetId: 'loc-1', homePlanetName: 'Tatooine' });
    component.editHomePlanetId.set('');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${SPECIES_URL}/sp-1`));
    expect(put.request.body).toEqual({ name: 'Zabrak', homePlanetId: null });
    put.flush({ id: 'sp-1', name: 'Zabrak', homePlanetId: null, homePlanetName: null });

    loadSpecies([{ id: 'sp-1', name: 'Zabrak', homePlanetId: null, homePlanetName: null }]);

    expect(component.items()[0].homePlanetName).toBeNull();
  });

  it('requires a name when saving an edit', () => {
    loadSpecies([{ id: 'sp-1', name: 'Old', homePlanetId: null, homePlanetName: null }]);

    component.beginEdit({ id: 'sp-1', name: 'Old', homePlanetId: null, homePlanetName: null });
    component.editName.set('   ');
    fixture.detectChanges();
    component.saveEdit();

    expect(component.actionError()).toBe('A name is required.');
    expect(component.savingId()).toBeNull();
  });

  it('deletes a species after inline confirmation', () => {
    loadSpecies([{ id: 'sp-1', name: 'Delete me', homePlanetId: null, homePlanetName: null }]);

    component.requestDelete({ id: 'sp-1', name: 'Delete me', homePlanetId: null, homePlanetName: null });
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe('sp-1');
    expect(fixture.nativeElement.textContent).toContain('Delete \u201CDelete me\u201D');

    component.confirmDelete();

    const del = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith(`${SPECIES_URL}/sp-1`));
    del.flush(null, { status: 204, statusText: 'No Content' });

    loadSpecies([]);

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('cancels an in-progress delete', () => {
    loadSpecies([{ id: 'sp-1', name: 'Keep me', homePlanetId: null, homePlanetName: null }]);

    component.requestDelete({ id: 'sp-1', name: 'Keep me', homePlanetId: null, homePlanetName: null });
    component.cancelDelete();

    expect(component.confirmDeleteId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Keep me');
  });

  it('filters items by search term', () => {
    loadSpecies([
      { id: 'sp-1', name: 'Human', homePlanetId: null, homePlanetName: null },
      { id: 'sp-2', name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null },
      { id: 'sp-3', name: 'Wookiee', homePlanetId: null, homePlanetName: null },
    ]);

    component.searchTerm.set('twi');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([{ id: 'sp-2', name: 'Twi\u2019lek', homePlanetId: null, homePlanetName: null }]);
    expect(fixture.nativeElement.textContent).toContain('Twi\u2019lek');
    expect(fixture.nativeElement.textContent).not.toContain('Wookiee');
  });

  it('hides admin actions for non-admin users', () => {
    fixture.componentRef.setInput('isAdmin', false);
    fixture.detectChanges();
    loadSpecies([{ id: 'sp-1', name: 'Human', homePlanetId: null, homePlanetName: null }]);

    expect(fixture.nativeElement.querySelector('.species-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.species-add')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Human');
  });
});
