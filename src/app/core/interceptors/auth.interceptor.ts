import { HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, finalize, switchMap, take } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { ROUTES } from '../../shared/constants/routes.constants';

let refreshInProgress$: BehaviorSubject<boolean> | null = null;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isAuthEndpoint(request.url)) {
    return next(request);
  }

  const token = auth.getToken();
  const authRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !auth.getRefreshToken()) {
        throw error;
      }
      return handle401(auth, router, next, request);
    }),
  );
};

function handle401(
  auth: AuthService,
  router: Router,
  next: (req: Parameters<HttpInterceptorFn>[0]) => Observable<HttpEvent<unknown>>,
  request: Parameters<HttpInterceptorFn>[0],
): Observable<HttpEvent<unknown>> {
  if (!auth.getRefreshToken()) {
    void auth.logout();
    void router.navigateByUrl(ROUTES.LOGIN);
    return next(request);
  }

  if (refreshInProgress$) {
    return refreshInProgress$.pipe(
      filter((inProgress) => !inProgress),
      take(1),
      switchMap(() => {
        const newToken = auth.getToken();
        if (!newToken) {
          // A missing token after refresh means an explicit logout happened
          // concurrently; let that flow own the redirect instead of forcing
          // the user to /login.
          if (auth.isLoggedIn()) {
            void router.navigateByUrl(ROUTES.LOGIN);
          }
          return next(request);
        }
        return next(request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
      }),
    );
  }

  refreshInProgress$ = new BehaviorSubject<boolean>(true);

  return auth.refreshAccessToken().pipe(
    switchMap((success) => {
      if (!success) {
        void router.navigateByUrl(ROUTES.LOGIN);
        return next(request);
      }
      return next(request.clone({ setHeaders: { Authorization: `Bearer ${auth.getToken()!}` } }));
    }),
    finalize(() => {
      refreshInProgress$?.next(false);
      refreshInProgress$ = null;
    }),
  );
}

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/register') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/verify-email') ||
    url.includes('/api/auth/resend-verification-email')
  );
}
