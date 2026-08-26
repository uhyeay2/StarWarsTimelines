/**
 * @fileoverview HTTP interceptor that logs all failed responses to the
 * centralized logger for diagnostics and monitoring.
 */
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../../core/services/logging/logger.service';

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const logger = inject(LoggerService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        logger.error(`HTTP ${error.status} ${request.method} ${request.urlWithParams}`, {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
        });
      } else {
        logger.error(`Request failed ${request.method} ${request.urlWithParams}`, { error });
      }
      return throwError(() => error);
    }),
  );
};
