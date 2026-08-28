import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { NameCatalog } from './name-catalog';

const VEHICLES_URL = '/api/vehicles';

describe('NameCatalog', () => {
  let component: NameCatalog;
  let fixture: ComponentFixture<NameCatalog>;
  let httpMock: HttpTestingController;
  let vehicleService: VehicleService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NameCatalog],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NameCatalog);
    fixture.componentRef.setInput('catalog', 'vehicles');
    fixture.componentRef.setInput('title', 'Vehicles');
    fixture.componentRef.setInput('noun', 'vehicle');
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    vehicleService = TestBed.inject(VehicleService);
    fixture.detectChanges();

    // Flush the initial fetch triggered by ngOnInit.
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(VEHICLES_URL)).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Triggers a new fetch and flushes it with the given items. */
  function loadVehicles(items: { id: number; name: string }[]): void {
    vehicleService.invalidate();
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith(VEHICLES_URL)).flush(items);
    fixture.detectChanges();
  }

  it('renders the title and empty state', () => {
    expect(fixture.nativeElement.textContent).toContain('Vehicles');
    expect(component.items()).toEqual([]);
  });

  it('opens the add dialog from the header button and cancels it', () => {
    const header = fixture.nativeElement.querySelector('.catalog-header') as HTMLElement;
    const addButton = header.querySelector('.catalog-add-button') as HTMLButtonElement;
    expect(header.querySelector('h2')?.textContent).toContain('Vehicles');
    expect(header.lastElementChild).toBe(addButton);

    addButton.click();
    fixture.detectChanges();
    expect(component.addOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Add Vehicle');

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.addOpen()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Add Vehicle');
  });

  it('shows a validation error for a blank name on add', () => {
    component.openAdd();
    fixture.detectChanges();
    component.newName.set('   ');
    component.submitAdd();

    expect(component.addError()).toBe('A name is required.');
    expect(component.adding()).toBe(false);
    expect(component.addOpen()).toBe(true);
  });

  it('creates a vehicle through the dialog and reloads the list', () => {
    component.openAdd();
    component.newName.set('Naboo');
    fixture.detectChanges();
    component.submitAdd();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/vehicles'));
    expect(post.request.body).toEqual({ name: 'Naboo' });
    post.flush({ id: 12, name: 'Naboo' });
    fixture.detectChanges();

    // Mutation auto-invalidates the cache → re-fetch fires automatically.
    vehicleService.fetchVehicles();
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url.endsWith(VEHICLES_URL))
      .flush([{ id: 12, name: 'Naboo' }]);
    fixture.detectChanges();

    expect(component.addOpen()).toBe(false);
    expect(component.newName()).toBe('');
    expect(component.items()).toEqual([{ id: 12, name: 'Naboo' }]);
    expect(fixture.nativeElement.textContent).toContain('Naboo');
  });

  it('surfaces a server error inside the dialog when creating a duplicate', () => {
    component.openAdd();
    component.newName.set('Tatooine');
    fixture.detectChanges();
    component.submitAdd();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush(
        { detail: 'A vehicle with this name already exists.' },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();

    expect(component.addError()).toBe('A vehicle with this name already exists.');
    expect(component.addOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('A vehicle with this name already exists.');
  });

  it('edits an existing vehicle and reloads the list', () => {
    loadVehicles([{ id: 11, name: 'Old' }]);

    component.beginEdit({ id: 11, name: 'Old' });
    component.editName.set('New name');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/vehicles/11'));
    expect(put.request.body).toEqual({ name: 'New name' });
    put.flush({ id: 11, name: 'New name' });

    loadVehicles([{ id: 11, name: 'New name' }]);

    expect(component.editId()).toBeNull();
    expect(component.items()).toEqual([{ id: 11, name: 'New name' }]);
  });

  it('requires a name when saving an edit', () => {
    loadVehicles([{ id: 11, name: 'Old' }]);

    component.beginEdit({ id: 11, name: 'Old' });
    component.editName.set('   ');
    fixture.detectChanges();
    component.saveEdit();

    expect(component.actionError()).toBe('A name is required.');
    expect(component.savingId()).toBeNull();
  });

  it('deletes a vehicle after inline confirmation', () => {
    loadVehicles([{ id: 11, name: 'Delete me' }]);

    component.requestDelete({ id: 11, name: 'Delete me' });
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe(11);
    expect(fixture.nativeElement.textContent).toContain('Delete \u201CDelete me\u201D');

    component.confirmDelete();

    const del = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.url.endsWith('/api/vehicles/11'),
    );
    del.flush(null, { status: 204, statusText: 'No Content' });

    loadVehicles([]);

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('surfaces the conflict message when deleting a linked vehicle', () => {
    loadVehicles([{ id: 11, name: 'Linked' }]);

    component.requestDelete({ id: 11, name: 'Linked' });
    component.confirmDelete();

    httpMock
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { detail: 'Vehicle is linked to one or more timeline events and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.actionError()).toBe(
      'Vehicle is linked to one or more timeline events and cannot be deleted.',
    );
    expect(fixture.nativeElement.textContent).toContain('timeline events');
    expect(component.confirmDeleteId()).toBe(11);
  });

  it('cancels an in-progress delete', () => {
    loadVehicles([{ id: 11, name: 'Keep me' }]);

    component.requestDelete({ id: 11, name: 'Keep me' });
    component.cancelDelete();

    expect(component.confirmDeleteId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Keep me');
  });

  it('filters items by search term', () => {
    loadVehicles([
      { id: 11, name: 'X-wing' },
      { id: 12, name: 'TIE fighter' },
      { id: 13, name: 'Y-wing' },
    ]);

    component.searchTerm.set('tie');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([{ id: 12, name: 'TIE fighter' }]);
    expect(fixture.nativeElement.textContent).toContain('TIE fighter');
    expect(fixture.nativeElement.textContent).not.toContain('X-wing');
  });

  it('shows a no-results message when the search matches nothing', () => {
    loadVehicles([{ id: 11, name: 'Y-wing' }]);

    component.searchTerm.set('landspeeder');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No vehicles match your search.');
  });

  it('clears the search to show all items again', () => {
    loadVehicles([
      { id: 11, name: 'X-wing' },
      { id: 12, name: 'Y-wing' },
    ]);

    component.searchTerm.set('X-wing');
    fixture.detectChanges();
    expect(component.filteredItems()).toHaveLength(1);

    component.searchTerm.set('');
    fixture.detectChanges();
    expect(component.filteredItems()).toHaveLength(2);
  });

  it('search is case-insensitive', () => {
    loadVehicles([{ id: 11, name: 'Landspeeder' }]);

    component.searchTerm.set('LANDSPEEDER');

    expect(component.filteredItems()).toEqual([{ id: 11, name: 'Landspeeder' }]);
  });
});
