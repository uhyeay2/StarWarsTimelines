import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LibraryItem } from '../../models/library-item';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth/auth.service';
import { LibraryService } from '../../services/library/library.service';
import { TrackedEventsPage } from './tracked-events-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' };

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
    units: [
      { id: 'season-1', unitType: 'Season', number: 1, title: 'Season 1', isCompleted: false },
      { id: 'unit-1', unitType: 'Episode', groupNumber: 1, number: 1, title: 'Attack of the Clones', isCompleted: false },
      { id: 'unit-2', unitType: 'Episode', groupNumber: 1, number: 2, title: 'Sneak Preview', isCompleted: true },
    ],
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

interface LibraryMock {
  items: WritableSignal<readonly LibraryItem[]>;
  loading: WritableSignal<boolean>;
  error: WritableSignal<string | null>;
  ensureTracked: ReturnType<typeof vi.fn>;
  clearCache: ReturnType<typeof vi.fn>;
  getTracked: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
  setFavorite: ReturnType<typeof vi.fn>;
  removeTracked: ReturnType<typeof vi.fn>;
  setUnitProgress: ReturnType<typeof vi.fn>;
  clearUnitProgress: ReturnType<typeof vi.fn>;
  reorderTrackedItem: ReturnType<typeof vi.fn>;
}

interface Mocks {
  libraryMock: LibraryMock;
}

interface SetupOptions {
  items?: readonly LibraryItem[];
  loading?: boolean;
}

async function setup(currentUser: User | null, options: SetupOptions = {}): Promise<{
  fixture: ComponentFixture<TrackedEventsPage>;
  component: TrackedEventsPage;
  mocks: Mocks;
}> {
  const libraryMock: LibraryMock = {
    items: signal(options.items ?? TRACKED),
    loading: signal(options.loading ?? false),
    error: signal(null),
    ensureTracked: vi.fn(),
    clearCache: vi.fn(),
    getTracked: vi.fn(),
    setStatus: vi.fn(),
    setFavorite: vi.fn(),
    removeTracked: vi.fn(),
    setUnitProgress: vi.fn(),
    clearUnitProgress: vi.fn(),
    reorderTrackedItem: vi.fn(),
  };
  libraryMock.ensureTracked.mockImplementation(() => undefined);
  libraryMock.getTracked.mockReturnValue(of(TRACKED));
  libraryMock.setStatus.mockImplementation(
    (_userId: string, materialId: string, status: string) =>
      of(TRACKED.map((item) => (item.id === materialId ? { ...item, status } : item))),
  );
  libraryMock.setFavorite.mockImplementation(
    (_userId: string, materialId: string, favorite: boolean) =>
      of(TRACKED.map((item) => (item.id === materialId ? { ...item, favorite } : item))),
  );
  libraryMock.removeTracked.mockImplementation((_userId: string, materialId: string) =>
    of(TRACKED.filter((item) => item.id !== materialId)),
  );
  libraryMock.setUnitProgress.mockImplementation(
    (userId: string, materialId: string, unitId: string, isCompleted: boolean) => {
      void userId;
      void unitId;
      return of(
        TRACKED.map((item) =>
          item.id === materialId
            ? {
                ...item,
                units: (item.units ?? []).map((unit) =>
                  unit.id === unitId ? { ...unit, isCompleted } : unit,
                ),
              }
            : item,
        ),
      );
    },
  );
  libraryMock.reorderTrackedItem.mockImplementation((_userId: string, orderedIds: string[]) =>
    of(orderedIds.map((id) => TRACKED.find((item) => item.id === id)!)),
  );
  libraryMock.clearUnitProgress.mockImplementation(() => of(TRACKED));

  await TestBed.configureTestingModule({
    imports: [TrackedEventsPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(currentUser) } },
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
    const { fixture, mocks } = await setup(null);
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(0);
    expect(mocks.libraryMock.clearCache).toHaveBeenCalled();
    expect(mocks.libraryMock.ensureTracked).not.toHaveBeenCalled();
  });

  it('renders cached library data without refetching on revisit', async () => {
    const { fixture, mocks } = await setup(USER);
    expect(mocks.libraryMock.ensureTracked).toHaveBeenCalledWith('user-padme');
    expect(mocks.libraryMock.getTracked).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Star Wars: Episode I - The Phantom Menace');
  });

  it('shows a loading message instead of the empty state while the library loads', async () => {
    const { fixture, mocks } = await setup(USER, { items: [], loading: true });
    expect(fixture.nativeElement.textContent).toContain('Loading your tracked items');
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();

    mocks.libraryMock.items.set(TRACKED);
    mocks.libraryMock.loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(4);
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });

  it('shows the empty state only after loading finishes with no items', async () => {
    const { fixture } = await setup(USER, { items: [], loading: false });
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
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

  it('removes an item when Remove From Library is selected in the status select', async () => {
    const { fixture, mocks } = await setup(USER);
    const select = fixture.nativeElement.querySelector('select.status-select') as HTMLSelectElement;
    select.value = 'remove';
    select.dispatchEvent(new Event('change'));

    expect(mocks.libraryMock.removeTracked).toHaveBeenCalledWith('user-padme', 'material-episode-i');
  });

  it('shows grouped units for unit-based items instead of a flat status select', async () => {
    const { fixture } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    expect(rows[1].querySelector('select.status-select')).toBeNull();
    expect(rows[1].querySelector('.status-badge')).toBeNull();
    expect(rows[1].querySelectorAll('select.group-status-select').length).toBe(1);
    expect(rows[0].querySelector('select.status-select')).toBeTruthy();
  });

  it('updates group status when a season status select changes', async () => {
    const { fixture, mocks } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    const groupSelect = rows[1].querySelector('select.group-status-select') as HTMLSelectElement;
    groupSelect.value = 'Completed';
    groupSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(mocks.libraryMock.setStatus).toHaveBeenCalledWith(
      'user-padme',
      'material-episode-ii',
      'Completed',
      'season-1',
    );
  });

  it('clears unit progress (not the whole item) when a season select chooses Remove From Library', async () => {
    const { fixture, mocks } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    const groupSelect = rows[1].querySelector('select.group-status-select') as HTMLSelectElement;
    groupSelect.value = 'remove';
    groupSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(mocks.libraryMock.clearUnitProgress).toHaveBeenCalledWith(
      'user-padme',
      'material-episode-ii',
      'season-1',
    );
    expect(mocks.libraryMock.removeTracked).not.toHaveBeenCalled();
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

    expect(mocks.libraryMock.reorderTrackedItem).toHaveBeenCalledWith('user-padme', [
      'material-episode-i',
      'material-episode-ii',
      'material-darth-plagueis',
      'material-episode-ix',
    ]);
  });

  it('reorders the wish list by dragging one item onto another', async () => {
    const { fixture, mocks } = await setup(USER);
    const tab = [...fixture.nativeElement.querySelectorAll('.filter-tab')].find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Wish Listed',
    ) as HTMLElement;
    tab.click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.tracked-item-row');
    rows[1].dispatchEvent(new Event('dragstart', { bubbles: true }));
    rows[0].dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    rows[0].dispatchEvent(new Event('drop', { bubbles: true }));

    expect(mocks.libraryMock.reorderTrackedItem).toHaveBeenCalledWith('user-padme', [
      'material-episode-i',
      'material-episode-ii',
      'material-darth-plagueis',
      'material-episode-ix',
    ]);
  });
});
