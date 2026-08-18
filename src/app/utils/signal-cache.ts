/**
 * @fileoverview Reusable signal-based cache holder with optional TTL.
 *
 * Wraps an RxJS fetch function in Angular signals for `data`, `loading`,
 * and `error`. Supports automatic expiry (TTL) as a resilience fallback
 * and manual invalidation for event-driven cache busting.
 *
 * @example
 * ```ts
 * private readonly cache = new SignalCache(
 *   () => this.http.get<Character[]>('/api/characters'),
 *   (err) => readProblemDetail(err, 'Failed to load'),
 *   300_000, // 5-minute TTL
 * );
 *
 * readonly characters = this.cache.data.asReadonly();
 * readonly loading = this.cache.loading.asReadonly();
 * ```
 */

import { signal, WritableSignal } from '@angular/core';
import { catchError, finalize, Observable, of, tap } from 'rxjs';

/**
 * A signal-backed cache that fetches data from an Observable source and
 * exposes the result as Angular signals.
 *
 * @typeParam T  The cached data type.
 */
export class SignalCache<T> {
  /** The cached data, or `null` when no data has been loaded / after invalidation. */
  readonly data: WritableSignal<T | null> = signal(null);

  /** Whether a fetch is currently in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** The last error message, or `null` when there is no error. */
  readonly error: WritableSignal<string | null> = signal(null);

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param fetchFn      A function that returns an Observable of the data to cache.
   * @param errorHandler Optional function that maps a raw error to a display string.
   * @param ttlMs        Time-to-live in milliseconds. When > 0, the cache auto-expires
   *                     and re-fetches after this duration. Defaults to 0 (no expiry).
   */
  constructor(
    private readonly fetchFn: () => Observable<T>,
    private readonly errorHandler?: (err: unknown) => string,
    private readonly ttlMs = 0,
  ) {}

  /**
   * Fetches data from the source and updates the signals.
   *
   * Guarded against concurrent calls — if a fetch is already in flight,
   * this method is a no-op.
   */
  fetch(): void {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.fetchFn()
      .pipe(
        finalize(() => this.loading.set(false)),
        catchError((err: unknown) => {
          this.error.set(this.errorHandler?.(err) ?? 'Failed to load data');
          return of(null as T | null);
        }),
      )
      .subscribe((data) => {
        this.data.set(data);
        this.scheduleExpiration();
      });
  }

  /**
   * Clears the current data and immediately re-fetches.
   *
   * Use after a mutation (create / update / delete) to ensure the cache
   * reflects the latest server state.
   */
  invalidate(): void {
    this.clearExpiration();
    this.data.set(null);
    this.fetch();
  }

  /** Schedules the next TTL expiry after data is loaded. */
  private scheduleExpiration(): void {
    this.clearExpiration();
    if (this.ttlMs > 0) {
      this.expirationTimer = setTimeout(() => {
        this.data.set(null);
        this.fetch();
      }, this.ttlMs);
    }
  }

  /** Cancels any pending TTL expiry timer. */
  private clearExpiration(): void {
    if (this.expirationTimer !== null) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }
}
