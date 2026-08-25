/**
 * @fileoverview Domain error type for timeline event operations.
 *
 * {@link TimelineError} is thrown by {@link TimelineEventsService} when a
 * fetch or reload operation fails in a way that requires specific handling
 * by the UI.
 */

/**
 * Machine-readable error codes returned by the timeline events layer.
 *
 * - `'network-error'` — The HTTP request failed entirely (HTTP 5xx / network).
 * - `'not-found'` — The events endpoint does not exist (HTTP 404).
 * - `'validation-error'` — The response body was malformed or missing required fields.
 * - `'server-error'` — The server returned a non-retryable error (HTTP 400 / 401 / etc.).
 */
export type TimelineErrorCode = 'network-error' | 'not-found' | 'validation-error' | 'server-error';

export const TimelineErrorCode = {
  NetworkError: 'network-error' as const,
  NotFound: 'not-found' as const,
  ValidationError: 'validation-error' as const,
  ServerError: 'server-error' as const,
} satisfies Record<string, TimelineErrorCode>;

/**
 * A domain-specific error thrown when a timeline event operation fails.
 *
 * Carries a machine-readable {@link code} that UI consumers can inspect to
 * show context-specific messaging.
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof TimelineError && err.code === TimelineErrorCode.NotFound) {
 *     showNotFoundMessage();
 *   }
 * }
 * ```
 */
export class TimelineError extends Error {
  /** The machine-readable error code. */
  readonly code: TimelineErrorCode;

  constructor(message: string, code: TimelineErrorCode) {
    super(message);
    this.name = 'TimelineError';
    this.code = code;
  }
}
