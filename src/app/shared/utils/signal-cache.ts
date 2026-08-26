/**
 * @fileoverview Reusable signal-based cache holder with optional TTL.
 *
 * Wraps an RxJS fetch function in Angular signals for `data`, `loading`,
 * and `error`. Supports automatic expiry (TTL) as a resilience fallback
 * and manual invalidation for event-driven cache busting.
 *
 * Public signal properties are typed as `Signal<T>` (read-only). The class
 * itself mutates via private `_data`/`_loading`/`_error` fields. External
 * callers that need controlled write access (e.g., partial cache merges)
 * can use {@link setData}, {@link setLoading}, and {@link setError}.
 *
 * @example
 * ```ts
 * private readonly cache = new SignalCache(
 *   () => this.http.get<Character[]>('/api/characters'),
 *   (err) => readProblemDetail(err, 'Failed to load'),
 *   300_000, // 5-minute TTL
 * );
 *
 * readonly characters = this.cache.data;
 * readonly loading = this.cache.loading;
 * ```
 */

import { Signal, signal, WritableSignal } from '@angular/core';
import { catchError, finalize, Observable, of } from 'rxjs';

/**
 * A signal-backed cache that fetches data from an Observable source and
 * exposes the result as read-only Angular signals.
 *
 * @typeParam T  The cached data type.
 */
export class SignalCache<T> {
  private readonly _data: WritableSignal<T | null> = signal(null);
  private readonly _loading: WritableSignal<boolean> = signal(false);
  private readonly _error: WritableSignal<string | null> = signal(null);

  /** The cached data, or `null` when no data has been loaded / after invalidation. */
  readonly data: Signal<T | null> = this._data.asReadonly();

  /** Whether a fetch is currently in flight. */
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  /** The last error message, or `null` when there is no error. */
  readonly error: Signal<string | null> = this._error.asReadonly();

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

  /** Sets the cached data value directly. */
  setData(value: T | null): void {
    this._data.set(value);
  }

  /** Sets the loading state directly. */
  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  /** Sets the error state directly. */
  setError(value: string | null): void {
    this._error.set(value);
  }

  /**
   * Fetches data from the source and updates the signals.
   *
   * Guarded against concurrent calls — if a fetch is already in flight
   * or data is already cached, this method is a no-op.
   */
  fetch(): void {
    if (this._loading() || this._data() !== null) {
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.fetchFn()
      .pipe(
        finalize(() => this._loading.set(false)),
        catchError((err: unknown) => {
          this._error.set(this.errorHandler?.(err) ?? 'Failed to load data');
          return of(null as T | null);
        }),
      )
      .subscribe((data) => {
        this._data.set(data);
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
    this._data.set(null);
    this.fetch();
  }

  /** Schedules the next TTL expiry after data is loaded. */
  private scheduleExpiration(): void {
    this.clearExpiration();
    if (this.ttlMs > 0) {
      this.expirationTimer = setTimeout(() => {
        this._data.set(null);
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
