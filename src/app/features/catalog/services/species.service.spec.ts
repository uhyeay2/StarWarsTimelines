import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogError, EntityInUseError } from '../models/catalog-error';
import { SpeciesService } from './species.service';

const BASE = `${environment.apiBaseUrl}/api/species`;

const SPECIES = { id: 1, name: 'Human', homePlanetId: 3, homePlanetName: 'Coruscant' };

describe('SpeciesService', () => {
  let service: SpeciesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SpeciesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchSpecies', () => {
    it('populates the species signal via GET', () => {
      expect(service.species()).toBeNull();

      service.fetchSpecies();
      httpMock.expectOne(BASE).flush([SPECIES]);

      expect(service.species()).toEqual([SPECIES]);
    });

    it('sets loading signal during fetch', () => {
      expect(service.speciesLoading()).toBe(false);

      service.fetchSpecies();
      expect(service.speciesLoading()).toBe(true);

      httpMock.expectOne(BASE).flush([SPECIES]);
      expect(service.speciesLoading()).toBe(false);
    });

    it('sets error signal on failure', () => {
      service.fetchSpecies();
      httpMock.expectOne(BASE).flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.speciesError()).toBeTruthy();
      expect(service.species()).toBeNull();
    });
  });

  describe('createSpecies', () => {
    it('POSTs name and homePlanetId to the species URL', async () => {
      const promise = firstValueFrom(service.createSpecies('Wookiee', 5));

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Wookiee', homePlanetId: 5 });
      req.flush({ id: 2, name: 'Wookiee', homePlanetId: 5, homePlanetName: 'Kashyyyk' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });

    it('sends null homePlanetId when unknown', async () => {
      const promise = firstValueFrom(service.createSpecies('Unknown Species', null));

      const req = httpMock.expectOne(BASE);
      expect(req.request.body).toEqual({ name: 'Unknown Species', homePlanetId: null });
      req.flush({ id: 3, name: 'Unknown Species', homePlanetId: null, homePlanetName: null });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('updateSpecies', () => {
    it('PUTs name and homePlanetId to the species URL', async () => {
      const promise = firstValueFrom(service.updateSpecies(1, 'Human (updated)', 10));

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Human (updated)', homePlanetId: 10 });
      req.flush({ id: 1, name: 'Human (updated)', homePlanetId: 10, homePlanetName: 'Alderaan' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('deleteSpecies', () => {
    it('sends DELETE to the species URL', async () => {
      let completed = false;
      service.deleteSpecies(1).subscribe({ complete: () => (completed = true) });

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('error handling', () => {
    it('throws EntityInUseError on 409', async () => {
      const promise = firstValueFrom(service.deleteSpecies(1));
      httpMock
        .expectOne(`${BASE}/1`)
        .flush(
          { detail: 'Species is referenced by events' },
          { status: 409, statusText: 'Conflict' },
        );

      await expect(promise).rejects.toBeInstanceOf(EntityInUseError);
    });

    it('throws CatalogError with code not-found on 404', async () => {
      const promise = firstValueFrom(service.deleteSpecies(999));
      httpMock
        .expectOne(`${BASE}/999`)
        .flush({ detail: 'Species not found' }, { status: 404, statusText: 'Not Found' });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('not-found');
    });

    it('throws CatalogError with code network-error on 500', async () => {
      const promise = firstValueFrom(service.deleteSpecies(1));
      httpMock.expectOne(`${BASE}/1`).flush('Error', {
        status: 500,
        statusText: 'Server Error',
      });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('network-error');
    });
  });

  describe('cache invalidation', () => {
    it('invalidates cache after create and re-fetches', async () => {
      service.fetchSpecies();
      httpMock.expectOne(BASE).flush([SPECIES]);
      expect(service.species()).toHaveLength(1);

      const promise = firstValueFrom(service.createSpecies('Rodian', null));
      httpMock
        .expectOne(BASE)
        .flush({ id: 2, name: 'Rodian', homePlanetId: null, homePlanetName: null });
      await promise;

      httpMock
        .expectOne(BASE)
        .flush([SPECIES, { id: 2, name: 'Rodian', homePlanetId: null, homePlanetName: null }]);
      expect(service.species()).toHaveLength(2);
    });

    it('invalidates cache after delete and re-fetches', async () => {
      service.fetchSpecies();
      httpMock.expectOne(BASE).flush([SPECIES]);

      const promise = firstValueFrom(service.deleteSpecies(1));
      httpMock.expectOne(`${BASE}/1`).flush(null);
      await promise;

      httpMock.expectOne(BASE).flush([]);
      expect(service.species()).toEqual([]);
    });
  });
});
