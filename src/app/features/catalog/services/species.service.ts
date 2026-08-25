import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { ApiSpecies } from '../../../shared/models/api-species';
import { catalogErrorHandler } from './catalog-error-handler';
import { CATALOG_API_BASE, CACHE_TTL_MS } from './catalog-constants';
import { LoggerService } from '../../../shared/services/logging/logger.service';
import { SignalCache } from '../../../shared/utils/signal-cache';
import { readProblemDetail } from '../../../shared/utils/problem-detail';

@Injectable({ providedIn: 'root' })
export class SpeciesService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private readonly cache = new SignalCache<readonly ApiSpecies[]>(
    () => this.http.get<readonly ApiSpecies[]>(`${CATALOG_API_BASE}/species`),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load species'),
    CACHE_TTL_MS,
  );

  readonly species = this.cache.data.asReadonly();
  readonly speciesLoading = this.cache.loading.asReadonly();
  readonly speciesError = this.cache.error.asReadonly();

  /**
   * Fetches all species from the catalog API.
   */
  fetchSpecies(): void {
    this.cache.fetch();
  }

  /**
   * Invalidates the species cache, forcing a refetch on next access.
   */
  invalidate(): void {
    this.cache.invalidate();
  }

  /**
   * Creates a new species in the catalog.
   * @param name - The name of the species.
   * @param homePlanetId - The ID of the home planet, or null.
   * @returns An observable of the created species.
   */
  createSpecies(name: string, homePlanetId: number | null): Observable<ApiSpecies> {
    return this.http.post<ApiSpecies>(`${CATALOG_API_BASE}/species`, { name, homePlanetId }).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to create the species. Please try again.',
          'createSpecies',
          'entity-in-use',
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }

  /**
   * Updates an existing species by ID.
   * @param id - The ID of the species to update.
   * @param name - The updated name of the species.
   * @param homePlanetId - The updated home planet ID, or null.
   * @returns An observable of the updated species.
   */
  updateSpecies(id: number, name: string, homePlanetId: number | null): Observable<ApiSpecies> {
    return this.http
      .put<ApiSpecies>(`${CATALOG_API_BASE}/species/${id}`, { name, homePlanetId })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the species. Please try again.',
            'updateSpecies',
            'entity-in-use',
            this.logger,
          ),
        ),
        tap(() => this.cache.invalidate()),
      );
  }

  /**
   * Deletes a species by ID.
   * @param id - The ID of the species to delete.
   * @returns An observable that completes when the deletion is done.
   */
  deleteSpecies(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/species/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the species. Please try again.',
          'deleteSpecies',
          'entity-in-use',
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }
}
