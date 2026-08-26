/**
 * @fileoverview CRUD service for catalog vehicles. Manages a SignalCache
 * of vehicle entities and exposes reactive signals for the UI.
 */
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { ApiVehicle } from '../../../shared/models/api-vehicle';
import { catalogErrorHandler } from './catalog-error-handler';
import { CATALOG_API_BASE, CACHE_TTL_MS } from './catalog-constants';
import { CatalogErrorCode } from '../models/catalog-error';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { SignalCache } from '../../../shared/utils/signal-cache';
import { readProblemDetail } from '../../../shared/utils/problem-detail';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private readonly cache = new SignalCache<readonly ApiVehicle[]>(
    () => this.http.get<readonly ApiVehicle[]>(`${CATALOG_API_BASE}/vehicles`),
    (err) => {
      if (err instanceof HttpErrorResponse) {
        return readProblemDetail(err, 'Failed to load vehicles');
      }
      return 'Failed to load vehicles';
    },
    CACHE_TTL_MS,
  );

  readonly vehicles = this.cache.data;
  readonly vehiclesLoading = this.cache.loading;
  readonly vehiclesError = this.cache.error;

  /**
   * Fetches all vehicles from the catalog API.
   */
  fetchVehicles(): void {
    this.cache.fetch();
  }

  /**
   * Invalidates the vehicle cache, forcing a refetch on next access.
   */
  invalidate(): void {
    this.cache.invalidate();
  }

  /**
   * Creates a new vehicle in the catalog.
   * @param name - The name of the vehicle.
   * @returns An observable of the created vehicle.
   */
  createVehicle(name: string): Observable<ApiVehicle> {
    return this.http.post<ApiVehicle>(`${CATALOG_API_BASE}/vehicles`, { name }).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to create the vehicle. Please try again.',
          'createVehicle',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }

  /**
   * Updates an existing vehicle by ID.
   * @param id - The ID of the vehicle to update.
   * @param name - The updated name of the vehicle.
   * @returns An observable of the updated vehicle.
   */
  updateVehicle(id: number, name: string): Observable<ApiVehicle> {
    return this.http.put<ApiVehicle>(`${CATALOG_API_BASE}/vehicles/${id}`, { name }).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to update the vehicle. Please try again.',
          'updateVehicle',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }

  /**
   * Deletes a vehicle by ID.
   * @param id - The ID of the vehicle to delete.
   * @returns An observable that completes when the deletion is done.
   */
  deleteVehicle(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/vehicles/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the vehicle. Please try again.',
          'deleteVehicle',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }
}
