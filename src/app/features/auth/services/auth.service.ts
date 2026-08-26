/**
 * @fileoverview Client-side authentication service.
 *
 * Manages login / registration / email-verification flows and holds the
 * authenticated user state in an Angular signal that is kept in sync with
 * sessionStorage.
 *
 * @see {@link AuthGuard} for route-level access control.
 * @see {@link AuthInterceptor} for automatic token attachment.
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthError, AuthErrorCode } from '../models/auth-error';
import { RegisterRequest } from '../models/register-request';
import { User } from '../../../shared/models/user';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import { LoginResponse, RefreshTokenResponse } from './auth.dto';
import { fetchUserProfile } from './account.service';
import { mapRole } from './role.helper';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { STORAGE_KEYS, StorageService } from '../../../shared/services/storage.service';

/** Re-export so existing consumers can import from this module. */
export type { RegisterRequest } from '../models/register-request';

/**
 * Handles authentication, registration, and account-management operations.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * **State management:**
 * - The authenticated user is held in a writable {@link currentUserSignal}
 *   and exposed as a read-only signal `currentUser`.
 * - On construction the signal is seeded from sessionStorage so that a page
 *   refresh preserves the session without an extra HTTP call.
 * - Every mutating method (`login`, `getAccount`, `updateDisplayName`,
 *   `updateEmail`, `logout`) synchronously updates the signal **and**
 *   sessionStorage.
 *
 * **Error handling:**
 * - All HTTP errors are logged via {@link LoggerService} and re-thrown as
 *   plain `Error` or {@link AuthError} instances with a human-readable
 *   message extracted from the ASP.NET Core ProblemDetails response body.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly logger = inject(LoggerService);

  private readonly currentUserSignal = signal<User | null>(this.restoreUser());

  /** Read-only signal of the current user (or `null` when logged out). */
  readonly currentUser = this.currentUserSignal.asReadonly();

  /** Cached JWT access token — kept in sync with sessionStorage. */
  private accessTokenValue = this.restoreToken();

  /** Cached refresh token — kept in sync with sessionStorage. */
  private refreshTokenValue = this.restoreRefreshToken();

  /** Serializes concurrent 401 retries — `null` when no refresh is in flight. */
  readonly refreshMutex$ = new BehaviorSubject<boolean>(false);

  /**
   * Authenticates a user with username and password.
   *
   * On success the JWT token, refresh token, and full user profile are
   * persisted to sessionStorage and the `currentUser` signal emits the new
   * user. The full profile is fetched via `getAccount()` to ensure
   * `email` and `emailVerified` are always present.
   *
   * @param username  The user's login name or email.
   * @param password  The user's password.
   * @returns An observable that emits the authenticated {@link User}.
   * @throws {AuthError} When the credentials are invalid or the email is not
   *   yet verified.
   */
  login(username: string, password: string): Observable<User> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login`, { username, password })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            const body = error.error as { title?: string; detail?: string } | null;
            const detail = body?.detail || 'Invalid username or password';
            const code: AuthErrorCode =
              body?.title === 'Email not verified'
                ? AuthErrorCode.EmailNotVerified
                : AuthErrorCode.InvalidCredentials;
            this.logger.warn('Login failed', { code, detail });
            return throwError(() => new AuthError(detail, code));
          }
          this.logger.error('Login request failed', { error });
          return throwError(
            () =>
              new AuthError(
                'Unable to log in. Please try again.',
                error.status >= 500 ? AuthErrorCode.ServerError : AuthErrorCode.NetworkError,
              ),
          );
        }),
        map((response) => {
          const partialUser = this.mapUser(response.user);
          this.storage.setItem(STORAGE_KEYS.token, response.accessToken);
          this.storage.setItem(STORAGE_KEYS.refreshToken, response.refreshToken);
          this.storage.setItem(STORAGE_KEYS.user, JSON.stringify(partialUser));
          this.accessTokenValue = response.accessToken;
          this.refreshTokenValue = response.refreshToken;
          this.currentUserSignal.set(partialUser);
          return partialUser;
        }),
        // Fetch the full profile so email + emailVerified are always present.
        switchMap((partialUser) =>
          fetchUserProfile(this.http, this.logger, partialUser.id).pipe(
            catchError(() => {
              // If the profile fetch fails, return the partial user from login.
              this.logger.warn('Failed to fetch full profile after login, using partial user');
              return of(partialUser);
            }),
          ),
        ),
      );
  }

  /**
   * Registers a new user account.
   *
   * The user must verify their email before they can log in.
   *
   * @param request  Registration payload (username, email, password).
   * @returns An observable that completes when the account has been created.
   */
  register(request: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/auth/register`, request).pipe(
      catchError((error: HttpErrorResponse) => {
        this.logger.warn('Registration failed', { error });
        return throwError(
          () =>
            new AuthError(
              readProblemDetail(error, 'Unable to create your account. Please try again.'),
              error.status >= 500 ? AuthErrorCode.ServerError : AuthErrorCode.NetworkError,
            ),
        );
      }),
    );
  }

  /**
   * Verifies the user's email address using a one-time token.
   *
   * @param token  The verification token received via email.
   * @returns An observable that completes when the email has been verified.
   */
  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/auth/verify-email`, { token }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.logger.warn('Email verification failed', { error });
        return throwError(
          () =>
            new AuthError(
              readProblemDetail(error, 'Unable to verify your email address. Please try again.'),
              error.status >= 500 ? AuthErrorCode.ServerError : AuthErrorCode.NetworkError,
            ),
        );
      }),
    );
  }

  /**
   * Resends the verification email to the given username or email address.
   *
   * If the currently logged-in user's email is already verified, this method
   * returns immediately without making an HTTP call.
   *
   * @param usernameOrEmail  The username or email of the account to verify.
   * @returns An observable that completes when the email has been queued.
   */
  resendVerificationEmail(usernameOrEmail: string): Observable<void> {
    if (this.currentUserSignal()?.emailVerified) {
      return of(undefined);
    }
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/resend-verification-email`, {
        usernameOrEmail,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.warn('Resend verification email failed', { error });
          return throwError(
            () =>
              new AuthError(
                readProblemDetail(
                  error,
                  'Unable to resend the verification email. Please try again.',
                ),
                error.status >= 500 ? AuthErrorCode.ServerError : AuthErrorCode.NetworkError,
              ),
          );
        }),
      );
  }

  /**
   * Whether the currently logged-in user's email has been verified.
   *
   * @returns `true` if the current user exists and their email is verified.
   */
  isEmailVerified(): boolean {
    return this.currentUserSignal()?.emailVerified ?? false;
  }

  /**
   * Ends the current session.
   *
   * Clears the JWT token, refresh token, and user profile from sessionStorage
   * and resets the `currentUser` signal to `null`.
   *
   * @returns An observable that immediately completes.
   */
  logout(): Observable<void> {
    this.storage.removeItem(STORAGE_KEYS.token);
    this.storage.removeItem(STORAGE_KEYS.refreshToken);
    this.storage.removeItem(STORAGE_KEYS.user);
    this.accessTokenValue = null;
    this.refreshTokenValue = null;
    this.currentUserSignal.set(null);
    return of(undefined);
  }

  /**
   * Whether a user is currently authenticated.
   *
   * @returns `true` when the `currentUser` signal holds a non-null value.
   */
  isLoggedIn(): boolean {
    return this.currentUserSignal() !== null;
  }

  /**
   * Returns the current user synchronously from the in-memory signal.
   *
   * @returns The current {@link User}, or `null` when logged out.
   */
  getCurrentUser(): User | null {
    return this.currentUserSignal();
  }

  /**
   * Returns the cached JWT access token.
   *
   * @returns The token string, or `null` when not authenticated.
   */
  getToken(): string | null {
    return this.accessTokenValue;
  }

  /**
   * Returns the cached refresh token.
   *
   * @returns The refresh token string, or `null` when not authenticated.
   */
  getRefreshToken(): string | null {
    return this.refreshTokenValue;
  }

  /**
   * Exchanges the current refresh token for a new access + refresh token pair.
   *
   * On success the new tokens are persisted to sessionStorage and the cached
   * values are updated. On failure the user is logged out.
   *
   * @returns An observable that emits `true` on success, `false` on failure.
   */
  refreshAccessToken(): Observable<boolean> {
    const refreshToken = this.refreshTokenValue;
    if (!refreshToken) {
      this.logout();
      return of(false);
    }
    return this.http
      .post<RefreshTokenResponse>(`${environment.apiBaseUrl}/api/auth/refresh`, { refreshToken })
      .pipe(
        map((response) => {
          this.storage.setItem(STORAGE_KEYS.token, response.accessToken);
          this.storage.setItem(STORAGE_KEYS.refreshToken, response.refreshToken);
          this.accessTokenValue = response.accessToken;
          this.refreshTokenValue = response.refreshToken;
          return true;
        }),
        catchError((error) => {
          this.logger.warn('Token refresh failed, logging out', { error });
          this.logout();
          return of(false);
        }),
      );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Reads the cached JWT access token from sessionStorage.
   *
   * @returns The token, or `null` if not present.
   */
  private restoreToken(): string | null {
    return this.storage.getItem(STORAGE_KEYS.token);
  }

  /**
   * Reads the cached refresh token from sessionStorage.
   *
   * @returns The refresh token, or `null` if not present.
   */
  private restoreRefreshToken(): string | null {
    return this.storage.getItem(STORAGE_KEYS.refreshToken);
  }

  /**
   * Reads and parses the cached user from sessionStorage.
   *
   * If the stored JSON is malformed the entry is removed and `null` is
   * returned.
   *
   * @returns The cached {@link User}, or `null`.
   */
  private restoreUser(): User | null {
    const stored = this.storage.getItem(STORAGE_KEYS.user);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as User;
    } catch {
      this.storage.removeItem(STORAGE_KEYS.user);
      return null;
    }
  }

  /**
   * Maps the minimal user object from the login response to a partial
   * {@link User}.
   *
   * The returned object does **not** include `email` or `emailVerified` —
   * the AccountService will fetch the full profile.
   *
   * @param response  The `user` field from {@link LoginResponse}.
   * @returns A partial domain-level {@link User}.
   */
  private mapUser(response: LoginResponse['user']): User {
    return {
      id: response.id,
      username: response.username,
      displayName: response.displayName,
      email: '',
      emailVerified: false,
      role: mapRole(response.role),
    };
  }

  /**
   * Synchronises the in-memory user signal and sessionStorage.
   *
   * Called by {@link AccountService} after profile read/write operations
   * to keep auth state consistent.
   *
   * @param user  The updated domain-level {@link User}.
   */
  syncUser(user: User): void {
    this.storage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    this.currentUserSignal.set(user);
  }
}
