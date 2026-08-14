import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { LibraryItem } from '../../models/library-item';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { TrackedEventsPage } from './tracked-events-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala' };

const TRACKED: LibraryItem[] = [
  {
    id: 'material-episode-i',
    title: 'Star Wars: Episode I - The Phantom Menace',
    medium: 'Movie',
    status: 'Completed',
    favorite: true,
  },
  {
    id: 'material-episode-ii',
    title: 'Star Wars: Episode II - Attack of the Clones',
    medium: 'Movie',
    status: 'In progress',
    favorite: false,
  },
  {
    id: 'material-episode-ix',
    title: 'Star Wars: Episode IX - The Rise of Skywalker',
    medium: 'Movie',
    status: 'Wish Listed',
    favorite: false,
  },
  {
    id: 'material-darth-plagueis',
    title: 'Darth Plagueis',
    medium: 'Book',
    status: 'Wish Listed',
    favorite: false,
  },
];

interface Mocks {
  libraryMock: {
    getTracked: ReturnType<typeof vi.fn>;
    addTracked: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    toggleFavorite: ReturnType<typeof vi.fn>;
    removeTracked: ReturnType<typeof vi.fn>;
    moveTrackedItem: ReturnType<typeof vi.fn>;
    reorderTrackedItem: ReturnType<typeof vi.fn>;
  };
}

async function setup(currentUser: User | null): Promise<{
  fixture: ComponentFixture<TrackedEventsPage>;
  component: TrackedEventsPage;
  mocks: Mocks;
}> {
  const libraryMock = {
    getTracked: vi.fn(),
    addTracked: vi.fn(),
    setStatus: vi.fn(),
    toggleFavorite: vi.fn(),
    removeTracked: vi.fn(),
    moveTrackedItem: vi.fn(),
    reorderTrackedItem: vi.fn(),
  };
  libraryMock.getTracked.mockReturnValue(of(TRACKED));
  libraryMock.setStatus.mockImplementation(
    (_userId: string, materialId: string, status: string) =>
      of(TRACKED.map((item) => (item.id === materialId ? { ...item, status } : item))),
  );
  libraryMock.toggleFavorite.mockImplementation((_userId: string, materialId: string) =>
    of(TRACKED.map((item) => (item.id === materialId ? { ...item, favorite: !item.favorite } : item))),
  );
  libraryMock.addTracked.mockImplementation((_userId: string, materialId: string) =>
    of([...TRACKED, { id: materialId, title: 'Added Material', medium: 'Book', status: 'Wish Listed', favorite: false }]),
  );
  libraryMock.removeTracked.mockImplementation((_userId: string, materialId: string) =>
    of(TRACKED.filter((item) => item.id !== materialId)),
  );
  libraryMock.moveTrackedItem.mockImplementation((_userId: string, materialId: string, direction: -1 | 1) => {
    const index = TRACKED.findIndex((item) => item.id === materialId);
    const status = TRACKED[index].status;
    const group = TRACKED.map((item, position) => ({ item, position })).filter(({ item }) => item.status === status);
    const groupIndex = group.findIndex(({ item }) => item.id === materialId);
    const next = [...TRACKED];
    const from = group[groupIndex].position;
    const to = group[groupIndex + direction].position;
    [next[from], next[to]] = [next[to], next[from]];
    return of(next);
  });
  libraryMock.reorderTrackedItem.mockImplementation((_userId: string, draggedId: string, targetId: string) => {
    const from = TRACKED.findIndex((item) => item.id === draggedId);
    const to = TRACKED.findIndex((item) => item.id === targetId);
    const next = [...TRACKED];
    const [dragged] = next.splice(from, 1);
    next.splice(to, 0, dragged);
    return of(next);
  });

  await TestBed.configureTestingModule({
    imports: [TrackedEventsPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser$: of(currentUser) as Observable<User | null> } },
      { provide: LibraryService, useValue: libraryMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TrackedEventsPage);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component, mocks: { libraryMock } };
}

describe('TrackedEventsPage', () => {
  it('shows a login prompt when logged out', async () => {
    const { fixture } = await setup(null);
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(0);
  });

  it('loads and renders the tracked items for the signed-in user', async () => {
    const { fixture } = await setup(USER);
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Star Wars: Episode I - The Phantom Menace');
  });

  it('filters items by status tab', async () => {
    const { fixture, component } = await setup(USER);
    const tab = [...fixture.nativeElement.querySelectorAll('.filter-tab')].find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Wish Listed',
    ) as HTMLElement;
    tab.click();
    fixture.detectChanges();

    expect(component.filter()).toBe('Wish Listed');
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(2);
  });

  it('updates an item status when the select changes', async () => {
    const { fixture, mocks } = await setup(USER);
    const select = fixture.nativeElement.querySelector('app-tracked-item-row select') as HTMLSelectElement;
    select.value = 'Completed';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(mocks.libraryMock.setStatus).toHaveBeenCalledWith('user-padme', 'material-episode-i', 'Completed');
  });

  it('toggles a favorite when the favorite button is clicked', async () => {
    const { fixture, mocks } = await setup(USER);
    const button = fixture.nativeElement.querySelector('.favorite-button') as HTMLElement;
    button.click();

    expect(mocks.libraryMock.toggleFavorite).toHaveBeenCalledWith('user-padme', 'material-episode-i');
  });

  it('removes an item when the remove button is clicked', async () => {
    const { fixture, mocks } = await setup(USER);
    const removeButton = fixture.nativeElement.querySelector('.remove-button') as HTMLElement;
    removeButton.click();

    expect(mocks.libraryMock.removeTracked).toHaveBeenCalledWith('user-padme', 'material-episode-i');
  });

  it('adds a selected material to tracking', async () => {
    const { fixture, component, mocks } = await setup(USER);
    const select = fixture.nativeElement.querySelector('.add-select') as HTMLSelectElement;
    select.value = 'material-rebels';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    addButton.click();
    fixture.detectChanges();

    expect(mocks.libraryMock.addTracked).toHaveBeenCalledWith('user-padme', 'material-rebels');
    expect(component.selectedMaterialId()).toBe('');
  });

  it('hides reorder controls outside the Wish Listed view', async () => {
    const { fixture } = await setup(USER);
    expect(fixture.nativeElement.querySelectorAll('.move-button').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.reorder-hint')).toBeNull();
  });

  it('shows reorder controls in the Wish Listed view and moves items', async () => {
    const { fixture, mocks } = await setup(USER);
    const tab = [...fixture.nativeElement.querySelectorAll('.filter-tab')].find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Wish Listed',
    ) as HTMLElement;
    tab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.move-button').length).toBe(4);
    expect(fixture.nativeElement.querySelector('.reorder-hint')).toBeTruthy();

    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    const downButton = rows[0].querySelector('.move-button:nth-of-type(2)') as HTMLElement;
    downButton.click();

    expect(mocks.libraryMock.moveTrackedItem).toHaveBeenCalledWith('user-padme', 'material-episode-ix', 1);
  });

  it('reorders the wish list by dragging one item onto another', async () => {
    const { fixture, mocks } = await setup(USER);
    const tab = [...fixture.nativeElement.querySelectorAll('.filter-tab')].find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Wish Listed',
    ) as HTMLElement;
    tab.click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.tracked-item-row');
    rows[0].dispatchEvent(new Event('dragstart', { bubbles: true }));
    rows[1].dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    rows[1].dispatchEvent(new Event('drop', { bubbles: true }));

    expect(mocks.libraryMock.reorderTrackedItem).toHaveBeenCalledWith(
      'user-padme',
      'material-episode-ix',
      'material-darth-plagueis',
    );
  });
});
