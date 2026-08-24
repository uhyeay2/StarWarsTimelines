/**
 * @fileoverview Client-side service for the user's tracked-source-material library.
 *
 * Provides signal-based caching and Observable-based CRUD operations for
 * managing which source materials a user is tracking, their reading status,
 * favorite flag, per-unit progress, and library ordering.
 *
 * **Signal-based caching:** The service exposes readonly signals (`items`,
 * `loading`, `error`) so that Angular components can read library state
 * without manual subscriptions. The cache is updated on every successful
 * fetch, and invalidated automatically after mutations.
 *
 * **Partial reloads:** Mutations that target a single material
 * (`setStatus`, `setFavorite`, `setUnitProgress`) reload only that item from
 * the server instead of the full library, reducing network overhead.
 *
 * **Retry with backoff:** Transient server errors (503 / 504) are
 * automatically retried up to 3 times with exponential backoff before
 * failing.
 *
 * **Reload error handling:** Both mutation errors and reload-after-mutation
 * errors are wrapped in {@link LibraryError} for consistent error handling.
 *
 * **Debounced reload:** Explicit `reload()` calls are debounced (200 ms) so
 * that rapid invalidation signals (e.g. from SSE events) are coalesced into
 * a single fetch.
 *
 * **Cancellation:** The `getTracked$` overload accepts an optional
 * `DestroyRef` to auto-unsubscribe when the consuming component is destroyed,
 * preventing memory leaks.
 *
 * **Enum mapping:** The server returns numeric codes for `medium`, `canonType`,
 * `status`, and `unitType`. This service maps them to domain-level string
 * unions using the helpers in the corresponding model files.
 *
 * @see {@link TrackedEventsPage} for the tracked-events UI.
 * @see {@link Timeline} for the library-aware timeline view.
 */

import { DestroyRef, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  debounceTime,
  EMPTY,
  finalize,
  map,
  Observable,
  of,
  retry,
  Subject,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { LibraryItem } from '../../models/library-item';
import { LibraryError, LibraryErrorCode } from '../../models/library/library-error';
import { TrackingStatus, statusToApiCode } from '../../models/tracking-status';
import { readProblemDetail } from '../../utils/problem-detail';
import { LoggerService } from '../logging/logger.service';
import {
  AddMaterialRequest,
  CatalogMaterial,
  LibraryItemDto,
  ReorderRequest,
  UpdateFavoriteRequest,
  UpdateStatusRequest,
  UpdateUnitProgressRequest,
} from './library.dto';
import { isValidItemDto, mapLibraryItem } from './library.mapper';

/** Re-export so existing consumers can import from this module. */
export type { CatalogMaterial } from './library.dto';

/** Base URL for all library API endpoints. */
const BASE = `${environment.apiBaseUrl}/api/users`;

/** Maximum number of automatic retries for transient server errors. */
const RETRY_COUNT = 3;

/** Base delay in milliseconds for exponential retry backoff. */
const RETRY_BASE_DELAY_MS = 1000;

/** Debounce window in milliseconds for explicit `reload()` calls. */
const RELOAD_DEBOUNCE_MS = 200;

/**
 * Manages the current user's tracked-source-material library.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * **Design notes:**
 * - Internal state is held in Angular signals for reactive consumption.
 * - Each mutating method delegates to {@link mutateAndReload}, which handles
 *   the error→reload flow with `switchMap` to prevent overlapping requests.
 * - All HTTP errors are caught, logged with structured metadata, and re-thrown
 *   as {@link LibraryError} with a machine-readable {@link LibraryErrorCode}.
 * - DTO mapping and validation are delegated to pure functions in
 *   {@link library.mapper}.
 * - Explicit `reload()` calls are debounced to coalesce rapid invalidation.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // ─── Signal-based cache ──────────────────────────────────────────────────

  /** Cached library items, or an empty array before the first load. */
  readonly items: WritableSignal<readonly LibraryItem[]> = signal([]);

  /** Whether a fetch is currently in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** The last error message, or `null` when there is no error. */
  readonly error: WritableSignal<string | null> = signal(null);

  /** The active user ID, used by the debounced reload pipeline. */
  private activeUserId: string | null = null;

  /** The user ID whose library was last fetched successfully, for `ensureTracked`. */
  private loadedUserId: string | null = null;

  /** Subject that triggers debounced reloads. */
  private readonly reloadTrigger = new Subject<void>();

  constructor() {
    this.initReloadPipeline();
  }

  // ─── Debounced reload pipeline ────────────────────────────────────────────

  /**
   * Sets up the debounced reload pipeline.
   *
   * `reload()` pushes into `reloadTrigger`; the pipeline debounces and
   * coalesces rapid signals into a single fetch.
   */
  private initReloadPipeline(): void {
    this.reloadTrigger
      .pipe(
        debounceTime(RELOAD_DEBOUNCE_MS),
        tap(() => this.loading.set(true)),
        switchMap(() => this.fetchItems(this.activeUserId!)),
        tap({
          next: (items) => {
            this.items.set(items);
            this.error.set(null);
          },
        }),
        catchError((err: unknown) => {
          this.error.set(readProblemDetail(err as HttpErrorResponse, 'Unable to load library.'));
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ─── URL helpers ──────────────────────────────────────────────────────────

  private urlFor(userId: string): string {
    return `${BASE}/${userId}/source-materials`;
  }

  private urlForMaterial(userId: string, materialId: number): string {
    return `${this.urlFor(userId)}/${materialId}`;
  }

  private urlForUnit(userId: string, materialId: number, unitId: number): string {
    return `${this.urlForMaterial(userId, materialId)}/units/${unitId}`;
  }

  private urlForReorder(userId: string): string {
    return `${this.urlFor(userId)}/reorder`;
  }

  // ─── Internal fetch with retry ────────────────────────────────────────────

  /**
   * Fetches the full library for a user, retries transient failures, and
   * maps validated DTOs to domain models.
   *
   * @param userId  The ID of the user whose library to fetch.
   * @returns An observable of the mapped library items.
   */
  private fetchItems(userId: string): Observable<readonly LibraryItem[]> {
    return this.http.get<readonly LibraryItemDto[]>(this.urlFor(userId)).pipe(
      retry({
        count: RETRY_COUNT,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          if (error instanceof HttpErrorResponse && [503, 504].includes(error.status)) {
            return timer(RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1));
          }
          return throwError(() => error);
        },
      }),
      map(
        (items) =>
          items
            .filter(isValidItemDto)
            .map(mapLibraryItem) as readonly LibraryItem[],
      ),
    );
  }

  /**
   * Reloads a single material and merges it into the cache.
   *
   * Falls back to a full reload when the cache is empty. When the material
   * is not yet part of the cache (e.g. it was just tracked for the first
   * time via a partial mutation), it is appended instead of dropped.
   *
   * @param userId     The ID of the user.
   * @param materialId The source material ID to reload.
   * @returns An observable of the updated library items.
   */
  private reloadMaterial(userId: string, materialId: number): Observable<readonly LibraryItem[]> {
    return this.http.get<LibraryItemDto>(this.urlForMaterial(userId, materialId)).pipe(
      map(mapLibraryItem),
      switchMap((updatedItem) => {
        const current = this.items();
        if (current.length === 0) {
          return this.fetchItems(userId).pipe(tap((items) => this.items.set(items)));
        }
        const exists = current.some((i) => i.id === materialId);
        const next = exists
          ? current.map((i) => (i.id === materialId ? updatedItem : i))
          : [...current, updatedItem];
        this.items.set(next);
        return of(next);
      }),
    );
  }

  // ─── Error handling ───────────────────────────────────────────────────────

  /**
   * Creates a `catchError` callback that logs the error with structured
   * metadata and re-throws it as a {@link LibraryError}.
   *
   * If the error is already a {@link LibraryError} (e.g. from a preceding
   * `catchError`), it is re-thrown as-is to prevent double-wrapping.
   *
   * @param fallback  A human-readable default when the server does not provide one.
   * @param context   A short label for log context (e.g. `'getTracked'`).
   * @param meta      Optional structured metadata to include in the log entry.
   * @returns A function suitable for `catchError(...)`.
   */
  private handleError(
    fallback: string,
    context: string,
    meta?: Record<string, unknown>,
  ): (error: unknown) => Observable<never> {
    return (error: unknown) => {
      if (error instanceof LibraryError) {
        return throwError(() => error);
      }

      const httpError = error as HttpErrorResponse;
      const detail = readProblemDetail(httpError, fallback);
      const logPayload = { ...meta, status: httpError.status, url: httpError.url };

      if (httpError.status === 404) {
        this.logger.warn(`[LibraryService] ${context}: ${detail}`, logPayload);
        return throwError(() => new LibraryError(detail, LibraryErrorCode.NotFound));
      }

      if (httpError.status === 400) {
        this.logger.warn(`[LibraryService] ${context}: ${detail}`, logPayload);
        return throwError(() => new LibraryError(detail, LibraryErrorCode.ValidationError));
      }

      this.logger.error(`[LibraryService] ${context}: ${detail}`, logPayload);
      return throwError(() => new LibraryError(detail, LibraryErrorCode.NetworkError));
    };
  }

  // ─── Centralized mutation → reload ────────────────────────────────────────

  /**
   * Executes an HTTP mutation, then reloads data.
   *
   * Uses `switchMap` so that if two mutations fire in rapid succession, only
   * the reload from the **latest** mutation is emitted.
   *
   * When `materialId` is provided, a targeted partial reload is performed
   * instead of a full-library fetch, reducing network overhead.
   *
   * Both mutation errors and reload errors are wrapped in {@link LibraryError}
   * for consistent error handling.
   *
   * @param mutation$   The HTTP observable that performs the mutation.
   * @param userId      The ID of the user whose library to reload.
   * @param materialId  The affected material ID for a partial reload, or `null`
   *                    for a full reload.
   * @param fallback    A human-readable default when the server does not provide one.
   * @param context     A short label for log context.
   * @param meta        Optional structured metadata for logging.
   * @returns An observable of the refreshed library items.
   */
  private mutateAndReload<T>(
    mutation$: Observable<T>,
    userId: string,
    materialId: number | null,
    fallback: string,
    context: string,
    meta?: Record<string, unknown>,
  ): Observable<readonly LibraryItem[]> {
    return mutation$.pipe(
      catchError(this.handleError(fallback, context, { userId, materialId, ...meta })),
      switchMap(() =>
        materialId
          ? this.reloadMaterial(userId, materialId)
          : this.fetchItems(userId).pipe(tap((items) => this.items.set(items))),
      ),
      catchError(
        this.handleError('Reload failed after mutation.', `${context}:reload`, { userId, materialId }),
      ),
    );
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetches the user's tracked library and updates the signal cache.
   *
   * @param userId  The ID of the user whose library to fetch.
   * @returns An observable of the library items.
   */
  getTracked(userId: string): Observable<readonly LibraryItem[]> {
    this.activeUserId = userId;
    this.loading.set(true);
    return this.fetchItems(userId).pipe(
      tap({
        next: (items) => {
          this.loadedUserId = userId;
          this.items.set(items);
          this.error.set(null);
        },
        error: (err: unknown) => {
          this.error.set(readProblemDetail(err as HttpErrorResponse, 'Unable to load library.'));
        },
      }),
      finalize(() => this.loading.set(false)),
      catchError(this.handleError('Unable to load library.', 'getTracked', { userId })),
    );
  }

  /**
   * Returns `getTracked` auto-unsubscribed when the provided `DestroyRef`
   * fires.
   *
   * Use this overload inside components to prevent memory leaks from orphaned
   * subscriptions.
   *
   * @param userId      The ID of the user whose library to fetch.
   * @param destroyRef  The destroy reference from the consuming component.
   * @returns An observable that completes automatically on component destroy.
   */
  getTracked$(userId: string, destroyRef: DestroyRef): Observable<readonly LibraryItem[]> {
    return this.getTracked(userId).pipe(takeUntilDestroyed(destroyRef));
  }

  /**
   * Fetches the user's library only when it has not been fetched for that
   * user yet (or a fetch is not already in flight).
   *
   * Use this in components where many instances may mount simultaneously
   * (e.g. one per timeline event card) so the library loads exactly once
   * instead of once per component.
   *
   * @param userId  The ID of the user whose library to fetch.
   */
  ensureTracked(userId: string): void {
    if (this.loading() || this.loadedUserId === userId) {
      return;
    }
    this.getTracked(userId).subscribe({ error: () => undefined });
  }

  /**
   * Clears the cached library state.
   *
   * Call when the user logs out (or switches accounts) so stale items are
   * never shown for a different user; the next `ensureTracked` refetches.
   */
  clearCache(): void {
    this.activeUserId = null;
    this.loadedUserId = null;
    this.items.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  /**
   * Triggers a debounced full-library reload.
   *
   * Safe to call rapidly (e.g. from SSE invalidation handlers); rapid calls
   * are coalesced into a single fetch after a 200 ms debounce window.
   */
  reload(): void {
    this.reloadTrigger.next();
  }

  /**
   * Adds a source material to the user's library.
   *
   * @param userId    The ID of the user.
   * @param material  The source material to track (id, title, medium).
   * @returns An observable of the refreshed library after the addition.
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
    return this.mutateAndReload(
      this.http.post(this.urlFor(userId), body),
      userId,
      null,
      'Unable to add the material to your library.',
      'addTracked',
      { title: material.title, medium: material.medium },
    );
  }

  /**
   * Updates the tracking status of a library item, or the progress of a
   * specific unit when `unitId` is provided for a unit-based material.
   *
   * Performs a targeted partial reload of the affected material.
   *
   * @param userId     The ID of the user.
   * @param materialId The source material ID.
   * @param status     The new tracking status.
   * @param unitId     Optional unit ID for sub-unit status updates.
   * @returns An observable of the refreshed library after the update.
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
    return this.mutateAndReload(
      this.http.put<void>(this.urlForMaterial(userId, materialId), body),
      userId,
      materialId,
      'Unable to update the status.',
      'setStatus',
      { status },
    );
  }

  /**
   * Sets or clears the favorite flag on a library item.
   *
   * Performs a targeted partial reload of the affected material.
   *
   * @param userId     The ID of the user.
   * @param materialId The source material ID.
   * @param favorite   Whether the item should be marked as a favorite.
   * @returns An observable of the refreshed library after the update.
   */
  setFavorite(
    userId: string,
    materialId: number,
    favorite: boolean,
  ): Observable<readonly LibraryItem[]> {
    const body: UpdateFavoriteRequest = { isFavorite: favorite };
    return this.mutateAndReload(
      this.http.put<void>(this.urlForMaterial(userId, materialId), body),
      userId,
      materialId,
      'Unable to update the favorite flag.',
      'setFavorite',
      { favorite },
    );
  }

  /**
   * Removes a source material from the user's library.
   *
   * Triggers a full-library reload since the removal affects ordering.
   *
   * @param userId     The ID of the user.
   * @param materialId The source material ID to remove.
   * @returns An observable of the refreshed library after the removal.
   */
  removeTracked(userId: string, materialId: number): Observable<readonly LibraryItem[]> {
    return this.mutateAndReload(
      this.http.delete<void>(this.urlForMaterial(userId, materialId)),
      userId,
      null,
      'Unable to remove the material from your library.',
      'removeTracked',
      { materialId },
    );
  }

  /**
   * Updates the tracking status of a unit within a library item.
   *
   * Only in-progress and completed statuses are stored per unit; wish-listing
   * a unit removes its progress row server-side. Performs a targeted partial
   * reload of the affected material.
   *
   * @param userId     The ID of the user.
   * @param materialId The source material ID.
   * @param unitId     The unit ID to update.
   * @param status     The new tracking status for the unit.
   * @returns An observable of the refreshed library after the update.
   */
  setUnitProgress(
    userId: string,
    materialId: number,
    unitId: number,
    status: TrackingStatus,
  ): Observable<readonly LibraryItem[]> {
    const body: UpdateUnitProgressRequest = { status: statusToApiCode(status) };
    return this.mutateAndReload(
      this.http.put<void>(this.urlForUnit(userId, materialId, unitId), body),
      userId,
      materialId,
      'Unable to update unit progress.',
      'setUnitProgress',
      { unitId, status },
    );
  }

  /**
   * Clears the tracking progress of a single unit within a library item.
   *
   * Only that unit's own row is removed; child units keep their progress.
   * Triggers a full-library reload since clearing the last tracked unit of a
   * material removes the library entry entirely.
   *
   * @param userId     The ID of the user.
   * @param materialId The source material ID.
   * @param unitId     The unit ID whose progress should be cleared.
   * @returns An observable of the refreshed library after the update.
   */
  clearUnitProgress(
    userId: string,
    materialId: number,
    unitId: number,
  ): Observable<readonly LibraryItem[]> {
    return this.mutateAndReload(
      this.http.delete<void>(this.urlForUnit(userId, materialId, unitId)),
      userId,
      null,
      'Unable to clear the tracking progress.',
      'clearUnitProgress',
      { unitId },
    );
  }

  /**
   * Reorders the user's tracked library.
   *
   * Triggers a full-library reload since ordering affects all items.
   *
   * @param userId                   The ID of the user.
   * @param orderedSourceMaterialIds The source material IDs in the desired order.
   * @returns An observable of the refreshed library after the reorder.
   */
  reorderTrackedItem(
    userId: string,
    orderedSourceMaterialIds: readonly number[],
  ): Observable<readonly LibraryItem[]> {
    const body: ReorderRequest = { orderedSourceMaterialIds: [...orderedSourceMaterialIds] };
    return this.mutateAndReload(
      this.http.put<void>(this.urlForReorder(userId), body),
      userId,
      null,
      'Unable to reorder the library.',
      'reorderTrackedItem',
      { count: orderedSourceMaterialIds.length },
    );
  }
}
