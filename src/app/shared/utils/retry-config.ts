/**
 * @fileoverview Shared retry configuration and helpers for HTTP requests.
 *
 * Centralises the retry-count and backoff-delay constants used by
 * {@link TimelineEventsService} and {@link LibraryCacheManager}, and
 * provides a reusable `transientRetryDelay` function for the common
 * 503/504 retry-with-backoff pattern.
 */

import { HttpErrorResponse } from '@angular/common/http';
import { timer, throwError } from 'rxjs';

/** Default maximum number of automatic retries for transient server errors. */
export const DEFAULT_MAX_RETRIES = 3;

/** Default base delay in milliseconds for exponential retry backoff. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/**
 * Retry delay function for transient server errors (503 / 504).
 *
 * Returns an observable that emits after an exponential backoff delay
 * for the given retry attempt. For non-transient errors, re-throws
 * immediately.
 *
 * @param error             The HTTP error that triggered the retry.
 * @param retryCount        The current retry attempt (1-based).
 * @param baseDelayMs       The base delay for exponential backoff.
 * @param transientStatuses HTTP status codes considered transient.
 * @returns An observable delay for transient errors, or a throwing observable.
 */
export function transientRetryDelay(
  error: HttpErrorResponse,
  retryCount: number,
  baseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  transientStatuses: readonly number[] = [503, 504],
): ReturnType<typeof timer> {
  if (error instanceof HttpErrorResponse && transientStatuses.includes(error.status)) {
    return timer(baseDelayMs * Math.pow(2, retryCount - 1));
  }
  return throwError(() => error);
}
