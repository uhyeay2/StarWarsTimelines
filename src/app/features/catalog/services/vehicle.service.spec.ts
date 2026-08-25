import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogError, EntityInUseError } from '../models/catalog-error';
import { VehicleService } from './vehicle.service';

const BASE = `${environment.apiBaseUrl}/api/vehicles`;

const VEHICLE = { id: 1, name: 'X-Wing' };

describe('VehicleService', () => {
  let service: VehicleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(VehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchVehicles', () => {
    it('populates the vehicles signal via GET', () => {
      expect(service.vehicles()).toBeNull();

      service.fetchVehicles();
      httpMock.expectOne(BASE).flush([VEHICLE]);

      expect(service.vehicles()).toEqual([VEHICLE]);
    });

    it('sets loading signal during fetch', () => {
      expect(service.vehiclesLoading()).toBe(false);

      service.fetchVehicles();
      expect(service.vehiclesLoading()).toBe(true);

      httpMock.expectOne(BASE).flush([VEHICLE]);
      expect(service.vehiclesLoading()).toBe(false);
    });

    it('sets error signal on failure', () => {
      service.fetchVehicles();
      httpMock.expectOne(BASE).flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.vehiclesError()).toBeTruthy();
      expect(service.vehicles()).toBeNull();
    });
  });

  describe('createVehicle', () => {
    it('POSTs the name to the vehicles URL', async () => {
      const promise = firstValueFrom(service.createVehicle('TIE Fighter'));

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'TIE Fighter' });
      req.flush({ id: 2, name: 'TIE Fighter' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('updateVehicle', () => {
    it('PUTs the name to the vehicle URL', async () => {
      const promise = firstValueFrom(service.updateVehicle(1, 'X-Wing (updated)'));

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'X-Wing (updated)' });
      req.flush({ id: 1, name: 'X-Wing (updated)' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('deleteVehicle', () => {
    it('sends DELETE to the vehicle URL', async () => {
      let completed = false;
      service.deleteVehicle(1).subscribe({ complete: () => (completed = true) });

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('error handling', () => {
    it('throws EntityInUseError on 409', async () => {
      const promise = firstValueFrom(service.deleteVehicle(1));
      httpMock.expectOne(`${BASE}/1`).flush(
        { detail: 'Vehicle is referenced by events' },
        { status: 409, statusText: 'Conflict' },
      );

      await expect(promise).rejects.toBeInstanceOf(EntityInUseError);
    });

    it('throws CatalogError with code not-found on 404', async () => {
      const promise = firstValueFrom(service.deleteVehicle(999));
      httpMock.expectOne(`${BASE}/999`).flush(
        { detail: 'Vehicle not found' },
        { status: 404, statusText: 'Not Found' },
      );

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('not-found');
    });

    it('throws CatalogError with code network-error on 500', async () => {
      const promise = firstValueFrom(service.deleteVehicle(1));
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
      service.fetchVehicles();
      httpMock.expectOne(BASE).flush([VEHICLE]);
      expect(service.vehicles()).toHaveLength(1);

      const promise = firstValueFrom(service.createVehicle('Speeder Bike'));
      httpMock.expectOne(BASE).flush({ id: 2, name: 'Speeder Bike' });
      await promise;

      httpMock.expectOne(BASE).flush([VEHICLE, { id: 2, name: 'Speeder Bike' }]);
      expect(service.vehicles()).toHaveLength(2);
    });

    it('invalidates cache after delete and re-fetches', async () => {
      service.fetchVehicles();
      httpMock.expectOne(BASE).flush([VEHICLE]);

      const promise = firstValueFrom(service.deleteVehicle(1));
      httpMock.expectOne(`${BASE}/1`).flush(null);
      await promise;

      httpMock.expectOne(BASE).flush([]);
      expect(service.vehicles()).toEqual([]);
    });
  });
});
