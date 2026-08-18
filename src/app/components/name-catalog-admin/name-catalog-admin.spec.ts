import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NameCatalogAdmin } from './name-catalog-admin';

const CHARACTERS_URL = `${environment.apiBaseUrl}/api/characters`;

describe('NameCatalogAdmin', () => {
  let component: NameCatalogAdmin;
  let fixture: ComponentFixture<NameCatalogAdmin>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NameCatalogAdmin],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NameCatalogAdmin);
    fixture.componentRef.setInput('catalog', 'characters');
    fixture.componentRef.setInput('title', 'Characters');
    fixture.componentRef.setInput('noun', 'character');
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const initial = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
    initial.flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

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

  it('creates a character and reloads the list', () => {
    component.newName.set('Yoda');
    fixture.detectChanges();
    component.add();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/characters'));
    expect(post.request.body).toEqual({ name: 'Yoda' });
    post.flush({ id: 'char-yoda', name: 'Yoda' });

    const reload = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
    reload.flush([{ id: 'char-yoda', name: 'Yoda' }]);
    fixture.detectChanges();

    expect(component.newName()).toBe('');
    expect(component.items()).toEqual([{ id: 'char-yoda', name: 'Yoda' }]);
    expect(fixture.nativeElement.textContent).toContain('Yoda');
  });

  it('surfaces a server error when creating a duplicate', () => {
    component.newName.set('Yoda');
    fixture.detectChanges();
    component.add();

    httpMock
      .expectOne((r) => r.method === 'POST')
      .flush({ detail: 'A character with this name already exists.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.addError()).toBe('A character with this name already exists.');
    expect(fixture.nativeElement.textContent).toContain('A character with this name already exists.');
  });

  it('edits an existing character and reloads the list', () => {
    component.items.set([{ id: 'char-1', name: 'Old' }]);
    fixture.detectChanges();
    component.beginEdit({ id: 'char-1', name: 'Old' });
    component.editName.set('New name');
    fixture.detectChanges();
    component.saveEdit();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/characters/char-1'));
    expect(put.request.body).toEqual({ name: 'New name' });
    put.flush({ id: 'char-1', name: 'New name' });

    const reload = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
    reload.flush([{ id: 'char-1', name: 'New name' }]);
    fixture.detectChanges();

    expect(component.editId()).toBeNull();
    expect(component.items()).toEqual([{ id: 'char-1', name: 'New name' }]);
  });

  it('requires a name when saving an edit', () => {
    component.items.set([{ id: 'char-1', name: 'Old' }]);
    fixture.detectChanges();
    component.beginEdit({ id: 'char-1', name: 'Old' });
    component.editName.set('   ');
    fixture.detectChanges();
    component.saveEdit();

    expect(component.actionError()).toBe('A name is required.');
    expect(component.savingId()).toBeNull();
  });

  it('deletes a character after inline confirmation', () => {
    component.items.set([{ id: 'char-1', name: 'Delete me' }]);
    fixture.detectChanges();
    component.requestDelete({ id: 'char-1', name: 'Delete me' });
    fixture.detectChanges();
    expect(component.confirmDeleteId()).toBe('char-1');
    expect(fixture.nativeElement.textContent).toContain('Delete “Delete me”');

    component.confirmDelete();

    const del = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/characters/char-1'));
    del.flush(null, { status: 204, statusText: 'No Content' });

    const reload = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
    reload.flush([]);
    fixture.detectChanges();

    expect(component.confirmDeleteId()).toBeNull();
    expect(component.items()).toEqual([]);
  });

  it('surfaces the conflict message when deleting a linked character', () => {
    component.items.set([{ id: 'char-1', name: 'Linked' }]);
    fixture.detectChanges();
    component.requestDelete({ id: 'char-1', name: 'Linked' });
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
    expect(fixture.nativeElement.textContent).toContain('timeline events');
    expect(component.confirmDeleteId()).toBe('char-1');
  });

  it('cancels an in-progress delete', () => {
    component.items.set([{ id: 'char-1', name: 'Keep me' }]);
    fixture.detectChanges();
    component.requestDelete({ id: 'char-1', name: 'Keep me' });
    component.cancelDelete();

    expect(component.confirmDeleteId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Keep me');
  });

  it('filters items by search term', () => {
    component.items.set([
      { id: 'char-1', name: 'Luke Skywalker' },
      { id: 'char-2', name: 'Leia Organa' },
      { id: 'char-3', name: 'Yoda' },
    ]);
    fixture.detectChanges();

    component.searchTerm.set('leia');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([{ id: 'char-2', name: 'Leia Organa' }]);
    expect(fixture.nativeElement.textContent).toContain('Leia Organa');
    expect(fixture.nativeElement.textContent).not.toContain('Luke Skywalker');
  });

  it('shows a no-results message when the search matches nothing', () => {
    component.items.set([{ id: 'char-1', name: 'Yoda' }]);
    fixture.detectChanges();

    component.searchTerm.set('Vader');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No characters match your search.');
  });

  it('clears the search to show all items again', () => {
    component.items.set([
      { id: 'char-1', name: 'Luke' },
      { id: 'char-2', name: 'Yoda' },
    ]);
    fixture.detectChanges();

    component.searchTerm.set('Luke');
    fixture.detectChanges();
    expect(component.filteredItems()).toHaveLength(1);

    component.searchTerm.set('');
    fixture.detectChanges();
    expect(component.filteredItems()).toHaveLength(2);
  });

  it('search is case-insensitive', () => {
    component.items.set([{ id: 'char-1', name: 'Chewbacca' }]);
    fixture.detectChanges();

    component.searchTerm.set('CHEWBACCA');
    fixture.detectChanges();

    expect(component.filteredItems()).toEqual([{ id: 'char-1', name: 'Chewbacca' }]);
  });
});
