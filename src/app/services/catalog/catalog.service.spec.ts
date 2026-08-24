import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CatalogError, DuplicateEntityError, EntityInUseError } from '../../models/catalog/catalog-error';
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
          id: 10,
          title: 'Star Wars: Episode IV - A New Hope',
          medium: 0,
          canonType: 0,
        },
        {
          id: 12,
          title: 'Star Wars: Episode V - The Empire Strikes Back',
          medium: 0,
          canonType: 2,
        },
      ]);

      expect(service.sourceMaterials()).toEqual([
        {
          id: 10,
          title: 'Star Wars: Episode IV - A New Hope',
          medium: 'Movie',
          canonType: 'Canon',
        },
        {
          id: 12,
          title: 'Star Wars: Episode V - The Empire Strikes Back',
          medium: 'Movie',
          canonType: 'Canon & Legends',
        },
      ]);
    });

    it('sets error signal when a source material has an unknown medium code', () => {
      service.fetchSourceMaterials();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      request.flush([{ id: 1, title: 'Unknown', medium: 99, canonType: 0 }]);

      expect(service.sourceMaterialsError()).toBe('Failed to load source materials');
      expect(service.sourceMaterials()).toBeNull();
    });
  });

  describe('fetchCharacters', () => {
    it('fetches characters into the signal', () => {
      service.fetchCharacters();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      request.flush([{ id: 7, name: 'Luke Skywalker' }]);

      expect(service.characters()).toEqual([
        { id: 7, name: 'Luke Skywalker' },
      ]);
    });
  });

  describe('fetchLocations', () => {
    it('fetches locations into the signal', () => {
      service.fetchLocations();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
      request.flush([{ id: 12, name: 'Tatooine' }]);

      expect(service.locations()).toEqual([
        { id: 12, name: 'Tatooine' },
      ]);
    });
  });

  describe('fetchVehicles', () => {
    it('fetches vehicles into the signal', () => {
      service.fetchVehicles();

      const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
      request.flush([{ id: 15, name: 'Millennium Falcon' }]);

      expect(service.vehicles()).toEqual([
        { id: 15, name: 'Millennium Falcon' },
      ]);
    });
  });

  describe('getUnitCache', () => {
    it('fetches units and maps the numeric unit type', () => {
      const cache = service.getUnitCache(30);
      cache.fetch();

      const request = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/30/units'),
      );
      request.flush([
        {
          id: 101,
          sourceMaterialId: 30,
          unitType: 0,
          parentUnitId: null,
          number: 1,
          title: 'Chapter 1: The Mandalorian',
        },
        {
          id: 102,
          sourceMaterialId: 40,
          unitType: 1,
          parentUnitId: null,
          number: 2,
          title: null,
        },
      ]);

      expect(cache.data()).toEqual([
        {
          id: 101,
          sourceMaterialId: 30,
          unitType: 'Episode',
          parentUnitId: null,
          number: 1,
          title: 'Chapter 1: The Mandalorian',
        },
        {
          id: 102,
          sourceMaterialId: 40,
          unitType: 'Chapter',
          parentUnitId: null,
          number: 2,
          title: null,
        },
      ]);
    });
  });

  describe('createCharacter', () => {
    it('posts the name-only payload and auto-invalidates the characters cache', () => {
      service.fetchCharacters();
      const listReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      listReq.flush([{ id: 5, name: 5 }]);

      let created: unknown;
      service.createCharacter({ name: 'Luke Skywalker' }).subscribe((c) => (created = c));

      const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/characters'));
      expect(request.request.body).toEqual({
        name: 'Luke Skywalker',
        planetBornOnId: null,
        yearOfBirthEarliest: null,
        yearOfBirthLatest: null,
        yearOfDeathEarliest: null,
        yearOfDeathLatest: null,
        speciesId: null,
      });
      request.flush({ id: 99, name: 'Luke Skywalker' });

      expect(created).toEqual({
        id: 99,
        name: 'Luke Skywalker',
      });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });

    it('posts biography fields when provided', () => {
      service
        .createCharacter({
          name: 'Grogu',
          planetBornOnId: 12,
          yearOfBirthEarliest: -41,
          yearOfBirthLatest: -41,
          speciesId: 2,
        })
        .subscribe();

      const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/characters'));
      expect(request.request.body).toEqual({
        name: 'Grogu',
        planetBornOnId: 12,
        yearOfBirthEarliest: -41,
        yearOfBirthLatest: -41,
        yearOfDeathEarliest: null,
        yearOfDeathLatest: null,
        speciesId: 2,
      });
      request.flush({ id: 8, name: 'Grogu' });

      // Cache invalidation triggers an immediate re-fetch.
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
    });
  });

  describe('updateCharacter', () => {
    it('puts the full payload and auto-invalidates the characters cache', () => {
      service.updateCharacter(7, {
        name: 'New name',
        planetBornOnId: 12,
        yearOfDeathEarliest: 4,
        yearOfDeathLatest: 5,
      }).subscribe();

      const request = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/characters/7'));
      expect(request.request.body).toEqual({
        name: 'New name',
        planetBornOnId: 12,
        yearOfBirthEarliest: null,
        yearOfBirthLatest: null,
        yearOfDeathEarliest: 4,
        yearOfDeathLatest: 5,
        speciesId: null,
      });
      request.flush({ id: 7, name: 'New name' });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });
  });

  describe('deleteCharacter', () => {
    it('deletes and auto-invalidates the characters cache', () => {
      service.deleteCharacter(7).subscribe();

      const request = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/characters/7'));
      request.flush(null, { status: 204, statusText: 'No Content' });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });

    it('surfaces the problem detail when deleting a referenced character', () => {
      let caughtError: unknown;
      service.deleteCharacter(7).subscribe({
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
      service.deleteCharacter(888).subscribe({
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
      service.deleteCharacter(7).subscribe({
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
      request.flush({ id: 90, title: 'Ahsoka', medium: 4, canonType: 0 });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      refetchReq.flush([]);
      expect(service.sourceMaterials()).toEqual([]);
    });
  });

  describe('updateSourceMaterial', () => {
    it('puts with mapped enum codes and auto-invalidates the cache', () => {
      service
        .updateSourceMaterial(90, {
          title: 'Ahsoka S2',
          medium: 'Live Action Show',
          canonType: 'Legends',
        })
        .subscribe();

      const request = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/source-materials/90'));
      expect(request.request.body).toEqual({ title: 'Ahsoka S2', medium: 4, canonType: 1 });
      request.flush({ id: 90, title: 'Ahsoka S2', medium: 4, canonType: 1 });

      // Cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      refetchReq.flush([]);
      expect(service.sourceMaterials()).toEqual([]);
    });
  });

  describe('createSourceMaterialUnit', () => {
    it('posts with mapped unit type and auto-invalidates the unit cache', () => {
      const cache = service.getUnitCache(30);

      service
        .createSourceMaterialUnit(30, {
          unitType: 'Episode',
          parentUnitId: null,
          number: 9,
          title: null,
        })
        .subscribe();

      const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/30/units'));
      expect(request.request.body).toEqual({ unitType: 0, parentUnitId: null, number: 9, title: null });
      request.flush({
        id: 109,
        sourceMaterialId: 30,
        unitType: 0,
        parentUnitId: null,
        number: 9,
        title: null,
      });

      // Unit cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/30/units'),
      );
      refetchReq.flush([]);
      expect(cache.data()).toEqual([]);
    });

    it('wraps a duplicate unit number conflict as DuplicateEntityError', () => {
      let caughtError: unknown;
      service
        .createSourceMaterialUnit(30, {
          unitType: 'Episode',
          parentUnitId: null,
          number: 9,
          title: null,
        })
        .subscribe({
          error: (err) => (caughtError = err),
        });

      const request = httpMock.expectOne((r) => r.method === 'POST');
      request.flush(
        { title: 'Conflict', detail: 'Source material already has an episode numbered 9.' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(caughtError).toBeInstanceOf(DuplicateEntityError);
      expect((caughtError as CatalogError).code).toBe('duplicate-entity');
      expect((caughtError as Error).message).toBe('Source material already has an episode numbered 9.');
    });
  });

  describe('deleteSourceMaterialUnit', () => {
    it('deletes and auto-invalidates the unit cache', () => {
      const cache = service.getUnitCache(30);

      service
        .deleteSourceMaterialUnit(30, 109)
        .subscribe();

      const request = httpMock.expectOne(
        (r) => r.method === 'DELETE' && r.url.endsWith('/api/source-materials/30/units/109'),
      );
      request.flush(null, { status: 204, statusText: 'No Content' });

      // Unit cache was invalidated and re-fetched
      const refetchReq = httpMock.expectOne(
        (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/30/units'),
      );
      refetchReq.flush([]);
      expect(cache.data()).toEqual([]);
    });
  });

  describe('invalidateEntity', () => {
    it('invalidates the characters cache on characters event', () => {
      service.fetchCharacters();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      req.flush([{ id: 7, name: 'Luke' }]);
      expect(service.characters()).toEqual([{ id: 7, name: 'Luke' }]);

      service.invalidateEntity('characters');

      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      refetchReq.flush([]);
      expect(service.characters()).toEqual([]);
    });

    it('invalidates all unit caches on source-material-units event without ID', () => {
      const cache = service.getUnitCache(50);
      cache.fetch();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
      req.flush([{ id: 203, sourceMaterialId: 50, unitType: 0, parentUnitId: null, number: 1, title: null }]);
      expect(cache.data()!.length).toBe(1);

      service.invalidateEntity('source-material-units');

      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
      refetchReq.flush([]);
      expect(cache.data()).toEqual([]);
    });

    it('invalidates only the affected unit cache when a unit ID is provided', () => {
      const cache1 = service.getUnitCache(50);
      cache1.fetch();
      const req1 = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
      req1.flush([{ id: 201, sourceMaterialId: 50, unitType: 0, parentUnitId: null, number: 1, title: null }]);

      const cache2 = service.getUnitCache(60);
      cache2.fetch();
      const req2 = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/60/units'));
      req2.flush([{ id: 202, sourceMaterialId: 60, unitType: 0, parentUnitId: null, number: 1, title: null }]);

      expect(cache1.data()!.length).toBe(1);
      expect(cache2.data()!.length).toBe(1);

      service.invalidateEntity('source-material-units', 201);

      // Only cache1 should be invalidated
      const refetchReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
      refetchReq.flush([]);
      expect(cache1.data()).toEqual([]);

      // cache2 should remain untouched
      httpMock.expectNone((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/60/units'));
      expect(cache2.data()!.length).toBe(1);
    });

    it('does nothing for a unit ID not found in any loaded cache', () => {
      const cache = service.getUnitCache(50);
      cache.fetch();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
      req.flush([{ id: 201, sourceMaterialId: 50, unitType: 0, parentUnitId: null, number: 1, title: null }]);

      service.invalidateEntity('source-material-units', 999);

      httpMock.expectNone((r) => r.method === 'GET' && r.url.includes('/units'));
      expect(cache.data()!.length).toBe(1);
    });

    it('invalidates the specific unit cache on source-materials event with ID', () => {
      const cache = service.getUnitCache(50);
      cache.fetch();
      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
      req.flush([{ id: 203, sourceMaterialId: 50, unitType: 0, parentUnitId: null, number: 1, title: null }]);
      expect(cache.data()!.length).toBe(1);

      // Also load source materials
      service.fetchSourceMaterials();
      const smReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smReq.flush([]);

      service.invalidateEntity('source-materials', 50);

      // Source materials collection should be invalidated
      const smRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smRefetch.flush([]);

      // The specific unit cache should also be invalidated
      const unitRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/50/units'));
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
      charReq.flush([{ id: 7, name: 'Luke' }]);

      service.fetchLocations();
      const locReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
      locReq.flush([]);

      service.fetchVehicles();
      const vehReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
      vehReq.flush([]);

      service.fetchSourceMaterials();
      const smReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smReq.flush([]);

      service.fetchSpecies();
      const speciesReq = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/species'));
      speciesReq.flush([{ id: 3, name: 'Human', homePlanetId: null, homePlanetName: null }]);

      service.invalidateAll();

      const charRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
      charRefetch.flush([]);
      const locRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
      locRefetch.flush([]);
      const vehRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
      vehRefetch.flush([]);
      const smRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
      smRefetch.flush([]);
      const speciesRefetch = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/species'));
      speciesRefetch.flush([]);

      expect(service.characters()).toEqual([]);
      expect(service.locations()).toEqual([]);
      expect(service.species()).toEqual([]);
    });
  });
});
