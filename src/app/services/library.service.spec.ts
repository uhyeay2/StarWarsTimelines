import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LibraryService } from './library.service';

describe('LibraryService', () => {
  let service: LibraryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LibraryService);
  });

  it('returns the seeded tracked items for a known user', async () => {
    const items = await firstValueFrom(service.getTracked('user-padme'));
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toBeTruthy();
  });

  it('returns an empty list for a user with no data', async () => {
    const items = await firstValueFrom(service.getTracked('user-unknown'));
    expect(items).toEqual([]);
  });

  it('adds materials to tracking as Wish Listed and prevents duplicates', async () => {
    const first = await firstValueFrom(service.addTracked('user-rey', 'material-darth-plagueis'));
    expect(first.some((item) => item.id === 'material-darth-plagueis')).toBe(true);
    expect(first.find((item) => item.id === 'material-darth-plagueis')?.status).toBe('Wish Listed');

    const second = await firstValueFrom(service.addTracked('user-rey', 'material-darth-plagueis'));
    expect(second.filter((item) => item.id === 'material-darth-plagueis').length).toBe(1);
  });

  it('ignores adding materials that are not in the catalog', async () => {
    const before = await firstValueFrom(service.getTracked('user-rey'));
    const after = await firstValueFrom(service.addTracked('user-rey', 'material-does-not-exist'));
    expect(after).toEqual(before);
  });

  it('updates the status of a tracked item', async () => {
    const before = await firstValueFrom(service.getTracked('user-padme'));
    const target = before.find((item) => item.status !== 'Completed') ?? before[0];
    const after = await firstValueFrom(service.setStatus('user-padme', target.id, 'Completed'));
    expect(after.find((item) => item.id === target.id)?.status).toBe('Completed');
    expect(before.find((item) => item.id === target.id)?.status).not.toBe('Completed');
  });

  it('toggles the favorite flag of a tracked item', async () => {
    const before = await firstValueFrom(service.getTracked('user-padme'));
    const target = before[0];
    const after = await firstValueFrom(service.toggleFavorite('user-padme', target.id));
    expect(after.find((item) => item.id === target.id)?.favorite).toBe(!target.favorite);
  });

  it('removes an item from tracking entirely', async () => {
    const before = await firstValueFrom(service.getTracked('user-padme'));
    const target = before[0];
    const after = await firstValueFrom(service.removeTracked('user-padme', target.id));
    expect(after.some((item) => item.id === target.id)).toBe(false);
  });

  it('moves a wish listed item within its status group', async () => {
    const initial = await firstValueFrom(service.getTracked('user-padme'));
    const wishListed = initial.filter((item) => item.status === 'Wish Listed');
    const firstId = wishListed[0].id;
    const secondId = wishListed[1].id;

    const movedDown = await firstValueFrom(service.moveTrackedItem('user-padme', firstId, 1));
    const movedWishListedDown = movedDown.filter((item) => item.status === 'Wish Listed');
    expect(movedWishListedDown.map((item) => item.id)).toEqual([secondId, firstId, wishListed[2].id]);

    const movedUp = await firstValueFrom(service.moveTrackedItem('user-padme', firstId, -1));
    const movedWishListedUp = movedUp.filter((item) => item.status === 'Wish Listed');
    expect(movedWishListedUp.map((item) => item.id)).toEqual(wishListed.map((item) => item.id));
  });

  it('clamps moves at the boundaries of the status group', async () => {
    const initial = await firstValueFrom(service.getTracked('user-padme'));
    const wishListed = initial.filter((item) => item.status === 'Wish Listed');
    const lastId = wishListed[wishListed.length - 1].id;

    const moved = await firstValueFrom(service.moveTrackedItem('user-padme', lastId, 1));
    expect(moved).toEqual(initial);
  });

  it('reorders a wish listed item when dropped onto another', async () => {
    const initial = await firstValueFrom(service.getTracked('user-padme'));
    const wishListed = initial.filter((item) => item.status === 'Wish Listed');
    const dragged = wishListed[2].id;
    const target = wishListed[0].id;

    const reordered = await firstValueFrom(service.reorderTrackedItem('user-padme', dragged, target));
    const reorderedWishListed = reordered.filter((item) => item.status === 'Wish Listed');
    expect(reorderedWishListed.map((item) => item.id)).toEqual([dragged, wishListed[0].id, wishListed[1].id]);
  });

  it('leaves the list unchanged when reordering onto itself', async () => {
    const initial = await firstValueFrom(service.getTracked('user-padme'));
    const reordered = await firstValueFrom(
      service.reorderTrackedItem('user-padme', initial[0].id, initial[0].id),
    );
    expect(reordered).toEqual(initial);
  });
});
