/**
 * @fileoverview Domain error type for library operations.
 *
 * {@link LibraryError} is thrown by {@link LibraryService} when a CRUD
 * operation fails in a way that requires specific handling by the UI.
 */

/**
 * Machine-readable error codes returned by the library layer.
 *
 * - `'not-found'` — The requested material or user does not exist (HTTP 404).
 * - `'validation-error'` — The request body failed server-side validation (HTTP 400).
 * - `'network-error'` — The HTTP request failed entirely (HTTP 5xx / network).
 */
export type LibraryErrorCode = 'not-found' | 'validation-error' | 'network-error';

export const LibraryErrorCode = {
  NotFound: 'not-found' as const,
  ValidationError: 'validation-error' as const,
  NetworkError: 'network-error' as const,
} satisfies Record<string, LibraryErrorCode>;

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
