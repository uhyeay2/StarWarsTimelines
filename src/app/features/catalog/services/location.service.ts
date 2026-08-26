import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { ApiLocation } from '../../../shared/models/api-location';
import { catalogErrorHandler } from './catalog-error-handler';
import { CATALOG_API_BASE, CACHE_TTL_MS } from './catalog-constants';
import { CatalogErrorCode } from '../models/catalog-error';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { SignalCache } from '../../../shared/utils/signal-cache';
import { readProblemDetail } from '../../../shared/utils/problem-detail';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private readonly cache = new SignalCache<readonly ApiLocation[]>(
    () => this.http.get<readonly ApiLocation[]>(`${CATALOG_API_BASE}/locations`),
    (err) => {
      if (err instanceof HttpErrorResponse) {
        return readProblemDetail(err, 'Failed to load locations');
      }
      return 'Failed to load locations';
    },
    CACHE_TTL_MS,
  );

  readonly locations = this.cache.data.asReadonly();
  readonly locationsLoading = this.cache.loading.asReadonly();
  readonly locationsError = this.cache.error.asReadonly();

  /**
   * Fetches all locations from the catalog API.
   */
  fetchLocations(): void {
    this.cache.fetch();
  }

  /**
   * Invalidates the location cache, forcing a refetch on next access.
   */
  invalidate(): void {
    this.cache.invalidate();
  }

  /**
   * Creates a new location in the catalog.
   * @param name - The name of the location.
   * @returns An observable of the created location.
   */
  createLocation(name: string): Observable<ApiLocation> {
    return this.http.post<ApiLocation>(`${CATALOG_API_BASE}/locations`, { name }).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to create the location. Please try again.',
          'createLocation',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }

  /**
   * Updates an existing location by ID.
   * @param id - The ID of the location to update.
   * @param name - The updated name of the location.
   * @returns An observable of the updated location.
   */
  updateLocation(id: number, name: string): Observable<ApiLocation> {
    return this.http.put<ApiLocation>(`${CATALOG_API_BASE}/locations/${id}`, { name }).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to update the location. Please try again.',
          'updateLocation',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }

  /**
   * Deletes a location by ID.
   * @param id - The ID of the location to delete.
   * @returns An observable that completes when the deletion is done.
   */
  deleteLocation(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/locations/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the location. Please try again.',
          'deleteLocation',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }
}
