/**
 * @fileoverview Manages the signal-based cache and reload pipeline for the
 * user's tracked-source-material library.
 *
 * Extracted from {@link LibraryService} to separate cache lifecycle concerns
 * from CRUD operations.
 */

import { inject, Injectable, signal, untracked, WritableSignal } from '@angular/core';
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
import { environment } from '../../../../environments/environment';
import { LibraryItem } from '../../../shared/models/library-item';
import { LibraryError, LibraryErrorCode } from '../models/library-error';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { LibraryItemDto } from './library.dto';
import { isValidItemDto, mapLibraryItem } from './library.mapper';

/** Base URL for all library API endpoints. */
const BASE = `${environment.apiBaseUrl}/api/users`;

/** Maximum number of automatic retries for transient server errors. */
const RETRY_COUNT = 3;

/** Base delay in milliseconds for exponential retry backoff. */
const RETRY_BASE_DELAY_MS = 1000;

/** Debounce window in milliseconds for explicit `reload()` calls. */
const RELOAD_DEBOUNCE_MS = 200;

/**
 * Manages the signal-based cache, reload pipeline, and internal fetch/retry
 * logic for the user's tracked-source-material library.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 */
@Injectable({ providedIn: 'root' })
export class LibraryCacheManager {
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
          if (err instanceof HttpErrorResponse) {
            this.error.set(readProblemDetail(err, 'Unable to load library.'));
          } else {
            this.error.set('Unable to load library.');
          }
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ─── URL helpers ──────────────────────────────────────────────────────────

  urlFor(userId: string): string {
    return `${BASE}/${userId}/source-materials`;
  }

  urlForMaterial(userId: string, materialId: number): string {
    return `${this.urlFor(userId)}/${materialId}`;
  }

  urlForUnit(userId: string, materialId: number, unitId: number): string {
    return `${this.urlForMaterial(userId, materialId)}/units/${unitId}`;
  }

  urlForReorder(userId: string): string {
    return `${this.urlFor(userId)}/reorder`;
  }

  // ─── Internal fetch with retry ────────────────────────────────────────────

  fetchItems(userId: string): Observable<readonly LibraryItem[]> {
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
      map((items) => items.filter(isValidItemDto).map(mapLibraryItem) as readonly LibraryItem[]),
    );
  }

  reloadMaterial(userId: string, materialId: number): Observable<readonly LibraryItem[]> {
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

  handleError(
    fallback: string,
    context: string,
    meta?: Record<string, unknown>,
  ): (error: unknown) => Observable<never> {
    return (error: unknown) => {
      if (error instanceof LibraryError) {
        return throwError(() => error);
      }

      if (error instanceof HttpErrorResponse) {
        const detail = readProblemDetail(error, fallback);
        const logPayload = { ...meta, status: error.status, url: error.url };

        if (error.status === 404) {
          this.logger.warn(`[LibraryService] ${context}: ${detail}`, logPayload);
          return throwError(() => new LibraryError(detail, LibraryErrorCode.NotFound));
        }

        if (error.status === 400) {
          this.logger.warn(`[LibraryService] ${context}: ${detail}`, logPayload);
          return throwError(() => new LibraryError(detail, LibraryErrorCode.ValidationError));
        }

        this.logger.error(`[LibraryService] ${context}: ${detail}`, logPayload);
        return throwError(() => new LibraryError(detail, LibraryErrorCode.NetworkError));
      }

      this.logger.error(`[LibraryService] ${context}: ${fallback}`, { ...meta, error });
      return throwError(() => new LibraryError(fallback, LibraryErrorCode.NetworkError));
    };
  }

  // ─── Centralized mutation → reload ────────────────────────────────────────

  mutateAndReload<T>(
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
        this.handleError('Reload failed after mutation.', `${context}:reload`, {
          userId,
          materialId,
        }),
      ),
    );
  }

  // ─── Public cache operations ──────────────────────────────────────────────

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
          if (err instanceof HttpErrorResponse) {
            this.error.set(readProblemDetail(err, 'Unable to load library.'));
          } else {
            this.error.set('Unable to load library.');
          }
        },
      }),
      finalize(() => this.loading.set(false)),
      catchError(this.handleError('Unable to load library.', 'getTracked', { userId })),
    );
  }

  ensureTracked(userId: string): void {
    // Cache state is read untracked on purpose: callers invoke this from
    // reactive contexts (page `effect`s). A tracked `loading()` read would
    // register `loading` as a dependency of the calling effect, and the
    // true→false toggle when the fetch settles would re-trigger that effect —
    // refetching (and failing) in an endless loop that freezes the page.
    const isInFlight = untracked(() => this.loading());
    if (isInFlight || this.loadedUserId === userId) {
      return;
    }
    this.getTracked(userId).subscribe({ error: () => undefined });
  }

  clearCache(): void {
    this.activeUserId = null;
    this.loadedUserId = null;
    this.items.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  reload(): void {
    this.reloadTrigger.next();
  }
}
