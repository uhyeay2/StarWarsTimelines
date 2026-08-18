import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CatalogError, EntityInUseError } from '../../models/catalog/catalog-error';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchSourceMaterials', () => {
    it('fetches source materials and maps numeric enums into the signal', () => {
      service.fetchSourceMaterials();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      request.flush([
        {
          id: '00000000-0000-0000-0000-000000000004',
          title: 'Star Wars: Episode IV - A New Hope',
          medium: 0,
          canonType: 0,
        },
        {
          id: '00000000-0000-0000-0000-000000000006',
          title: 'Star Wars: Episode V - The Empire Strikes Back',
          medium: 0,
          canonType: 2,
        },
      ]);

      expect(service.sourceMaterials()).toEqual([
        {
          id: '00000000-0000-0000-0000-000000000004',
          title: 'Star Wars: Episode IV - A New Hope',
          medium: 'Movie',
          canonType: 'Canon',
        },
        {
          id: '00000000-0000-0000-0000-000000000006',
          title: 'Star Wars: Episode V - The Empire Strikes Back',
          medium: 'Movie',
          canonType: 'Canon & Legends',
        },
      ]);
    });

    it('sets error signal when a source material has an unknown medium code', () => {
      service.fetchSourceMaterials();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      request.flush([{ id: '00000000-0000-0000-0000-000000000001', title: 'Unknown', medium: 99, canonType: 0 }]);

      expect(service.sourceMaterialsError()).toBe('Failed to load source materials');
      expect(service.sourceMaterials()).toBeNull();
    });
  });

  describe('fetchCharacters', () => {
    it('fetches characters into the signal', () => {
      service.fetchCharacters();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      request.flush([{ id: '00000000-0000-0000-0000-100000000001', name: 'Luke Skywalker' }]);

      expect(service.characters()).toEqual([
        { id: '00000000-0000-0000-0000-100000000001', name: 'Luke Skywalker' },
      ]);
    });
  });

  describe('fetchLocations', () => {
    it('fetches locations into the signal', () => {
      service.fetchLocations();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
      request.flush([{ id: '00000000-0000-0000-0000-200000000001', name: 'Tatooine' }]);

      expect(service.locations()).toEqual([
        { id: '00000000-0000-0000-0000-200000000001', name: 'Tatooine' },
      ]);
    });
  });

  describe('fetchVehicles', () => {
    it('fetches vehicles into the signal', () => {
      service.fetchVehicles();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
      request.flush([{ id: '00000000-0000-0000-0000-300000000001', name: 'Millennium Falcon' }]);

      expect(service.vehicles()).toEqual([
        { id: '00000000-0000-0000-0000-300000000001', name: 'Millennium Falcon' },
      ]);
    });
  });

  describe('getUnitCache', () => {
    it('fetches units and maps the numeric unit type', () => {
      const cache = service.getUnitCache('00000000-0000-0000-0000-000000000012');
      cache.fetch();

      const request = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units'),
      );
      request.flush([
        {
          id: '00000000-0000-0000-0000-500000000025',
          sourceMaterialId: '00000000-0000-0000-0000-000000000012',
          unitType: 0,
          groupNumber: 1,
          number: 1,
          title: 'Chapter 1: The Mandalorian',
        },
        {
          id: '00000000-0000-0000-0000-500000000037',
          sourceMaterialId: '00000000-0000-0000-0000-000000000019',
          unitType: 1,
          groupNumber: null,
          number: 2,
          title: null,
        },
      ]);

      expect(cache.data()).toEqual([
        {
          id: '00000000-0000-0000-0000-500000000025',
          sourceMaterialId: '00000000-0000-0000-0000-000000000012',
          unitType: 'Episode',
          groupNumber: 1,
          number: 1,
          title: 'Chapter 1: The Mandalorian',
        },
        {
          id: '00000000-0000-0000-0000-500000000037',
          sourceMaterialId: '00000000-0000-0000-0000-000000000019',
          unitType: 'Chapter',
          groupNumber: null,
          number: 2,
          title: null,
        },
      ]);
    });
  });

  describe('createCharacter', () => {
    it('posts the name and auto-invalidates the characters cache', () => {
      service.fetchCharacters();
      const listReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      listReq.flush([{ id: 'existing', name: 'Existing' }]);

      let created: unknown;
      service.createCharacter('Luke Skywalker').subscribe((c) => (created = c));

      const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/characters'));
      expect(request.request.body).toEqual({ name: 'Luke Skywalker' });
      request.flush({ id: '00000000-0000-0000-0000-100000000099', name: 'Luke Skywalker' });

      expect(created).toEqual({
        id: '00000000-0000-0000-0000-100000000099',
        name: 'Luke Skywalker',
      });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });
  });

  describe('updateCharacter', () => {
    it('puts the name and auto-invalidates the characters cache', () => {
      service.updateCharacter('00000000-0000-0000-0000-100000000001', 'New name').subscribe();

      const request = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/characters/00000000-0000-0000-0000-100000000001'));
      expect(request.request.body).toEqual({ name: 'New name' });
      request.flush({ id: '00000000-0000-0000-0000-100000000001', name: 'New name' });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });
  });

  describe('deleteCharacter', () => {
    it('deletes and auto-invalidates the characters cache', () => {
      service.deleteCharacter('00000000-0000-0000-0000-100000000001').subscribe();

      const request = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/characters/00000000-0000-0000-0000-100000000001'));
      request.flush(null, { status: 204, statusText: 'No Content' });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });

    it('surfaces the problem detail when deleting a referenced character', () => {
      let caughtError: unknown;
      service.deleteCharacter('00000000-0000-0000-0000-100000000001').subscribe({
        error: (err) => (caughtError = err),
      });

      const request = httpMock.expectOne((r) => r.method === 'DELETE');
      request.flush(
        { title: 'Conflict', detail: 'Character is linked to one or more timeline events.' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(caughtError).toBeInstanceOf(EntityInUseError);
      expect((caughtError as Error).message).toBe('Character is linked to one or more timeline events.');
    });

    it('wraps a 404 as CatalogError with code not-found', () => {
      let caughtError: unknown;
      service.deleteCharacter('00000000-0000-0000-0000-999999999999').subscribe({
        error: (err) => (caughtError = err),
      });

      const request = httpMock.expectOne((r) => r.method === 'DELETE');
      request.flush(
        { title: 'Not Found', detail: 'Character not found.' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(caughtError).toBeInstanceOf(CatalogError);
      expect((caughtError as Error).message).toBe('Character not found.');
    });

    it('wraps a 500 as CatalogError with code network-error', () => {
      let caughtError: unknown;
      service.deleteCharacter('00000000-0000-0000-0000-100000000001').subscribe({
        error: (err) => (caughtError = err),
      });

      const request = httpMock.expectOne((r) => r.method === 'DELETE');
      request.flush(
        { title: 'Internal Server Error', detail: 'Something went wrong.' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(caughtError).toBeInstanceOf(CatalogError);
      expect((caughtError as Error).message).toBe('Something went wrong.');
    });
  });

  describe('createSourceMaterial', () => {
    it('posts with mapped enum codes and auto-invalidates the cache', () => {
      service.createSourceMaterial({ title: 'Ahsoka', medium: 'Live Action Show', canonType: 'Canon' }).subscribe();

      const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials'));
      expect(request.request.body).toEqual({ title: 'Ahsoka', medium: 4, canonType: 0 });
      request.flush({ id: '00000000-0000-0000-0000-000000000099', title: 'Ahsoka', medium: 4, canonType: 0 });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      refetchReq.flush([]);
      expect(service.sourceMaterials()).toEqual([]);
    });
  });

  describe('updateSourceMaterial', () => {
    it('puts with mapped enum codes and auto-invalidates the cache', () => {
      service
        .updateSourceMaterial('00000000-0000-0000-0000-000000000099', {
          title: 'Ahsoka S2',
          medium: 'Live Action Show',
          canonType: 'Legends',
        })
        .subscribe();

      const request = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000099'));
      expect(request.request.body).toEqual({ title: 'Ahsoka S2', medium: 4, canonType: 1 });
      request.flush({ id: '00000000-0000-0000-0000-000000000099', title: 'Ahsoka S2', medium: 4, canonType: 1 });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      refetchReq.flush([]);
      expect(service.sourceMaterials()).toEqual([]);
    });
  });

  describe('createSourceMaterialUnit', () => {
    it('posts with mapped unit type and auto-invalidates the unit cache', () => {
      const cache = service.getUnitCache('00000000-0000-0000-0000-000000000012');

      service
        .createSourceMaterialUnit('00000000-0000-0000-0000-000000000012', {
          unitType: 'Episode',
          groupNumber: 2,
          number: 9,
          title: null,
        })
        .subscribe();

      const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units'));
      expect(request.request.body).toEqual({ unitType: 0, groupNumber: 2, number: 9, title: null });
      request.flush({
        id: '00000000-0000-0000-0000-500000000099',
        sourceMaterialId: '00000000-0000-0000-0000-000000000012',
        unitType: 0,
        groupNumber: 2,
        number: 9,
        title: null,
      });

      // Unit cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units'),
      );
      refetchReq.flush([]);
      expect(cache.data()).toEqual([]);
    });
  });

  describe('deleteSourceMaterialUnit', () => {
    it('deletes and auto-invalidates the unit cache', () => {
      const cache = service.getUnitCache('00000000-0000-0000-0000-000000000012');

      service
        .deleteSourceMaterialUnit('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-500000000099')
        .subscribe();

      const request = httpMock.expectOne(
        (r) => r.method === 'DELETE' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units/00000000-0000-0000-0000-500000000099'),
      );
      request.flush(null, { status: 204, statusText: 'No Content' });

      // Unit cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units'),
      );
      refetchReq.flush([]);
      expect(cache.data()).toEqual([]);
    });
  });

  describe('invalidateEntity', () => {
    it('invalidates the characters cache on characters event', () => {
      service.fetchCharacters();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      req.flush([{ id: '1', name: 'Luke' }]);
      expect(service.characters()).toEqual([{ id: '1', name: 'Luke' }]);

      service.invalidateEntity('characters');

      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });

    it('invalidates all unit caches on source-material-units event without ID', () => {
      const cache = service.getUnitCache('mat-1');
      cache.fetch();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      req.flush([{ id: 'u1', sourceMaterialId: 'mat-1', unitType: 0, groupNumber: null, number: 1, title: null }]);
      expect(cache.data()!.length).toBe(1);

      service.invalidateEntity('source-material-units');

      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      refetchReq.flush([]);
      expect(cache.data()).toEqual([]);
    });

    it('invalidates only the affected unit cache when a unit ID is provided', () => {
      const cache1 = service.getUnitCache('mat-1');
      cache1.fetch();
      const req1 = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      req1.flush([{ id: 'unit-a', sourceMaterialId: 'mat-1', unitType: 0, groupNumber: null, number: 1, title: null }]);

      const cache2 = service.getUnitCache('mat-2');
      cache2.fetch();
      const req2 = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-2/units'));
      req2.flush([{ id: 'unit-b', sourceMaterialId: 'mat-2', unitType: 0, groupNumber: null, number: 1, title: null }]);

      expect(cache1.data()!.length).toBe(1);
      expect(cache2.data()!.length).toBe(1);

      service.invalidateEntity('source-material-units', 'unit-a');

      // Only cache1 should be invalidated
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      refetchReq.flush([]);
      expect(cache1.data()).toEqual([]);

      // cache2 should remain untouched
      httpMock.expectNone((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-2/units'));
      expect(cache2.data()!.length).toBe(1);
    });

    it('does nothing for a unit ID not found in any loaded cache', () => {
      const cache = service.getUnitCache('mat-1');
      cache.fetch();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      req.flush([{ id: 'unit-a', sourceMaterialId: 'mat-1', unitType: 0, groupNumber: null, number: 1, title: null }]);

      service.invalidateEntity('source-material-units', 'unit-unknown');

      httpMock.expectNone((r) => r.method === 'GET' && r.url.includes('/units'));
      expect(cache.data()!.length).toBe(1);
    });

    it('invalidates the specific unit cache on source-materials event with ID', () => {
      const cache = service.getUnitCache('mat-1');
      cache.fetch();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      req.flush([{ id: 'u1', sourceMaterialId: 'mat-1', unitType: 0, groupNumber: null, number: 1, title: null }]);
      expect(cache.data()!.length).toBe(1);

      // Also load source materials
      service.fetchSourceMaterials();
      const smReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smReq.flush([]);

      service.invalidateEntity('source-materials', 'mat-1');

      // Source materials collection should be invalidated
      const smRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smRefetch.flush([]);

      // The specific unit cache should also be invalidated
      const unitRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/mat-1/units'));
      unitRefetch.flush([]);
      expect(cache.data()).toEqual([]);
    });

    it('ignores unknown entity types', () => {
      service.invalidateEntity('unknown-entity');
      httpMock.expectNone(() => true);
    });
  });

  describe('invalidateAll', () => {
    it('invalidates all caches', () => {
      service.fetchCharacters();
      const charReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      charReq.flush([{ id: '1', name: 'Luke' }]);

      service.fetchLocations();
      const locReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
      locReq.flush([]);

      service.fetchVehicles();
      const vehReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
      vehReq.flush([]);

      service.fetchSourceMaterials();
      const smReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smReq.flush([]);

      service.invalidateAll();

      const charRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      charRefetch.flush([]);
      const locRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
      locRefetch.flush([]);
      const vehRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
      vehRefetch.flush([]);
      const smRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smRefetch.flush([]);

      expect(service.characters()).toEqual([]);
      expect(service.locations()).toEqual([]);
    });
  });
});
