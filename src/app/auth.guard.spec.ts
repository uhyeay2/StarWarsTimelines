import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { STORAGE_KEYS } from './services/storage.service';

describe('authGuard', () => {
  let router: Router;

  function configureWithSession(session: Record<string, string>): void {
    sessionStorage.clear();
    for (const [key, value] of Object.entries(session)) {
      sessionStorage.setItem(key, value);
    }
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
  }

  afterEach(() => {
    sessionStorage.clear();
  });

  it('allows navigation when logged in', () => {
    configureWithSession({ [STORAGE_KEYS.user]: JSON.stringify({ id: 'u1' }) });

    const result = TestBed.runInInjectionContext(() =>
      authGuard(null as never, undefined as never),
    );

    expect(result).toBe(true);
  });

  it('redirects to /login when logged out', () => {
    configureWithSession({});

    const result = TestBed.runInInjectionContext(() =>
      authGuard(null as never, undefined as never),
    );

    expect(result.toString()).toBe(router.createUrlTree(['/login']).toString());
  });
});
