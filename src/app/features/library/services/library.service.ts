/**
 * @fileoverview Client-side service for the user's tracked-source-material library.
 *
 * Provides signal-based caching and Observable-based CRUD operations for
 * managing which source materials a user is tracking, their reading status,
 * favorite flag, per-unit progress, and library ordering.
 *
 * Cache lifecycle is managed by {@link LibraryCacheManager}; this service
 * focuses on CRUD methods and delegates cache reads/writes to the manager.
 *
 * @see {@link TrackedEventsPage} for the tracked-events UI.
 * @see {@link Timeline} for the library-aware timeline view.
 */

import { DestroyRef, inject, Injectable, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LibraryItem } from '../../../shared/models/library-item';
import { TrackingStatus, statusToApiCode } from '../../../shared/models/tracking-status';
import {
  AddMaterialRequest,
  CatalogMaterial,
  ReorderRequest,
  UpdateFavoriteRequest,
  UpdateStatusRequest,
  UpdateUnitProgressRequest,
} from './library.dto';
import { LibraryCacheManager } from './library-cache-manager';

/** Re-export so existing consumers can import from this module. */
export type { CatalogMaterial } from './library.dto';

/**
 * Manages the current user's tracked-source-material library.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * Cache lifecycle is delegated to {@link LibraryCacheManager}. This service
 * owns the CRUD methods that build HTTP requests and call into the cache
 * manager's `mutateAndReload`.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LibraryCacheManager);

  // ─── Delegate signals ───────────────────────────────────────────────────

  readonly items: Signal<readonly LibraryItem[]> = this.cache.items;
  readonly loading: Signal<boolean> = this.cache.loading;
  readonly error: Signal<string | null> = this.cache.error;

  // ─── Delegate cache operations ──────────────────────────────────────────

  /**
   * Fetches the tracked library items for a user.
   * @param userId - The ID of the user.
   * @returns An observable of the user's tracked items.
   */
  getTracked(userId: string): Observable<readonly LibraryItem[]> {
    return this.cache.getTracked(userId);
  }

  /**
   * Fetches tracked items and auto-unsubscribes when the component is destroyed.
   * @param userId - The ID of the user.
   * @param destroyRef - The destroy reference for automatic cleanup.
   * @returns An observable of the user's tracked items.
   */
  getTracked$(userId: string, destroyRef: DestroyRef): Observable<readonly LibraryItem[]> {
    return this.getTracked(userId).pipe(takeUntilDestroyed(destroyRef));
  }

  /**
   * Ensures the tracked items are loaded for a user, fetching if not cached.
   * @param userId - The ID of the user.
   */
  ensureTracked(userId: string): void {
    this.cache.ensureTracked(userId);
  }

  /**
   * Clears the cached library items.
   */
  clearCache(): void {
    this.cache.clearCache();
  }

  /**
   * Reloads the tracked library items from the API.
   */
  reload(): void {
    this.cache.reload();
  }

  // ─── CRUD methods ───────────────────────────────────────────────────────

  /**
   * Adds a source material to the user's tracked library.
   * @param userId - The ID of the user.
   * @param material - The catalog material to track.
   * @param initialStatus - Optional initial tracking status.
   * @returns An observable of the updated library items.
   */
  addTracked(
    userId: string,
    material: CatalogMaterial,
    initialStatus?: TrackingStatus,
  ): Observable<readonly LibraryItem[]> {
    const body: AddMaterialRequest = {
      sourceMaterialId: material.id,
      ...(initialStatus !== undefined && { status: statusToApiCode(initialStatus) }),
    };
    return this.cache.mutateAndReload(
      this.http.post(this.cache.urlFor(userId), body),
      userId,
      null,
      'Unable to add the material to your library.',
      'addTracked',
      { title: material.title, medium: material.medium },
    );
  }

  /**
   * Updates the tracking status for a material or specific unit.
   * @param userId - The ID of the user.
   * @param materialId - The ID of the source material.
   * @param status - The new tracking status.
   * @param unitId - Optional unit ID to update a specific unit's status.
   * @returns An observable of the updated library items.
   */
  setStatus(
    userId: string,
    materialId: number,
    status: TrackingStatus,
    unitId?: number,
  ): Observable<readonly LibraryItem[]> {
    const body: UpdateStatusRequest = {
      status: statusToApiCode(status),
      ...(unitId !== undefined && { unitId }),
    };
    return this.cache.mutateAndReload(
      this.http.put<void>(this.cache.urlForMaterial(userId, materialId), body),
      userId,
      materialId,
      'Unable to update the status.',
      'setStatus',
      { status },
    );
  }

  /**
   * Sets or unsets a material as a favorite.
   * @param userId - The ID of the user.
   * @param materialId - The ID of the source material.
   * @param favorite - Whether to mark as favorite.
   * @returns An observable of the updated library items.
   */
  setFavorite(
    userId: string,
    materialId: number,
    favorite: boolean,
  ): Observable<readonly LibraryItem[]> {
    const body: UpdateFavoriteRequest = { isFavorite: favorite };
    return this.cache.mutateAndReload(
      this.http.put<void>(this.cache.urlForMaterial(userId, materialId), body),
      userId,
      materialId,
      'Unable to update the favorite flag.',
      'setFavorite',
      { favorite },
    );
  }

  /**
   * Removes a material from the user's tracked library.
   * @param userId - The ID of the user.
   * @param materialId - The ID of the source material to remove.
   * @returns An observable of the updated library items.
   */
  removeTracked(userId: string, materialId: number): Observable<readonly LibraryItem[]> {
    return this.cache.mutateAndReload(
      this.http.delete<void>(this.cache.urlForMaterial(userId, materialId)),
      userId,
      null,
      'Unable to remove the material from your library.',
      'removeTracked',
      { materialId },
    );
  }

  /**
   * Updates the progress status for a specific unit.
   * @param userId - The ID of the user.
   * @param materialId - The ID of the source material.
   * @param unitId - The ID of the unit to update.
   * @param status - The new progress status.
   * @returns An observable of the updated library items.
   */
  setUnitProgress(
    userId: string,
    materialId: number,
    unitId: number,
    status: TrackingStatus,
  ): Observable<readonly LibraryItem[]> {
    const body: UpdateUnitProgressRequest = { status: statusToApiCode(status) };
    return this.cache.mutateAndReload(
      this.http.put<void>(this.cache.urlForUnit(userId, materialId, unitId), body),
      userId,
      materialId,
      'Unable to update unit progress.',
      'setUnitProgress',
      { unitId, status },
    );
  }

  /**
   * Clears the progress tracking for a specific unit.
   * @param userId - The ID of the user.
   * @param materialId - The ID of the source material.
   * @param unitId - The ID of the unit to clear progress for.
   * @returns An observable of the updated library items.
   */
  clearUnitProgress(
    userId: string,
    materialId: number,
    unitId: number,
  ): Observable<readonly LibraryItem[]> {
    return this.cache.mutateAndReload(
      this.http.delete<void>(this.cache.urlForUnit(userId, materialId, unitId)),
      userId,
      null,
      'Unable to clear the tracking progress.',
      'clearUnitProgress',
      { unitId },
    );
  }

  /**
   * Reorders the tracked materials in the user's library.
   * @param userId - The ID of the user.
   * @param orderedSourceMaterialIds - The source material IDs in the desired order.
   * @returns An observable of the reordered library items.
   */
  reorderTrackedItem(
    userId: string,
    orderedSourceMaterialIds: readonly number[],
  ): Observable<readonly LibraryItem[]> {
    const body: ReorderRequest = { orderedSourceMaterialIds: [...orderedSourceMaterialIds] };
    return this.cache.mutateAndReload(
      this.http.put<void>(this.cache.urlForReorder(userId), body),
      userId,
      null,
      'Unable to reorder the library.',
      'reorderTrackedItem',
      { count: orderedSourceMaterialIds.length },
    );
  }
}
