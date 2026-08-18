/**
 * @fileoverview Domain error types for catalog operations.
 *
 * {@link CatalogError} is thrown by {@link CatalogService} when a create,
 * update, or delete operation fails in a way that requires specific handling
 * (e.g. showing a "referenced by timeline events" message).
 */

/**
 * Machine-readable error codes returned by the catalog layer.
 *
 * - `'entity-in-use'` — The entity cannot be deleted because it is referenced
 *   by one or more timeline events.
 * - `'not-found'` — The requested entity does not exist.
 * - `'validation-error'` — The request body failed server-side validation.
 * - `'network-error'` — The HTTP request failed entirely.
 */
export type CatalogErrorCode =
  | 'entity-in-use'
  | 'not-found'
  | 'validation-error'
  | 'network-error';

/**
 * A domain-specific error thrown when a catalog CRUD operation fails.
 *
 * Carries a machine-readable {@link code} that UI consumers can inspect to show
 * context-specific messaging (e.g. a warning that the entity is in use).
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof CatalogError && err.code === 'entity-in-use') {
 *     showEntityInUseWarning();
 *   }
 * }
 * ```
 */
export class CatalogError extends Error {
  /** The machine-readable error code. */
  readonly code: CatalogErrorCode;

  constructor(message: string, code: CatalogErrorCode) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
  }
}

/**
 * Thrown when a delete operation fails because the entity is referenced
 * by one or more timeline events (HTTP 409 Conflict).
 *
 * Extends {@link CatalogError} with `code = 'entity-in-use'` so that
 * consumers can distinguish this from other catalog errors without
 * inspecting the HTTP status code.
 */
export class EntityInUseError extends CatalogError {
  constructor(message: string) {
    super(message, 'entity-in-use');
    this.name = 'EntityInUseError';
  }
}
