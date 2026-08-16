import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { LibraryItem } from '../../models/library-item';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { CatalogService } from '../../services/catalog.service';
import { LibraryService } from '../../services/library.service';
import { TrackedEventsPage } from './tracked-events-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala' };

const CATALOG = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    title: 'Star Wars: Rebels',
    medium: 'Animated Show',
    canonType: 'Canon',
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    title: 'The Mandalorian',
    medium: 'Live Action Show',
    canonType: 'Canon',
  },
] as const;

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
      { id: 'unit-1', unitType: 'Episode', number: 1, title: 'Attack of the Clones', isCompleted: false },
      { id: 'unit-2', unitType: 'Episode', number: 2, title: 'Sneak Preview', isCompleted: true },
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

interface Mocks {
  libraryMock: {
    getTracked: ReturnType<typeof vi.fn>;
    addTracked: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    setFavorite: ReturnType<typeof vi.fn>;
    removeTracked: ReturnType<typeof vi.fn>;
    setUnitProgress: ReturnType<typeof vi.fn>;
    reorderTrackedItem: ReturnType<typeof vi.fn>;
  };
  catalogMock: {
    getSourceMaterials: ReturnType<typeof vi.fn>;
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
    setFavorite: vi.fn(),
    removeTracked: vi.fn(),
    setUnitProgress: vi.fn(),
    reorderTrackedItem: vi.fn(),
  };
  const catalogMock = {
    getSourceMaterials: vi.fn(),
  };
  libraryMock.getTracked.mockReturnValue(of(TRACKED));
  catalogMock.getSourceMaterials.mockReturnValue(of([...CATALOG]));
  libraryMock.setStatus.mockImplementation(
    (_userId: string, materialId: string, status: string) =>
      of(TRACKED.map((item) => (item.id === materialId ? { ...item, status } : item))),
  );
  libraryMock.setFavorite.mockImplementation(
    (_userId: string, materialId: string, favorite: boolean) =>
      of(TRACKED.map((item) => (item.id === materialId ? { ...item, favorite } : item))),
  );
  libraryMock.addTracked.mockImplementation(
    (_userId: string, material: { id: string; title: string; medium: string }) =>
      of([
        ...TRACKED,
        {
          id: material.id,
          title: material.title,
          medium: material.medium,
          status: 'Wish Listed',
          favorite: false,
        },
      ]),
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

  await TestBed.configureTestingModule({
    imports: [TrackedEventsPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser$: of(currentUser) as Observable<User | null> } },
      { provide: LibraryService, useValue: libraryMock },
      { provide: CatalogService, useValue: catalogMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TrackedEventsPage);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component, mocks: { libraryMock, catalogMock } };
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

    expect(mocks.libraryMock.setFavorite).toHaveBeenCalledWith('user-padme', 'material-episode-i', false);
  });

  it('removes an item when the remove button is clicked', async () => {
    const { fixture, mocks } = await setup(USER);
    const removeButton = fixture.nativeElement.querySelector('.remove-button') as HTMLElement;
    removeButton.click();

    expect(mocks.libraryMock.removeTracked).toHaveBeenCalledWith('user-padme', 'material-episode-i');
  });

  it('shows unit checkboxes for unit-based items instead of a status select', async () => {
    const { fixture } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    expect(rows[1].querySelector('select')).toBeNull();
    expect(rows[1].querySelectorAll('.unit-checkbox').length).toBe(2);
    expect(rows[0].querySelector('select')).toBeTruthy();
  });

  it('updates unit progress when a unit checkbox is toggled', async () => {
    const { fixture, mocks } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    const checkbox = rows[1].querySelector('.unit-checkbox') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();

    expect(mocks.libraryMock.setUnitProgress).toHaveBeenCalledWith(
      'user-padme',
      'material-episode-ii',
      'unit-1',
      true,
    );
  });

  it('adds a selected material to tracking', async () => {
    const { fixture, component, mocks } = await setup(USER);
    const select = fixture.nativeElement.querySelector('.add-select') as HTMLSelectElement;
    select.value = CATALOG[0].id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    addButton.click();
    fixture.detectChanges();

    expect(mocks.libraryMock.addTracked).toHaveBeenCalledWith('user-padme', CATALOG[0]);
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
