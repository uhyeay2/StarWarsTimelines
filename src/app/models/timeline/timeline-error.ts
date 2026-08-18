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
 * - `NetworkError` — The HTTP request failed entirely (HTTP 5xx / network).
 * - `NotFound` — The events endpoint does not exist (HTTP 404).
 * - `ValidationError` — The response body was malformed or missing required fields.
 * - `ServerError` — The server returned a non-retryable error (HTTP 400 / 401 / etc.).
 */
export enum TimelineErrorCode {
  NetworkError = 'network-error',
  NotFound = 'not-found',
  ValidationError = 'validation-error',
  ServerError = 'server-error',
}

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
