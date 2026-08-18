/**
 * @fileoverview Domain error type for library operations.
 *
 * {@link LibraryError} is thrown by {@link LibraryService} when a CRUD
 * operation fails in a way that requires specific handling by the UI.
 */

/**
 * Machine-readable error codes returned by the library layer.
 *
 * - `NotFound` — The requested material or user does not exist (HTTP 404).
 * - `ValidationError` — The request body failed server-side validation (HTTP 400).
 * - `NetworkError` — The HTTP request failed entirely (HTTP 5xx / network).
 */
export enum LibraryErrorCode {
  NotFound = 'not-found',
  ValidationError = 'validation-error',
  NetworkError = 'network-error',
}

/**
 * A domain-specific error thrown when a library CRUD operation fails.
 *
 * Carries a machine-readable {@link code} that UI consumers can inspect to show
 * context-specific messaging.
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof LibraryError && err.code === LibraryErrorCode.NotFound) {
 *     showNotFoundMessage();
 *   }
 * }
 * ```
 */
export class LibraryError extends Error {
  /** The machine-readable error code. */
  readonly code: LibraryErrorCode;

  constructor(message: string, code: LibraryErrorCode) {
    super(message);
    this.name = 'LibraryError';
    this.code = code;
  }
}
