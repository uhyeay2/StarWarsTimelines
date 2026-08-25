import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LibraryItem } from '../../../../shared/models/library-item';
import { User } from '../../../../shared/models/user';
import { AuthService } from '../../../auth/services/auth.service';
import { LibraryService } from '../../services/library.service';
import { WishListPage } from './wish-list-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' };

const TRACKED: LibraryItem[] = [
  {
    id: 21,
    title: 'Star Wars: Episode I - The Phantom Menace',
    medium: 'Movie',
    status: 'Completed',
    favorite: true,
  },
  {
    id: 22,
    title: 'Star Wars: Episode IX - The Rise of Skywalker',
    medium: 'Movie',
    status: 'Wish Listed',
    favorite: false,
  },
  {
    id: 23,
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
  setStatus: ReturnType<typeof vi.fn>;
  removeTracked: ReturnType<typeof vi.fn>;
  setUnitProgress: ReturnType<typeof vi.fn>;
  clearUnitProgress: ReturnType<typeof vi.fn>;
  reorderTrackedItem: ReturnType<typeof vi.fn>;
}

async function setup(
  currentUser: User | null,
  items: readonly LibraryItem[] = TRACKED,
): Promise<{
  fixture: ComponentFixture<WishListPage>;
  component: WishListPage;
  libraryMock: LibraryMock;
}> {
  const libraryMock: LibraryMock = {
    items: signal(items),
    loading: signal(false),
    error: signal(null),
    ensureTracked: vi.fn(),
    clearCache: vi.fn(),
    setStatus: vi.fn(),
    removeTracked: vi.fn(),
    setUnitProgress: vi.fn(),
    clearUnitProgress: vi.fn(),
    reorderTrackedItem: vi.fn(),
  };
  libraryMock.ensureTracked.mockImplementation(() => undefined);
  libraryMock.setStatus.mockImplementation(() => of(undefined));
  libraryMock.removeTracked.mockImplementation(() => of(undefined));
  libraryMock.setUnitProgress.mockImplementation(() => of(undefined));
  libraryMock.clearUnitProgress.mockImplementation(() => of(undefined));
  libraryMock.reorderTrackedItem.mockImplementation((_userId: string, orderedIds: number[]) =>
    of(orderedIds.map((id) => items.find((item) => item.id === id)!)),
  );

  await TestBed.configureTestingModule({
    imports: [WishListPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(currentUser) } },
      { provide: LibraryService, useValue: libraryMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(WishListPage);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component, libraryMock };
}

describe('WishListPage', () => {
  it('shows a login prompt when logged out', async () => {
    const { fixture, libraryMock } = await setup(null);
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-tracked-item-row').length).toBe(0);
    expect(libraryMock.clearCache).toHaveBeenCalled();
    expect(libraryMock.ensureTracked).not.toHaveBeenCalled();
  });

  it('loads the library and renders only wish listed items', async () => {
    const { fixture, libraryMock } = await setup(USER);
    expect(libraryMock.ensureTracked).toHaveBeenCalledWith('user-padme');
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Darth Plagueis');
    expect(fixture.nativeElement.textContent).not.toContain('The Phantom Menace');
  });

  it('shows the reorder hint and reorder controls', async () => {
    const { fixture } = await setup(USER);
    expect(fixture.nativeElement.querySelector('.reorder-hint')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.move-button').length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('[draggable="true"]').length).toBe(2);
  });

  it('shows an empty state when no items are wish listed', async () => {
    const onlyCompleted = TRACKED.filter((item) => item.status === 'Completed');
    const { fixture } = await setup(USER, onlyCompleted);
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.reorder-hint')).toBeNull();
  });

  it('moves an item up within the wish list', async () => {
    const { fixture, libraryMock } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    const upButton = rows[1].querySelectorAll('.move-button')[0] as HTMLElement;
    upButton.click();

    expect(libraryMock.reorderTrackedItem).toHaveBeenCalledWith('user-padme', [
      21,
      23,
      22,
    ]);
  });

  it('moves an item down within the wish list', async () => {
    const { fixture, libraryMock } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('app-tracked-item-row');
    const downButton = rows[0].querySelectorAll('.move-button')[1] as HTMLElement;
    downButton.click();

    expect(libraryMock.reorderTrackedItem).toHaveBeenCalledWith('user-padme', [
      21,
      23,
      22,
    ]);
  });

  it('reorders by dragging one item onto another', async () => {
    const { fixture, libraryMock } = await setup(USER);
    const rows = fixture.nativeElement.querySelectorAll('.tracked-item-row');
    rows[1].dispatchEvent(new Event('dragstart', { bubbles: true }));
    rows[0].dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    rows[0].dispatchEvent(new Event('drop', { bubbles: true }));

    expect(libraryMock.reorderTrackedItem).toHaveBeenCalledWith('user-padme', [
      21,
      23,
      22,
    ]);
  });

  it('updates an item status when the select changes', async () => {
    const { fixture, libraryMock } = await setup(USER);
    const select = fixture.nativeElement.querySelector('select.status-select') as HTMLSelectElement;
    select.value = 'In progress';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(libraryMock.setStatus).toHaveBeenCalledWith(
      'user-padme',
      22,
      'In progress',
    );
  });
});
