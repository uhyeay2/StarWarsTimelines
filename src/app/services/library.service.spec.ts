import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { LibraryService } from './library.service';

const BASE = `${environment.apiBaseUrl}/api/users/user-padme/source-materials`;

const EPISODE_ONE = '00000000-0000-0000-0000-000000000001';
const DARTH_BANE = '00000000-0000-0000-0000-000000000016';

const LIBRARY_DTO = [
  {
    sourceMaterialId: EPISODE_ONE,
    title: 'Star Wars: Episode I - The Phantom Menace',
    medium: 0,
    canonType: 2,
    status: 1,
    isFavorite: true,
    units: [],
  },
  {
    sourceMaterialId: DARTH_BANE,
    title: 'Darth Bane: Path of Destruction',
    medium: 1,
    canonType: 1,
    status: 2,
    isFavorite: false,
    units: [{ id: 'unit-1', unitType: 1, number: 1, title: 'The Menace', isCompleted: true }],
  },
];

describe('LibraryService', () => {
  let service: LibraryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });
    service = TestBed.inject(LibraryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps library items from the API', async () => {
    const promise = firstValueFrom(service.getTracked('user-padme'));
    const request = httpMock.expectOne(BASE);
    expect(request.request.method).toBe('GET');
    request.flush(LIBRARY_DTO);

    const items = await promise;
    expect(items).toEqual([
      {
        id: EPISODE_ONE,
        title: 'Star Wars: Episode I - The Phantom Menace',
        medium: 'Movie',
        status: 'Completed',
        favorite: true,
        units: [],
      },
      {
        id: DARTH_BANE,
        title: 'Darth Bane: Path of Destruction',
        medium: 'Book',
        status: 'Wish Listed',
        favorite: false,
        units: [{ id: 'unit-1', unitType: 'Chapter', number: 1, title: 'The Menace', isCompleted: true }],
      },
    ]);
  });

  it('maps unit group numbers from the API', async () => {
    const promise = firstValueFrom(service.getTracked('user-padme'));
    httpMock.expectOne(BASE).flush([
      {
        ...LIBRARY_DTO[0],
        units: [
          { id: 'unit-1', unitType: 0, groupNumber: 7, number: 9, title: 'The Siege of Mandalore', isCompleted: true },
        ],
      },
    ]);

    const items = await promise;
    expect(items[0].units).toEqual([
      { id: 'unit-1', unitType: 'Episode', groupNumber: 7, number: 9, title: 'The Siege of Mandalore', isCompleted: true },
    ]);
  });

  it('adds a tracked item with the source material id', async () => {
    const promise = firstValueFrom(
      service.addTracked('user-padme', {
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Star Wars: Episode II - Attack of the Clones',
        medium: 'Movie',
      }),
    );
    const post = httpMock.expectOne(BASE);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ sourceMaterialId: '00000000-0000-0000-0000-000000000002' });
    post.flush(null);
    httpMock.expectOne(BASE).flush(LIBRARY_DTO);

    await expect(promise).resolves.toHaveLength(2);
  });

  it('sets the status through the API', async () => {
    const promise = firstValueFrom(service.setStatus('user-padme', EPISODE_ONE, 'Wish Listed'));
    const put = httpMock.expectOne(`${BASE}/${EPISODE_ONE}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ status: 2 });
    put.flush(null);
    httpMock.expectOne(BASE).flush(LIBRARY_DTO);

    await expect(promise).resolves.toHaveLength(2);
  });

  it('sets the favorite flag through the API', async () => {
    const promise = firstValueFrom(service.setFavorite('user-padme', EPISODE_ONE, false));
    const put = httpMock.expectOne(`${BASE}/${EPISODE_ONE}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ isFavorite: false });
    put.flush(null);
    httpMock.expectOne(BASE).flush(LIBRARY_DTO);

    await expect(promise).resolves.toHaveLength(2);
  });

  it('removes a tracked item through the API', async () => {
    const promise = firstValueFrom(service.removeTracked('user-padme', EPISODE_ONE));
    const del = httpMock.expectOne(`${BASE}/${EPISODE_ONE}`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    httpMock.expectOne(BASE).flush(LIBRARY_DTO);

    await expect(promise).resolves.toHaveLength(2);
  });

  it('updates unit progress through the API', async () => {
    const promise = firstValueFrom(service.setUnitProgress('user-padme', DARTH_BANE, 'unit-1', false));
    const put = httpMock.expectOne(`${BASE}/${DARTH_BANE}/units/unit-1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ isCompleted: false });
    put.flush(null);
    httpMock.expectOne(BASE).flush(LIBRARY_DTO);

    await expect(promise).resolves.toHaveLength(2);
  });

  it('reorders the library through the API', async () => {
    const ordered = [DARTH_BANE, EPISODE_ONE];
    const promise = firstValueFrom(service.reorderTrackedItem('user-padme', ordered));
    const put = httpMock.expectOne(`${BASE}/reorder`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ orderedSourceMaterialIds: ordered });
    put.flush(null);
    httpMock.expectOne(BASE).flush(LIBRARY_DTO);

    await expect(promise).resolves.toHaveLength(2);
  });
});
