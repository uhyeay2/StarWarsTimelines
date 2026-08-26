import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  CatalogError,
  CatalogErrorCode,
  DuplicateEntityError,
  EntityInUseError,
} from '../models/catalog-error';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import { LoggerService } from '../../../core/services/logging/logger.service';

/**
 * Returns a `catchError` callback that extracts the server-provided error
 * message from a ProblemDetails body, logs it, and re-throws as a typed
 * catalog error.
 *
 * @param fallback      A human-readable default when the server does not provide one.
 * @param context       A short label for log context (e.g. `'createCharacter'`).
 * @param conflictCode  The error code used to type conflicts (HTTP 409).
 * @param logger        The logger instance for structured logging.
 * @returns A function suitable for `catchError(...)`.
 */
export function catalogErrorHandler(
  fallback: string,
  context: string,
  conflictCode: CatalogErrorCode = CatalogErrorCode.EntityInUse,
  logger: LoggerService,
): (error: HttpErrorResponse) => Observable<never> {
  return (error: HttpErrorResponse) => {
    const detail = readProblemDetail(error, fallback);

    if (error.status === 409) {
      logger.warn(`[CatalogService] ${context}: ${detail}`, { error });
      return throwError(() =>
        conflictCode === CatalogErrorCode.DuplicateEntity
          ? new DuplicateEntityError(detail)
          : new EntityInUseError(detail),
      );
    }

    if (error.status === 404) {
      logger.warn(`[CatalogService] ${context}: ${detail}`, { error });
      return throwError(() => new CatalogError(detail, CatalogErrorCode.NotFound));
    }

    logger.error(`[CatalogService] ${context}: ${detail}`, { error });
    return throwError(() => new CatalogError(detail, CatalogErrorCode.NetworkError));
  };
}
