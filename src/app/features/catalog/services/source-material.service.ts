import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, tap } from 'rxjs';
import { ApiSourceMaterial } from '../../../shared/models/api-source-material';
import { ApiSourceMaterialUnit } from '../../../shared/models/api-source-material-unit';
import { canonTypeFromApiCode, canonTypeToApiCode } from '../../../shared/models/canon-type';
import { catalogErrorHandler } from './catalog-error-handler';
import { CATALOG_API_BASE, CACHE_TTL_MS } from './catalog-constants';
import { CreateSourceMaterialInput } from '../models/create-source-material-input';
import { CreateSourceMaterialUnitInput } from '../models/create-source-material-unit-input';
import { mediumFromApiCode, mediumToApiCode } from '../../../shared/models/medium';
import { unitTypeFromApiCode, unitTypeToApiCode } from '../../../shared/models/unit-type';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import { SignalCache } from '../../../shared/utils/signal-cache';
import { SourceMaterialDto, SourceMaterialUnitDto } from './catalog.dto';
import { LoggerService } from '../../../shared/services/logging/logger.service';

export type { CreateSourceMaterialInput } from '../models/create-source-material-input';
export type { CreateSourceMaterialUnitInput } from '../models/create-source-material-unit-input';

@Injectable({ providedIn: 'root' })
export class SourceMaterialService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // ─── Source-material list cache ──────────────────────────────────────────

  private readonly materialsCache = new SignalCache<readonly ApiSourceMaterial[]>(
    () =>
      this.http
        .get<readonly SourceMaterialDto[]>(`${CATALOG_API_BASE}/source-materials`)
        .pipe(map((items) => items.map((item) => this.mapSourceMaterial(item)))),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load source materials'),
    CACHE_TTL_MS,
  );

  /** Per-material unit caches keyed by source material ID. */
  private readonly unitCaches = new Map<number, SignalCache<readonly ApiSourceMaterialUnit[]>>();

  // ─── Public signals ──────────────────────────────────────────────────────

  readonly sourceMaterials = this.materialsCache.data.asReadonly();
  readonly sourceMaterialsLoading = this.materialsCache.loading.asReadonly();
  readonly sourceMaterialsError = this.materialsCache.error.asReadonly();

  // ─── Fetch methods ───────────────────────────────────────────────────────

  /**
   * Fetches the list of all source materials from the API.
   */
  fetchSourceMaterials(): void {
    this.materialsCache.fetch();
  }

  /**
   * Invalidates the source materials cache, forcing a refetch on next access.
   */
  invalidateMaterials(): void {
    this.materialsCache.invalidate();
  }

  /** Probes all source materials to discover which have units. */
  probeUnitPresence(): void {
    const materials = this.materialsCache.data();
    if (!materials || materials.length === 0) {
      return;
    }
    for (const m of materials) {
      this.getUnitCache(m.id).fetch();
    }
  }

  /**
   * Synchronously checks whether all probe fetches have completed.
   *
   * @returns A `Set` of material IDs that have units, or `null` if any
   *          probe is still loading.
   */
  checkProbeResults(): Set<number> | null {
    const materials = this.materialsCache.data();
    if (!materials || materials.length === 0) {
      return new Set<number>();
    }

    if (materials.some((m) => this.getUnitCache(m.id).loading())) {
      return null;
    }

    const withUnits = new Set<number>();
    for (const m of materials) {
      const units = this.getUnitCache(m.id).data();
      if (units && units.length > 0) {
        withUnits.add(m.id);
      }
    }
    return withUnits;
  }

  /**
   * Returns the unit cache for a given source material, creating it if needed.
   * @param sourceMaterialId - The ID of the source material.
   * @returns The signal cache containing the material's units.
   */
  getUnitCache(sourceMaterialId: number): SignalCache<readonly ApiSourceMaterialUnit[]> {
    let cache = this.unitCaches.get(sourceMaterialId);
    if (!cache) {
      cache = new SignalCache<readonly ApiSourceMaterialUnit[]>(
        () =>
          this.http
            .get<readonly SourceMaterialUnitDto[]>(
              `${CATALOG_API_BASE}/source-materials/${sourceMaterialId}/units`,
            )
            .pipe(map((items) => items.map((item) => this.mapUnit(item)))),
        (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load units'),
        CACHE_TTL_MS,
      );
      this.unitCaches.set(sourceMaterialId, cache);
    }
    return cache;
  }

  /**
   * Invalidates the unit cache for a specific source material.
   * @param sourceMaterialId - The ID of the source material whose units to invalidate.
   */
  invalidateUnitCache(sourceMaterialId: number): void {
    this.unitCaches.get(sourceMaterialId)?.invalidate();
  }

  /**
   * Invalidates all unit caches across every source material.
   */
  invalidateAllUnitCaches(): void {
    for (const cache of this.unitCaches.values()) {
      cache.invalidate();
    }
  }

  /**
   * Finds the unit cache that contains the given unit ID and invalidates it.
   */
  invalidateUnitById(unitId: number): void {
    for (const [, cache] of this.unitCaches) {
      const units = cache.data();
      if (units?.some((u) => u.id === unitId)) {
        cache.invalidate();
        return;
      }
    }
  }

  /** Returns all loaded unit caches (for external invalidation coordination). */
  getAllUnitCaches(): IterableIterator<SignalCache<readonly ApiSourceMaterialUnit[]>> {
    return this.unitCaches.values();
  }

  // ─── Source-material CRUD ────────────────────────────────────────────────

  /**
   * Creates a new source material.
   * @param input - The source material data including title, medium, and canon type.
   * @returns An observable of the created source material.
   */
  createSourceMaterial(input: CreateSourceMaterialInput): Observable<ApiSourceMaterial> {
    return this.http
      .post<SourceMaterialDto>(`${CATALOG_API_BASE}/source-materials`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the source material. Please try again.',
            'createSourceMaterial',
            'entity-in-use',
            this.logger,
          ),
        ),
        map((item) => this.mapSourceMaterial(item)),
        tap(() => this.materialsCache.invalidate()),
      );
  }

  /**
   * Updates an existing source material.
   * @param id - The ID of the source material to update.
   * @param input - The updated source material data.
   * @returns An observable of the updated source material.
   */
  updateSourceMaterial(
    id: number,
    input: CreateSourceMaterialInput,
  ): Observable<ApiSourceMaterial> {
    return this.http
      .put<SourceMaterialDto>(`${CATALOG_API_BASE}/source-materials/${id}`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the source material. Please try again.',
            'updateSourceMaterial',
            'entity-in-use',
            this.logger,
          ),
        ),
        map((item) => this.mapSourceMaterial(item)),
        tap(() => this.materialsCache.invalidate()),
      );
  }

  /**
   * Deletes a source material by ID.
   * @param id - The ID of the source material to delete.
   * @returns An observable that completes when the material is deleted.
   */
  deleteSourceMaterial(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/source-materials/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the source material. Please try again.',
          'deleteSourceMaterial',
          'entity-in-use',
          this.logger,
        ),
      ),
      tap(() => {
        this.materialsCache.invalidate();
        this.unitCaches.get(id)?.invalidate();
      }),
    );
  }

  /**
   * Converts a standalone book source material into a collection with units.
   * @param id - The ID of the source material to convert.
   * @param collectionTitle - The title for the new collection.
   * @returns An observable of the created units.
   */
  convertStandaloneBookToCollection(
    id: number,
    collectionTitle: string,
  ): Observable<ApiSourceMaterialUnit[]> {
    return this.http
      .post<readonly SourceMaterialUnitDto[]>(
        `${CATALOG_API_BASE}/source-materials/${id}/convert-to-collection`,
        {
          collectionTitle,
        },
      )
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to convert the book to a collection. Please try again.',
            'convertStandaloneBookToCollection',
            'entity-in-use',
            this.logger,
          ),
        ),
        map((items) => items.map((item) => this.mapUnit(item))),
        tap(() => {
          this.materialsCache.invalidate();
          this.unitCaches.get(id)?.invalidate();
        }),
      );
  }

  // ─── Unit CRUD ───────────────────────────────────────────────────────────

  /**
   * Creates a new unit within a source material.
   * @param sourceMaterialId - The ID of the parent source material.
   * @param input - The unit data including type, title, and optional parent.
   * @returns An observable of the created unit.
   */
  createSourceMaterialUnit(
    sourceMaterialId: number,
    input: CreateSourceMaterialUnitInput,
  ): Observable<ApiSourceMaterialUnit> {
    return this.http
      .post<SourceMaterialUnitDto>(
        `${CATALOG_API_BASE}/source-materials/${sourceMaterialId}/units`,
        {
          unitType: unitTypeToApiCode(input.unitType),
          parentUnitId: input.parentUnitId,
          number: input.number,
          title: input.title,
        },
      )
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the unit. Please try again.',
            'createSourceMaterialUnit',
            'duplicate-entity',
            this.logger,
          ),
        ),
        map((item) => this.mapUnit(item)),
        tap(() => this.unitCaches.get(sourceMaterialId)?.invalidate()),
      );
  }

  /**
   * Updates an existing unit within a source material.
   * @param sourceMaterialId - The ID of the parent source material.
   * @param unitId - The ID of the unit to update.
   * @param input - The updated unit data.
   * @returns An observable of the updated unit.
   */
  updateSourceMaterialUnit(
    sourceMaterialId: number,
    unitId: number,
    input: CreateSourceMaterialUnitInput,
  ): Observable<ApiSourceMaterialUnit> {
    return this.http
      .put<SourceMaterialUnitDto>(
        `${CATALOG_API_BASE}/source-materials/${sourceMaterialId}/units/${unitId}`,
        {
          unitType: unitTypeToApiCode(input.unitType),
          parentUnitId: input.parentUnitId,
          number: input.number,
          title: input.title,
        },
      )
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the unit. Please try again.',
            'updateSourceMaterialUnit',
            'duplicate-entity',
            this.logger,
          ),
        ),
        map((item) => this.mapUnit(item)),
        tap(() => this.unitCaches.get(sourceMaterialId)?.invalidate()),
      );
  }

  /**
   * Deletes a unit from a source material.
   * @param sourceMaterialId - The ID of the parent source material.
   * @param unitId - The ID of the unit to delete.
   * @returns An observable that completes when the unit is deleted.
   */
  deleteSourceMaterialUnit(sourceMaterialId: number, unitId: number): Observable<void> {
    return this.http
      .delete<void>(`${CATALOG_API_BASE}/source-materials/${sourceMaterialId}/units/${unitId}`)
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to delete the unit. Please try again.',
            'deleteSourceMaterialUnit',
            'entity-in-use',
            this.logger,
          ),
        ),
        tap(() => this.unitCaches.get(sourceMaterialId)?.invalidate()),
      );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private mapSourceMaterial(item: SourceMaterialDto): ApiSourceMaterial {
    return {
      id: item.id,
      title: item.title,
      medium: mediumFromApiCode(item.medium),
      canonType: canonTypeFromApiCode(item.canonType),
    };
  }

  private mapUnit(item: SourceMaterialUnitDto): ApiSourceMaterialUnit {
    return {
      id: item.id,
      sourceMaterialId: item.sourceMaterialId,
      unitType: unitTypeFromApiCode(item.unitType),
      number: item.number,
      title: item.title,
      parentUnitId: item.parentUnitId,
    };
  }
}
