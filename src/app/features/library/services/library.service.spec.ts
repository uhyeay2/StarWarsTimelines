/**
 * @fileoverview Tests for LibraryService, mapLibraryItem, mapLibraryUnit,
 * and the DTO validation guards.
 */

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LibraryItem, LibraryUnit } from '../../../shared/models/library-item';
import { LibraryError, LibraryErrorCode } from '../models/library-error';
import { environment } from '../../../../environments/environment';
import { LoggerService } from '../../../shared/services/logging/logger.service';
import { LibraryItemDto, LibraryUnitDto } from './library.dto';
import {
  isValidItemDto,
  isValidUnitDto,
  mapLibraryItem,
  mapLibraryUnit,
} from './library.mapper';
import { LibraryService } from './library.service';

// ─── Fixture builders ──────────────────────────────────────────────────────

const UNIT_DTO_A: LibraryUnitDto = {
  id: 101,
  unitType: 0,
  number: 1,
  title: 'Chapter 1',
  status: 0,
  parentUnitId: null,
};

const UNIT_DTO_B: LibraryUnitDto = {
  id: 102,
  unitType: 1,
  number: 3,
  title: null,
  status: 1,
  parentUnitId: null,
};

const ITEM_DTO_A: LibraryItemDto = {
  sourceMaterialId: 10,
  title: 'The High Republic',
  medium: 1,
  canonType: 0,
  status: 0,
  isFavorite: true,
  units: [UNIT_DTO_A, UNIT_DTO_B],
};

const ITEM_DTO_B: LibraryItemDto = {
  sourceMaterialId: 20,
  title: 'Shadows of the Sith',
  medium: 3,
  canonType: 0,
  status: 1,
  isFavorite: false,
  units: [],
};

const UNIT_A: LibraryUnit = {
  id: 101,
  unitType: 'Episode',
  number: 1,
  title: 'Chapter 1',
  status: 'In progress',
};

const UNIT_B: LibraryUnit = {
  id: 102,
  unitType: 'Chapter',
  number: 3,
  status: 'Completed',
};

const UNIT_C: LibraryUnit = {
  id: 103,
  unitType: 'Season',
  number: 1,
  title: 'Season 1',
  status: 'In progress',
};

const UNIT_DTO_C: LibraryUnitDto = {
  id: 103,
  unitType: 3,
  number: 1,
  title: 'Season 1',
  status: 0,
  parentUnitId: null,
};

const ITEM_A: LibraryItem = {
  id: 10,
  title: 'The High Republic',
  medium: 'Book',
  status: 'In progress',
  favorite: true,
  units: [UNIT_A, UNIT_B],
};

const ITEM_B: LibraryItem = {
  id: 20,
  title: 'Shadows of the Sith',
  medium: 'Animated Show',
  status: 'Completed',
  favorite: false,
  units: [],
};

const ITEM_DTO_C: LibraryItemDto = {
  sourceMaterialId: 30,
  title: 'Rebels',
  medium: 4,
  canonType: 0,
  status: 0,
  isFavorite: false,
  units: [UNIT_DTO_C],
};

const _ITEM_C: LibraryItem = {
  id: 30,
  title: 'Rebels',
  medium: 'Live Action Show',
  status: 'Wish Listed',
  favorite: false,
  units: [UNIT_C],
};

const BASE = `${environment.apiBaseUrl}/api/users`;

function makeItemList(dtos: LibraryItemDto[] = [ITEM_DTO_A, ITEM_DTO_B]): readonly LibraryItemDto[] {
  return dtos as readonly LibraryItemDto[];
}

function flushGetRequest(_data: readonly LibraryItemDto[] = makeItemList()) {
  const httpMock = TestBed.inject(HttpTestingController);
  return httpMock.expectOne((req) => req.method === 'GET' && req.url.includes('/source-materials'));
}

// ─── isValidUnitDto ────────────────────────────────────────────────────────

describe('isValidUnitDto', () => {
  it('returns true for a valid unit DTO', () => {
    expect(isValidUnitDto(UNIT_DTO_A)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidUnitDto(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidUnitDto(undefined)).toBe(false);
  });

  it('returns false when id is missing', () => {
    const { id: _, ...rest } = UNIT_DTO_A;
    expect(isValidUnitDto(rest)).toBe(false);
  });

  it('returns false when id is not a number', () => {
    expect(isValidUnitDto({ ...UNIT_DTO_A, id: '101' as unknown as number })).toBe(false);
  });

  it('returns false when unitType is not a number', () => {
    expect(isValidUnitDto({ ...UNIT_DTO_A, unitType: 'abc' })).toBe(false);
  });

  it('returns false when status is not a number or null', () => {
    expect(isValidUnitDto({ ...UNIT_DTO_A, status: 'done' as unknown as number })).toBe(false);
  });

  it('accepts a null status', () => {
    expect(isValidUnitDto({ ...UNIT_DTO_A, status: null })).toBe(true);
  });

  it('accepts a null title', () => {
    expect(isValidUnitDto({ ...UNIT_DTO_A, title: null })).toBe(true);
  });
});

// ─── isValidItemDto ────────────────────────────────────────────────────────

describe('isValidItemDto', () => {
  it('returns true for a valid item DTO', () => {
    expect(isValidItemDto(ITEM_DTO_A)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidItemDto(null)).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isValidItemDto('hello')).toBe(false);
  });

  it('returns false when sourceMaterialId is missing', () => {
    const { sourceMaterialId: _, ...rest } = ITEM_DTO_A;
    expect(isValidItemDto(rest)).toBe(false);
  });

  it('returns false when sourceMaterialId is not a number', () => {
    expect(isValidItemDto({ ...ITEM_DTO_A, sourceMaterialId: '' })).toBe(false);
  });

  it('returns false when units is not an array', () => {
    expect(isValidItemDto({ ...ITEM_DTO_A, units: 'not-an-array' })).toBe(false);
  });

  it('returns false when medium is not a number', () => {
    expect(isValidItemDto({ ...ITEM_DTO_A, medium: 'Book' })).toBe(false);
  });

  it('accepts empty units array', () => {
    expect(isValidItemDto({ ...ITEM_DTO_A, units: [] })).toBe(true);
  });
});

// ─── mapLibraryUnit ────────────────────────────────────────────────────────

describe('mapLibraryUnit', () => {
  it('maps numeric unitType to string union', () => {
    expect(mapLibraryUnit(UNIT_DTO_A)).toEqual(UNIT_A);
  });

  it('converts null parentUnitId to undefined', () => {
    expect(mapLibraryUnit(UNIT_DTO_A).parentUnitId).toBeUndefined();
  });

  it('preserves parentUnitId when present', () => {
    expect(mapLibraryUnit({ ...UNIT_DTO_B, parentUnitId: 55 }).parentUnitId).toBe(55);
  });

  it('converts null title to undefined', () => {
    expect(mapLibraryUnit(UNIT_DTO_B).title).toBeUndefined();
  });

  it('preserves title when present', () => {
    expect(mapLibraryUnit(UNIT_DTO_A).title).toBe('Chapter 1');
  });

  it('preserves the mapped unit status', () => {
    expect(mapLibraryUnit(UNIT_DTO_A).status).toBe('In progress');
    expect(mapLibraryUnit(UNIT_DTO_B).status).toBe('Completed');
  });

  it('preserves id and number', () => {
    const result = mapLibraryUnit(UNIT_DTO_A);
    expect(result.id).toBe(101);
    expect(result.number).toBe(1);
  });
});

// ─── mapLibraryItem ────────────────────────────────────────────────────────

describe('mapLibraryItem', () => {
  it('maps a full DTO to domain model', () => {
    expect(mapLibraryItem(ITEM_DTO_A)).toEqual(ITEM_A);
  });

  it('maps sourceMaterialId to id', () => {
    expect(mapLibraryItem(ITEM_DTO_A).id).toBe(10);
  });

  it('maps numeric medium to string union', () => {
    expect(mapLibraryItem(ITEM_DTO_A).medium).toBe('Book');
    expect(mapLibraryItem(ITEM_DTO_B).medium).toBe('Animated Show');
  });

  it('maps numeric status to string union', () => {
    expect(mapLibraryItem(ITEM_DTO_A).status).toBe('In progress');
    expect(mapLibraryItem(ITEM_DTO_B).status).toBe('Completed');
  });

  it('maps isFavorite to favorite', () => {
    expect(mapLibraryItem(ITEM_DTO_A).favorite).toBe(true);
    expect(mapLibraryItem(ITEM_DTO_B).favorite).toBe(false);
  });

  it('maps units array via mapLibraryUnit', () => {
    const result = mapLibraryItem(ITEM_DTO_A);
    expect(result.units).toHaveLength(2);
    expect(result.units![0]).toEqual(UNIT_A);
    expect(result.units![1]).toEqual(UNIT_B);
  });

  it('returns empty units as readonly array', () => {
    const result = mapLibraryItem(ITEM_DTO_B);
    expect(result.units).toEqual([]);
  });

  it('drops invalid unit entries gracefully', () => {
    const dtoWithBadUnit: LibraryItemDto = {
      ...ITEM_DTO_A,
      units: [UNIT_DTO_A, { id: '', unitType: 0, number: 1, title: null, status: 0 } as unknown as LibraryUnitDto],
    };
    const result = mapLibraryItem(dtoWithBadUnit);
    expect(result.units).toHaveLength(1);
    expect(result.units![0]!.id).toBe(101);
  });
});

// ─── LibraryService ────────────────────────────────────────────────────────

describe('LibraryService', () => {
  let service: LibraryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LoggerService, useValue: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      ],
    });
    service = TestBed.inject(LibraryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  // ── Signal defaults ────────────────────────────────────────────────────

  describe('signal defaults', () => {
    it('starts with empty items', () => {
      expect(service.items()).toEqual([]);
    });

    it('starts with loading false', () => {
      expect(service.loading()).toBe(false);
    });

    it('starts with error null', () => {
      expect(service.error()).toBeNull();
    });
  });

  // ── getTracked ────────────────────────────────────────────────────────

  describe('getTracked', () => {
    it('returns items with mapped enums', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      expect(await promise).toEqual([ITEM_A, ITEM_B]);
    });

    it('updates the items signal on success', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      await promise;
      expect(service.items()).toEqual([ITEM_A, ITEM_B]);
    });

    it('sets loading signal during fetch', async () => {
      expect(service.loading()).toBe(false);
      const promise = firstValueFrom(service.getTracked('u1'));
      expect(service.loading()).toBe(true);
      flushGetRequest().flush(makeItemList());
      await promise;
      expect(service.loading()).toBe(false);
    });

    it('sets error signal on failure', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Error', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toBeInstanceOf(LibraryError);
      expect(service.error()).toBeTruthy();
    });

    it('clears error signal on success', async () => {
      service.error.set('previous error');
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      await promise;
      expect(service.error()).toBeNull();
    });

    it('filters out invalid DTOs gracefully', async () => {
      const mixed = [{ ...ITEM_DTO_A }, { sourceMaterialId: '' }] as unknown as readonly LibraryItemDto[];
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(mixed);
      const items = await promise;
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe(10);
    });

    it('throws LibraryError with NotFound code on 404', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Not Found', { status: 404, statusText: 'Not Found' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.NotFound });
    });

    it('throws LibraryError with NetworkError code on 500', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Server Error', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.NetworkError });
    });

    it('throws LibraryError with ValidationError code on 400', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Bad Request', { status: 400, statusText: 'Bad Request' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.ValidationError });
    });

    it('logs with structured metadata', async () => {
      const logger = TestBed.inject(LoggerService);
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Error', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toBeInstanceOf(LibraryError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[LibraryService] getTracked'),
        expect.objectContaining({ userId: 'u1', status: 500 }),
      );
    });
  });

  // ── Retry logic ───────────────────────────────────────────────────────

  describe('retry on transient errors', () => {
    it('retries on 503 and succeeds on the second attempt', async () => {
      vi.useFakeTimers();

      let result: readonly LibraryItem[] | undefined;
      service.getTracked('u1').subscribe({
        next: (items) => result = items,
      });

      const firstReq = httpMock.expectOne((req) => req.method === 'GET' && req.url.includes('/source-materials'));
      firstReq.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });

      await vi.advanceTimersByTimeAsync(1000);

      const retryReq = httpMock.expectOne((req) => req.method === 'GET' && req.url.includes('/source-materials'));
      retryReq.flush(makeItemList());

      expect(result).toEqual([ITEM_A, ITEM_B]);

      vi.useRealTimers();
    });

    it('retries on 504 and succeeds on the second attempt', async () => {
      vi.useFakeTimers();

      let result: readonly LibraryItem[] | undefined;
      service.getTracked('u1').subscribe({
        next: (items) => result = items,
      });

      const firstReq = httpMock.expectOne((req) => req.method === 'GET' && req.url.includes('/source-materials'));
      firstReq.flush('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' });

      await vi.advanceTimersByTimeAsync(1000);

      const retryReq = httpMock.expectOne((req) => req.method === 'GET' && req.url.includes('/source-materials'));
      retryReq.flush(makeItemList());

      expect(result).toEqual([ITEM_A, ITEM_B]);

      vi.useRealTimers();
    });

    it('does NOT retry on 500 (non-transient)', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Server Error', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.NetworkError });
    });

    it('does NOT retry on 400', async () => {
      const promise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush('Bad Request', { status: 400, statusText: 'Bad Request' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.ValidationError });
    });
  });

  // ── addTracked ────────────────────────────────────────────────────────

  describe('addTracked', () => {
    it('POSTs the typed request body and returns refreshed items', async () => {
      const promise = firstValueFrom(service.addTracked('u1', ITEM_B));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ sourceMaterialId: 20 });
      req.flush({}, { status: 200, statusText: 'OK' });
      flushGetRequest().flush(makeItemList());
      expect(await promise).toEqual([ITEM_A, ITEM_B]);
    });

    it('updates the items signal after mutation', async () => {
      const promise = firstValueFrom(service.addTracked('u1', ITEM_B));
      httpMock.expectOne(`${BASE}/u1/source-materials`).flush({}, { status: 200, statusText: 'OK' });
      flushGetRequest().flush(makeItemList());
      await promise;
      expect(service.items()).toEqual([ITEM_A, ITEM_B]);
    });

    it('throws LibraryError with ValidationError code on 400', async () => {
      const promise = firstValueFrom(service.addTracked('u1', ITEM_B));
      httpMock.expectOne(`${BASE}/u1/source-materials`).flush(
        { detail: 'Cannot add.' },
        { status: 400, statusText: 'Bad Request' },
      );
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.ValidationError, message: 'Cannot add.' });
    });

    it('logs structured metadata including material info', async () => {
      const logger = TestBed.inject(LoggerService);
      const promise = firstValueFrom(service.addTracked('u1', ITEM_B));
      httpMock.expectOne(`${BASE}/u1/source-materials`).flush('Error', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toBeInstanceOf(LibraryError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('addTracked'),
        expect.objectContaining({ userId: 'u1', title: 'Shadows of the Sith' }),
      );
    });
  });

  // ── setStatus (partial reload) ────────────────────────────────────────

  describe('setStatus', () => {
    it('PUTs the typed request body and performs a partial reload', async () => {
      const setupPromise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      await setupPromise;

      const promise = firstValueFrom(service.setStatus('u1', 10, 'Completed'));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/10`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ status: 1 });
      req.flush({}, { status: 200, statusText: 'OK' });

      const reloadReq = httpMock.expectOne(`${BASE}/u1/source-materials/10`);
      expect(reloadReq.request.method).toBe('GET');
      reloadReq.flush(ITEM_DTO_A);

      const items = await promise;
      expect(items).toHaveLength(2);
      expect(items.map(i => i.id)).toEqual([10, 20]);
    });

    it('throws LibraryError with NotFound code on 404', async () => {
      const promise = firstValueFrom(service.setStatus('u1', 99, 'Completed'));
      httpMock.expectOne(`${BASE}/u1/source-materials/99`).flush('Not Found', { status: 404, statusText: 'Not Found' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.NotFound });
    });

    it('appends the reloaded item to the cache when tracking a material not yet in the library', async () => {
      const setupPromise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList([ITEM_DTO_A]));
      await setupPromise;
      expect(service.items().map((i) => i.id)).toEqual([10]);

      const promise = firstValueFrom(service.setStatus('u1', 30, 'Wish Listed'));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/30`);
      expect(req.request.method).toBe('PUT');
      req.flush({}, { status: 200, statusText: 'OK' });

      const reloadReq = httpMock.expectOne(`${BASE}/u1/source-materials/30`);
      reloadReq.flush(ITEM_DTO_C);

      const items = await promise;
      expect(items.map((i) => i.id)).toEqual([10, 30]);
      expect(service.items().map((i) => i.id)).toEqual([10, 30]);
    });
  });

  // ── setFavorite (partial reload) ──────────────────────────────────────

  describe('setFavorite', () => {
    it('PUTs the typed request body and performs a partial reload', async () => {
      const setupPromise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      await setupPromise;

      const promise = firstValueFrom(service.setFavorite('u1', 10, false));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/10`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ isFavorite: false });
      req.flush({}, { status: 200, statusText: 'OK' });

      const reloadReq = httpMock.expectOne(`${BASE}/u1/source-materials/10`);
      reloadReq.flush(ITEM_DTO_A);

      const items = await promise;
      expect(items).toHaveLength(2);
      expect(items.map(i => i.id)).toEqual([10, 20]);
    });

    it('throws LibraryError with ValidationError code on 400', async () => {
      const promise = firstValueFrom(service.setFavorite('u1', 10, true));
      httpMock.expectOne(`${BASE}/u1/source-materials/10`).flush('Bad Request', { status: 400, statusText: 'Bad Request' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.ValidationError });
    });
  });

  // ── removeTracked (full reload) ───────────────────────────────────────

  describe('removeTracked', () => {
    it('DELETEs the material and performs a full reload', async () => {
      const promise = firstValueFrom(service.removeTracked('u1', 10));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/10`);
      expect(req.request.method).toBe('DELETE');
      req.flush({}, { status: 200, statusText: 'OK' });
      flushGetRequest().flush(makeItemList());
      expect(await promise).toEqual([ITEM_A, ITEM_B]);
    });

    it('throws LibraryError with NotFound code on 404', async () => {
      const promise = firstValueFrom(service.removeTracked('u1', 99));
      httpMock.expectOne(`${BASE}/u1/source-materials/99`).flush('Not Found', { status: 404, statusText: 'Not Found' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.NotFound });
    });
  });

  // ── setUnitProgress (partial reload) ──────────────────────────────────

  describe('setUnitProgress', () => {
    it('PUTs the typed request body to the correct unit URL and performs a partial reload', async () => {
      const setupPromise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      await setupPromise;

      const promise = firstValueFrom(service.setUnitProgress('u1', 10, 101, 'Completed'));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/10/units/101`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ status: 1 });
      req.flush({}, { status: 200, statusText: 'OK' });

      const reloadReq = httpMock.expectOne(`${BASE}/u1/source-materials/10`);
      reloadReq.flush(ITEM_DTO_A);

      const items = await promise;
      expect(items).toHaveLength(2);
      expect(items.map(i => i.id)).toEqual([10, 20]);
    });

    it('throws LibraryError with ValidationError code on 400', async () => {
      const promise = firstValueFrom(service.setUnitProgress('u1', 10, 101, 'In progress'));
      httpMock.expectOne(`${BASE}/u1/source-materials/10/units/101`).flush('Bad Request', { status: 400, statusText: 'Bad Request' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.ValidationError });
    });
  });

  // ── clearUnitProgress (full reload) ───────────────────────────────────

  describe('clearUnitProgress', () => {
    it('DELETEs the unit progress URL and performs a full reload', async () => {
      const promise = firstValueFrom(service.clearUnitProgress('u1', 10, 102));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/10/units/102`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      flushGetRequest().flush(makeItemList());
      expect(await promise).toEqual([ITEM_A, ITEM_B]);
    });

    it('throws LibraryError with NotFound code on 404', async () => {
      const promise = firstValueFrom(service.clearUnitProgress('u1', 99, 101));
      httpMock.expectOne(`${BASE}/u1/source-materials/99/units/101`).flush('Not Found', { status: 404, statusText: 'Not Found' });
      await expect(promise).rejects.toMatchObject({ code: LibraryErrorCode.NotFound });
    });
  });

  // ── reorderTrackedItem (full reload) ──────────────────────────────────

  describe('reorderTrackedItem', () => {
    it('PUTs the typed request body and performs a full reload', async () => {
      const promise = firstValueFrom(service.reorderTrackedItem('u1', [20, 10]));
      const req = httpMock.expectOne(`${BASE}/u1/source-materials/reorder`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ orderedSourceMaterialIds: [20, 10] });
      req.flush({}, { status: 200, statusText: 'OK' });
      flushGetRequest().flush(makeItemList());
      expect(await promise).toEqual([ITEM_A, ITEM_B]);
    });

    it('accepts readonly array input without error', async () => {
      const ids: readonly number[] = [10];
      const promise = firstValueFrom(service.reorderTrackedItem('u1', ids));
      httpMock.expectOne(`${BASE}/u1/source-materials/reorder`).flush({}, { status: 200, statusText: 'OK' });
      flushGetRequest().flush(makeItemList());
      expect(await promise).toEqual([ITEM_A, ITEM_B]);
    });
  });

  // ── Reload error wrapping ─────────────────────────────────────────────

  describe('reload error wrapping', () => {
    it('wraps a reload failure after a successful mutation in LibraryError', async () => {
      const setupPromise = firstValueFrom(service.getTracked('u1'));
      flushGetRequest().flush(makeItemList());
      await setupPromise;

      const promise = firstValueFrom(service.setFavorite('u1', 10, false));

      httpMock.expectOne(`${BASE}/u1/source-materials/10`).flush({}, { status: 200, statusText: 'OK' });

      httpMock.expectOne(`${BASE}/u1/source-materials/10`).flush('Server Error', { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toMatchObject({
        code: LibraryErrorCode.NetworkError,
        message: 'Reload failed after mutation.',
      });
    });
  });

  // ── Reload debounce ─────────────────────────────────────────────────

  describe('reload debounce', () => {
    it('coalesces rapid reload() calls into a single fetch', async () => {
      vi.useFakeTimers();

      service.reload();
      service.reload();
      service.reload();

      await vi.advanceTimersByTimeAsync(200);

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.includes('/source-materials'));
      expect(req.request.method).toBe('GET');
      req.flush(makeItemList());

      expect(service.items()).toEqual([ITEM_A, ITEM_B]);

      vi.useRealTimers();
    });
  });
});
