import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { LoggerService } from '../../shared/services/logging/logger.service';

/** Security headers the API should include in every response. */
const EXPECTED_SECURITY_HEADERS = ['x-content-type-options', 'x-frame-options'] as const;

/**
 * Warns when API responses are missing recommended security headers.
 *
 * This is a defence-in-depth check — the headers themselves must be set
 * by the server (IIS / nginx / API middleware).
 */
export const securityHeadersInterceptor: HttpInterceptorFn = (request, next) => {
  const logger = inject(LoggerService);

  return next(request).pipe(
    tap({
      next: (event) => {
        if ('headers' in event) {
          const response = event as { headers: { get: (name: string) => string | null } };
          for (const header of EXPECTED_SECURITY_HEADERS) {
            if (!response.headers.get(header)) {
              logger.warn(`Missing security header: ${header}`, { url: request.url });
            }
          }
        }
      },
    }),
  );
};
