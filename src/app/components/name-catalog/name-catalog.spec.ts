import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogService } from '../../services/catalog/catalog.service';
import { NameCatalog } from './name-catalog';

const LOCATIONS_URL = '/api/locations';

describe('NameCatalog', () => {
  let component: NameCatalog;
  let fixture: ComponentFixture<NameCatalog>;
  let httpMock: HttpTestingController;
  let catalogService: CatalogService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NameCatalog],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NameCatalog);
    fixture.componentRef.setInput('catalog', 'locations');
    fixture.componentRef.setInput('title', 'Locations');
    fixture.componentRef.setInput('noun', 'location');
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    catalogService = TestBed.inject(CatalogService);
    fixture.detectChanges();

    // Flush the initial fetch triggered by ngOnInit.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(LOCATIONS_URL)).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Triggers a new fetch and flushes it with the given items. */
  function loadLocations(items: { id: string; name: string }[]): void {
    catalogService.invalidateEntity('locations');
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(LOCATIONS_URL)).flush(items);
    fixture.detectChanges();
  }

  it('renders the title and empty state', () => {
    expect(fixture.nativeElement.textContent).toContain('Locations');
    expect(component.items()).toEqual([]);
  });

  it('shows a validation error for a blank name on add', () => {
    component.newName.set('   ');
    fixture.detectChanges();
    component.add();

    expect(component.addError()).toBe('A name is required.');
    expect(component.adding()).toBe(false);
  });

  it('creates a location and reloads the list', () => {
    component.newName.set('Naboo');
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/locations'));
    expect(post.request.body).toEqual({ name: 'Naboo' });
    post.flush({ id: 'loc-naboo', name: 'Naboo' });

    // Mutation auto-invalidates the cache → re-fetch fires automatically.
    catalogService.fetchLocations();
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(LOCATIONS_URL)).flush([{ id: 'loc-naboo', name: 'Naboo' }]);
    fixture.detectChanges();

    expect(component.newName()).toBe('');
    expect(component.items()).toEqual([{ id: 'loc-naboo', name: 'Naboo' }]);
    expect(fixture.nativeElement.textContent).toContain('Naboo');
  });

  it('surfaces a server error when creating a duplicate', () => {
    component.newName.set('Tatooine');
    fixture.detectChanges();
    component.add();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'A location with this name already exists.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.addError()).toBe('A location with this name already exists.');
    expect(fixture.nativeElement.textContent).toContain('A location with this name already exists.');
  });

  it('edits an existing location and reloads the list', () => {
    loadLocations([{ id: 'loc-1', name: 'Old' }]);

    component.beginEdit({ id: 'loc-1', name: 'Old' });
    component.editName.set('New name');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/locations/loc-1'));
    expect(put.request.body).toEqual({ name: 'New name' });
    put.flush({ id: 'loc-1', name: 'New name' });

    loadLocations([{ id: 'loc-1', name: 'New name' }]);

    expect(component.editId()).toBeNull();
    expect(component.items()).toEqual([{ id: 'loc-1', name: 'New name' }]);
  });

  it('requires a name when saving an edit', () => {
    loadLocations([{ id: 'loc-1', name: 'Old' }]);

    component.beginEdit({ id: 'loc-1', name: 'Old' });
    component.editName.set('   ');
    fixture.detectChanges();
    component.saveEdit();

    expect(component.actionError()).toBe('A name is required.');
    expect(component.savingId()).toBeNull();
  });

  it('deletes a location after inline confirmation', () => {
    loadLocations([{ id: 'loc-1', name: 'Delete me' }]);

    component.requestDelete({ id: 'loc-1', name: 'Delete me' });
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe('loc-1');
    expect(fixture.nativeElement.textContent).toContain('Delete \u201CDelete me\u201D');

    component.confirmDelete();

    const del = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/locations/loc-1'));
    del.flush(null, { status: 204, statusText: 'No Content' });

    loadLocations([]);

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('surfaces the conflict message when deleting a linked location', () => {
    loadLocations([{ id: 'loc-1', name: 'Linked' }]);

    component.requestDelete({ id: 'loc-1', name: 'Linked' });
    component.confirmDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { detail: 'Location is linked to one or more timeline events and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.actionError()).toBe(
      'Location is linked to one or more timeline events and cannot be deleted.',
    );
    expect(fixture.nativeElement.textContent).toContain('timeline events');
    expect(component.confirmDeleteId()).toBe('loc-1');
  });

  it('cancels an in-progress delete', () => {
    loadLocations([{ id: 'loc-1', name: 'Keep me' }]);

    component.requestDelete({ id: 'loc-1', name: 'Keep me' });
    component.cancelDelete();

    expect(component.confirmDeleteId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Keep me');
  });

  it('filters items by search term', () => {
    loadLocations([
      { id: 'loc-1', name: 'Luke Skywalker' },
      { id: 'loc-2', name: 'Leia Organa' },
      { id: 'loc-3', name: 'Yoda' },
    ]);

    component.searchTerm.set('leia');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([{ id: 'loc-2', name: 'Leia Organa' }]);
    expect(fixture.nativeElement.textContent).toContain('Leia Organa');
    expect(fixture.nativeElement.textContent).not.toContain('Luke Skywalker');
  });

  it('shows a no-results message when the search matches nothing', () => {
    loadLocations([{ id: 'loc-1', name: 'Yoda' }]);

    component.searchTerm.set('Vader');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No locations match your search.');
  });

  it('clears the search to show all items again', () => {
    loadLocations([
      { id: 'loc-1', name: 'Luke' },
      { id: 'loc-2', name: 'Yoda' },
    ]);

    component.searchTerm.set('Luke');
    fixture.detectChanges();
    expect(component.filteredItems()).toHaveLength(1);

    component.searchTerm.set('');
    fixture.detectChanges();
    expect(component.filteredItems()).toHaveLength(2);
  });

  it('search is case-insensitive', () => {
    loadLocations([{ id: 'loc-1', name: 'Chewbacca' }]);

    component.searchTerm.set('CHEWBACCA');

    expect(component.filteredItems()).toEqual([{ id: 'loc-1', name: 'Chewbacca' }]);
  });
});
