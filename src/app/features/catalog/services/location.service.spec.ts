import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogError, EntityInUseError } from '../models/catalog-error';
import { LocationService } from './location.service';

const BASE = `${environment.apiBaseUrl}/api/locations`;

const LOCATION = { id: 1, name: 'Naboo' };

describe('LocationService', () => {
  let service: LocationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LocationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchLocations', () => {
    it('populates the locations signal via GET', () => {
      expect(service.locations()).toBeNull();

      service.fetchLocations();
      httpMock.expectOne(BASE).flush([LOCATION]);

      expect(service.locations()).toEqual([LOCATION]);
    });

    it('sets loading signal during fetch', () => {
      expect(service.locationsLoading()).toBe(false);

      service.fetchLocations();
      expect(service.locationsLoading()).toBe(true);

      httpMock.expectOne(BASE).flush([LOCATION]);
      expect(service.locationsLoading()).toBe(false);
    });

    it('sets error signal on failure', () => {
      service.fetchLocations();
      httpMock.expectOne(BASE).flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.locationsError()).toBeTruthy();
      expect(service.locations()).toBeNull();
    });
  });

  describe('createLocation', () => {
    it('POSTs the name to the locations URL', async () => {
      const promise = firstValueFrom(service.createLocation('Tatooine'));

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Tatooine' });
      req.flush({ id: 2, name: 'Tatooine' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('updateLocation', () => {
    it('PUTs the name to the location URL', async () => {
      const promise = firstValueFrom(service.updateLocation(1, 'Naboo (updated)'));

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Naboo (updated)' });
      req.flush({ id: 1, name: 'Naboo (updated)' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('deleteLocation', () => {
    it('sends DELETE to the location URL', async () => {
      let completed = false;
      service.deleteLocation(1).subscribe({ complete: () => (completed = true) });

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('error handling', () => {
    it('throws EntityInUseError on 409', async () => {
      const promise = firstValueFrom(service.deleteLocation(1));
      httpMock
        .expectOne(`${BASE}/1`)
        .flush(
          { detail: 'Location is referenced by events' },
          { status: 409, statusText: 'Conflict' },
        );

      await expect(promise).rejects.toBeInstanceOf(EntityInUseError);
    });

    it('throws CatalogError with code not-found on 404', async () => {
      const promise = firstValueFrom(service.deleteLocation(999));
      httpMock
        .expectOne(`${BASE}/999`)
        .flush({ detail: 'Location not found' }, { status: 404, statusText: 'Not Found' });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('not-found');
    });

    it('throws CatalogError with code network-error on 500', async () => {
      const promise = firstValueFrom(service.deleteLocation(1));
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
      service.fetchLocations();
      httpMock.expectOne(BASE).flush([LOCATION]);
      expect(service.locations()).toHaveLength(1);

      const promise = firstValueFrom(service.createLocation('Hoth'));
      httpMock.expectOne(BASE).flush({ id: 2, name: 'Hoth' });
      await promise;

      httpMock.expectOne(BASE).flush([LOCATION, { id: 2, name: 'Hoth' }]);
      expect(service.locations()).toHaveLength(2);
    });

    it('invalidates cache after delete and re-fetches', async () => {
      service.fetchLocations();
      httpMock.expectOne(BASE).flush([LOCATION]);

      const promise = firstValueFrom(service.deleteLocation(1));
      httpMock.expectOne(`${BASE}/1`).flush(null);
      await promise;

      httpMock.expectOne(BASE).flush([]);
      expect(service.locations()).toEqual([]);
    });
  });
});
