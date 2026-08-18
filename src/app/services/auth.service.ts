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
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthError, AuthErrorCode } from '../models/auth/auth-error';
import { RegisterRequest } from '../models/auth/register-request';
import { User, UserRole, USER_ROLES } from '../models/user';
import { readProblemDetail } from '../utils/problem-detail';
import { AccountResponse, LoginResponse, RefreshTokenResponse } from './auth/auth.dto';
import { LoggerService } from './logger.service';
import { STORAGE_KEYS, StorageService } from './storage.service';

/** Re-export so existing consumers can import from this module. */
export type { RegisterRequest } from '../models/auth/register-request';

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
  private readonly currentUserSignal = signal<User | null>(this.restoreUser());

  /** Read-only signal of the current user (or `null` when logged out). */
  readonly currentUser = this.currentUserSignal.asReadonly();

  /** Cached JWT access token — kept in sync with sessionStorage. */
  private accessTokenValue = this.restoreToken();

  /** Cached refresh token — kept in sync with sessionStorage. */
  private refreshTokenValue = this.restoreRefreshToken();

  constructor(
    private readonly http: HttpClient,
    private readonly storage: StorageService,
    private readonly logger: LoggerService,
  ) {}

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
            const code: AuthErrorCode = body?.title === 'Email not verified'
              ? 'email-not-verified'
              : 'invalid-credentials';
            this.logger.warn('Login failed', { code, detail });
            return throwError(() => new AuthError(detail, code));
          }
          this.logger.error('Login request failed', error);
          return throwError(() => new Error('Unable to log in. Please try again.'));
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
          this.getAccount(partialUser.id).pipe(
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
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/register`, request)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.warn('Registration failed', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to create your account. Please try again.'),
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
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/verify-email`, { token })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.warn('Email verification failed', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to verify your email address. Please try again.'),
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
      .post<void>(`${environment.apiBaseUrl}/api/auth/resend-verification-email`, { usernameOrEmail })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.warn('Resend verification email failed', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to resend the verification email. Please try again.'),
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
   * Fetches the full account profile for the given user.
   *
   * Also updates the local user state and sessionStorage.
   *
   * @param userId  The ID of the user to load.
   * @returns An observable that emits the refreshed {@link User}.
   */
  getAccount(userId: string): Observable<User> {
    return this.http
      .get<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Failed to load account details', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to load your account details. Please try again.'),
              ),
          );
        }),
        map((response) => this.applyAccount(response)),
      );
  }

  /**
   * Updates the user's display name.
   *
   * @param userId       The ID of the user to update.
   * @param displayName  The new display name.
   * @returns An observable that emits the updated {@link User}.
   */
  updateDisplayName(userId: string, displayName: string): Observable<User> {
    return this.http
      .put<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}/display-name`, { displayName })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Failed to update display name', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to update your display name. Please try again.'),
              ),
          );
        }),
        map((response) => this.applyAccount(response)),
      );
  }

  /**
   * Updates the user's email address.
   *
   * @param userId  The ID of the user to update.
   * @param email   The new email address.
   * @returns An observable that emits the updated {@link User}.
   */
  updateEmail(userId: string, email: string): Observable<User> {
    return this.http
      .put<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}/email`, { email })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Failed to update email', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to update your email address. Please try again.'),
              ),
          );
        }),
        map((response) => this.applyAccount(response)),
      );
  }

  /**
   * Changes the user's password.
   *
   * @param userId           The ID of the user.
   * @param currentPassword  The user's current password (verified server-side).
   * @param newPassword      The desired new password.
   * @returns An observable that completes when the password has been changed.
   */
  updatePassword(userId: string, currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .put<void>(`${environment.apiBaseUrl}/api/users/${userId}/password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Failed to change password', error);
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to change your password. Please try again.'),
              ),
          );
        }),
      );
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
          this.logger.warn('Token refresh failed, logging out', error);
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
    return sessionStorage.getItem(STORAGE_KEYS.token);
  }

  /**
   * Reads the cached refresh token from sessionStorage.
   *
   * @returns The refresh token, or `null` if not present.
   */
  private restoreRefreshToken(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.refreshToken);
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
    const stored = sessionStorage.getItem(STORAGE_KEYS.user);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as User;
    } catch {
      sessionStorage.removeItem(STORAGE_KEYS.user);
      return null;
    }
  }

  /**
   * Converts a numeric role code into a {@link UserRole} string.
   *
   * Falls back to `'Standard'` for unknown codes.
   *
   * @param roleCode  The numeric role index from the server.
   * @returns The corresponding {@link UserRole}.
   */
  private mapRole(roleCode: number): UserRole {
    return (USER_ROLES[roleCode] ?? 'Standard') as UserRole;
  }

  /**
   * Maps the minimal user object from the login response to a partial
   * {@link User}.
   *
   * The returned object does **not** include `email` or `emailVerified` —
   * call {@link getAccount} to fetch the full profile.
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
      role: this.mapRole(response.role),
    };
  }

  /**
   * Applies a full {@link AccountResponse} to the local user state.
   *
   * Updates sessionStorage and notifies signal subscribers.
   *
   * @param response  The full account DTO from the server.
   * @returns The updated domain-level {@link User}.
   */
  private applyAccount(response: AccountResponse): User {
    const user: User = {
      id: response.id,
      username: response.username,
      displayName: response.displayName,
      email: response.email,
      emailVerified: response.emailVerified,
      role: this.mapRole(response.role),
    };
    this.storage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    this.currentUserSignal.set(user);
    return user;
  }
}
