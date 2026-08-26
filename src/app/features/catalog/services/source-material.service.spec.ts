import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogError, DuplicateEntityError, EntityInUseError } from '../models/catalog-error';
import { SourceMaterialService } from './source-material.service';
import { SourceMaterialDto, SourceMaterialUnitDto } from './catalog.dto';

const BASE = `${environment.apiBaseUrl}/api/source-materials`;

const MATERIAL_DTO: SourceMaterialDto = { id: 1, title: 'A New Hope', medium: 0, canonType: 0 };
const MATERIAL = {
  id: 1,
  title: 'A New Hope',
  medium: 'Movie' as const,
  canonType: 'Canon' as const,
};

const UNIT_DTO: SourceMaterialUnitDto = {
  id: 10,
  sourceMaterialId: 1,
  unitType: 0,
  number: 1,
  title: 'Episode IV',
  parentUnitId: null,
};
const UNIT = {
  id: 10,
  sourceMaterialId: 1,
  unitType: 'Episode' as const,
  number: 1,
  title: 'Episode IV',
  parentUnitId: null,
};

describe('SourceMaterialService', () => {
  let service: SourceMaterialService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SourceMaterialService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchSourceMaterials', () => {
    it('maps numeric enum codes to string unions on fetch', () => {
      expect(service.sourceMaterials()).toBeNull();

      service.fetchSourceMaterials();
      httpMock.expectOne(BASE).flush([MATERIAL_DTO]);

      const items = service.sourceMaterials()!;
      expect(items).toEqual([MATERIAL]);
      expect(items[0]!.medium).toBe('Movie');
      expect(items[0]!.canonType).toBe('Canon');
    });

    it('maps medium code 1 to Book', () => {
      service.fetchSourceMaterials();
      httpMock
        .expectOne(BASE)
        .flush([{ id: 2, title: 'Heir to the Empire', medium: 1, canonType: 1 }]);

      const item = service.sourceMaterials()![0]!;
      expect(item.medium).toBe('Book');
      expect(item.canonType).toBe('Legends');
    });

    it('sets loading signal during fetch', () => {
      expect(service.sourceMaterialsLoading()).toBe(false);

      service.fetchSourceMaterials();
      expect(service.sourceMaterialsLoading()).toBe(true);

      httpMock.expectOne(BASE).flush([MATERIAL_DTO]);
      expect(service.sourceMaterialsLoading()).toBe(false);
    });

    it('sets error signal on failure', () => {
      service.fetchSourceMaterials();
      httpMock.expectOne(BASE).flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.sourceMaterialsError()).toBeTruthy();
      expect(service.sourceMaterials()).toBeNull();
    });
  });

  describe('createSourceMaterial', () => {
    it('POSTs with enum-to-code mapping and returns mapped result', async () => {
      const promise = firstValueFrom(
        service.createSourceMaterial({
          title: 'The Empire Strikes Back',
          medium: 'Movie',
          canonType: 'Canon',
        }),
      );

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        title: 'The Empire Strikes Back',
        medium: 0,
        canonType: 0,
      });
      req.flush({ id: 2, title: 'The Empire Strikes Back', medium: 0, canonType: 0 });

      const created = await promise;
      expect(created.title).toBe('The Empire Strikes Back');
      expect(created.medium).toBe('Movie');
      expect(created.canonType).toBe('Canon');

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('updateSourceMaterial', () => {
    it('PUTs with enum-to-code mapping to the material URL', async () => {
      const promise = firstValueFrom(
        service.updateSourceMaterial(1, {
          title: 'A New Hope (Special Edition)',
          medium: 'Movie',
          canonType: 'Canon & Legends',
        }),
      );

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        title: 'A New Hope (Special Edition)',
        medium: 0,
        canonType: 2,
      });
      req.flush({ id: 1, title: 'A New Hope (Special Edition)', medium: 0, canonType: 2 });

      const updated = await promise;
      expect(updated.title).toBe('A New Hope (Special Edition)');
      expect(updated.canonType).toBe('Canon & Legends');

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('deleteSourceMaterial', () => {
    it('sends DELETE and invalidates both materials and unit caches', async () => {
      service.fetchSourceMaterials();
      httpMock.expectOne(BASE).flush([MATERIAL_DTO]);

      const unitCache = service.getUnitCache(1);
      unitCache.fetch();
      httpMock.expectOne(`${BASE}/1/units`).flush([UNIT_DTO]);
      expect(unitCache.data()).toEqual([UNIT]);

      const promise = firstValueFrom(service.deleteSourceMaterial(1));
      httpMock.expectOne(`${BASE}/1`).flush(null);
      await promise;

      httpMock.expectOne(BASE).flush([]);
      httpMock.expectOne(`${BASE}/1/units`).flush([]);
      expect(service.sourceMaterials()).toEqual([]);
      expect(unitCache.data()).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws EntityInUseError on material delete 409', async () => {
      const promise = firstValueFrom(service.deleteSourceMaterial(1));
      httpMock
        .expectOne(`${BASE}/1`)
        .flush(
          { detail: 'Source material is referenced by events' },
          { status: 409, statusText: 'Conflict' },
        );

      await expect(promise).rejects.toBeInstanceOf(EntityInUseError);
    });

    it('throws DuplicateEntityError on unit create 409', async () => {
      const promise = firstValueFrom(
        service.createSourceMaterialUnit(1, {
          unitType: 'Episode',
          number: 1,
          title: 'Ep 1',
          parentUnitId: null,
        }),
      );
      httpMock
        .expectOne(`${BASE}/1/units`)
        .flush({ detail: 'Unit number already exists' }, { status: 409, statusText: 'Conflict' });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(DuplicateEntityError);
      expect(err.code).toBe('duplicate-entity');
    });

    it('throws CatalogError with code not-found on 404', async () => {
      const promise = firstValueFrom(service.deleteSourceMaterial(999));
      httpMock
        .expectOne(`${BASE}/999`)
        .flush({ detail: 'Source material not found' }, { status: 404, statusText: 'Not Found' });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('not-found');
    });

    it('throws CatalogError with code network-error on 500', async () => {
      const promise = firstValueFrom(service.deleteSourceMaterial(1));
      httpMock.expectOne(`${BASE}/1`).flush('Error', {
        status: 500,
        statusText: 'Server Error',
      });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('network-error');
    });
  });

  describe('unit cache', () => {
    it('getUnitCache fetches and maps units via GET', () => {
      const cache = service.getUnitCache(1);
      cache.fetch();
      httpMock.expectOne(`${BASE}/1/units`).flush([UNIT_DTO]);

      expect(cache.data()).toEqual([UNIT]);
    });

    it('maps unitType numeric code to string union', () => {
      const cache = service.getUnitCache(1);
      cache.fetch();
      httpMock.expectOne(`${BASE}/1/units`).flush([
        {
          id: 10,
          sourceMaterialId: 1,
          unitType: 3,
          number: 1,
          title: 'Season 1',
          parentUnitId: null,
        },
      ]);

      expect(cache.data()![0]!.unitType).toBe('Season');
    });

    it('returns the same cache instance for the same material ID', () => {
      const a = service.getUnitCache(1);
      const b = service.getUnitCache(1);
      expect(a).toBe(b);
    });

    it('returns different caches for different material IDs', () => {
      const a = service.getUnitCache(1);
      const b = service.getUnitCache(2);
      expect(a).not.toBe(b);
    });
  });

  describe('convertStandaloneBookToCollection', () => {
    it('POSTs the collection title and returns mapped units', async () => {
      const promise = firstValueFrom(
        service.convertStandaloneBookToCollection(1, 'Thrawn Trilogy'),
      );

      const req = httpMock.expectOne(`${BASE}/1/convert-to-collection`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ collectionTitle: 'Thrawn Trilogy' });
      req.flush([
        {
          id: 20,
          sourceMaterialId: 1,
          unitType: 6,
          number: 1,
          title: 'Collection',
          parentUnitId: null,
        },
        {
          id: 21,
          sourceMaterialId: 1,
          unitType: 7,
          number: 1,
          title: 'Heir to the Empire',
          parentUnitId: 20,
        },
      ]);

      const units = await promise;
      expect(units).toHaveLength(2);
      expect(units[0]!.unitType).toBe('Collection');
      expect(units[1]!.unitType).toBe('Book');
      expect(units[1]!.parentUnitId).toBe(20);

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('probeUnitPresence and checkProbeResults', () => {
    it('returns empty set when materials cache is empty', () => {
      expect(service.checkProbeResults()).toEqual(new Set());
    });

    it('returns null while probes are still loading', () => {
      service.fetchSourceMaterials();
      httpMock.expectOne(BASE).flush([MATERIAL_DTO]);

      service.probeUnitPresence();
      expect(service.checkProbeResults()).toBeNull();

      httpMock.expectOne(`${BASE}/1/units`).flush([]);
    });

    it('returns set of material IDs that have units after probes complete', () => {
      service.fetchSourceMaterials();
      httpMock.expectOne(BASE).flush([MATERIAL_DTO]);

      service.probeUnitPresence();
      httpMock.expectOne(`${BASE}/1/units`).flush([UNIT_DTO]);

      const result = service.checkProbeResults();
      expect(result).toEqual(new Set([1]));
    });

    it('excludes materials with empty unit lists', () => {
      service.fetchSourceMaterials();
      httpMock.expectOne(BASE).flush([MATERIAL_DTO]);

      service.probeUnitPresence();
      httpMock.expectOne(`${BASE}/1/units`).flush([]);

      const result = service.checkProbeResults();
      expect(result).toEqual(new Set());
    });
  });
});
