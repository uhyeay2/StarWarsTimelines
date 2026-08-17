/**
 * @fileoverview Client-side authentication service.
 *
 * Manages login / registration / email-verification flows and holds the
 * authenticated user state in a {@link https://github.com/ngrx/platform/blob/main/docs/rxjs/spec/operators.ts|BehaviorSubject}
 * that is kept in sync with localStorage.
 *
 * @see {@link AuthGuard} for route-level access control.
 * @see {@link AuthInterceptor} for automatic token attachment.
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthError, AuthErrorCode } from '../models/auth/auth-error';
import { RegisterRequest } from '../models/auth/register-request';
import { User, UserRole, USER_ROLES } from '../models/user';
import { readProblemDetail } from '../utils/problem-detail';
import { AccountResponse, LoginResponse } from './auth/auth.dto';

/** Re-export so existing consumers can import from this module. */
export type { RegisterRequest } from '../models/auth/register-request';

/** localStorage key for the JWT bearer token. */
const TOKEN_STORAGE_KEY = 'starwars-timelines.token';
/** localStorage key for the serialized {@link User} object. */
const USER_STORAGE_KEY = 'starwars-timelines.user';

/**
 * Handles authentication, registration, and account-management operations.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * **State management:**
 * - The authenticated user is held in `currentUserSubject` and exposed via the
 *   read-only observable `currentUser$`.
 * - On construction the subject is seeded from localStorage so that a page
 *   refresh preserves the session without an extra HTTP call.
 * - Every mutating method (`login`, `getAccount`, `updateDisplayName`,
 *   `updateEmail`, `logout`) synchronously updates the subject **and**
 *   localStorage.
 *
 * **Error handling:**
 * - All HTTP errors are caught and re-thrown as plain `Error` or
 *   {@link AuthError} instances with a human-readable message extracted from the
 *   ASP.NET Core {@link https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.problemdetails|ProblemDetails}
 *   response body.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSubject = new BehaviorSubject<User | null>(this.restoreUser());

  /** Observable stream of the current user (or `null` when logged out). */
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  /** Cached JWT token — kept in sync with localStorage. */
  private tokenValue = this.restoreToken();

  constructor(private readonly http: HttpClient) {}

  /**
   * Authenticates a user with username and password.
   *
   * On success the JWT token and user profile are persisted to localStorage
   * and the `currentUser$` observable emits the new user.
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
            return throwError(() => new AuthError(detail, code));
          }
          return throwError(() => new Error('Unable to log in. Please try again.'));
        }),
        map((response) => {
          const user = this.mapUser(response.user);
          localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
          this.tokenValue = response.token;
          this.currentUserSubject.next(user);
          return user;
        }),
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
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to create your account. Please try again.'),
              ),
          ),
        ),
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
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to verify your email address. Please try again.'),
              ),
          ),
        ),
      );
  }

  /**
   * Resends the verification email to the given username or email address.
   *
   * @param usernameOrEmail  The username or email of the account to verify.
   * @returns An observable that completes when the email has been queued.
   */
  resendVerificationEmail(usernameOrEmail: string): Observable<void> {
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/resend-verification-email`, { usernameOrEmail })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to resend the verification email. Please try again.'),
              ),
          ),
        ),
      );
  }

  /**
   * Fetches the full account profile for the given user.
   *
   * Also updates the local user state and localStorage.
   *
   * @param userId  The ID of the user to load.
   * @returns An observable that emits the refreshed {@link User}.
   */
  getAccount(userId: string): Observable<User> {
    return this.http
      .get<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to load your account details. Please try again.'),
              ),
          ),
        ),
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
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to update your display name. Please try again.'),
              ),
          ),
        ),
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
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to update your email address. Please try again.'),
              ),
          ),
        ),
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
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to change your password. Please try again.'),
              ),
          ),
        ),
      );
  }

  /**
   * Ends the current session.
   *
   * Clears the JWT token and user profile from localStorage and resets the
   * `currentUser$` observable to `null`.
   *
   * @returns An observable that immediately completes.
   */
  logout(): Observable<void> {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    this.tokenValue = null;
    this.currentUserSubject.next(null);
    return of(undefined);
  }

  /**
   * Whether a user is currently authenticated.
   *
   * @returns `true` when the `currentUser$` subject holds a non-null value.
   */
  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Returns the current user synchronously from the in-memory subject.
   *
   * This is the preferred way to read the current user — it avoids the cost of
   * re-parsing localStorage on every call.
   *
   * @returns The current {@link User}, or `null` when logged out.
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Returns the cached JWT bearer token.
   *
   * @returns The token string, or `null` when not authenticated.
   */
  getToken(): string | null {
    return this.tokenValue;
  }

  /**
   * Reads the cached JWT token from localStorage.
   *
   * @returns The token, or `null` if not present.
   */
  private restoreToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  /**
   * Reads and parses the cached user from localStorage.
   *
   * If the stored JSON is malformed the entry is removed and `null` is
   * returned.
   *
   * @returns The cached {@link User}, or `null`.
   */
  private restoreUser(): User | null {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as User;
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
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
   * Maps the minimal user object from the login response to a full
   * {@link User}.
   *
   * @param response  The `user` field from {@link LoginResponse}.
   * @returns A domain-level {@link User}.
   */
  private mapUser(response: LoginResponse['user']): User {
    return {
      id: response.id,
      username: response.username,
      displayName: response.displayName,
      role: this.mapRole(response.role),
    };
  }

  /**
   * Applies a full {@link AccountResponse} to the local user state.
   *
   * Updates localStorage and notifies subscribers via `currentUserSubject`.
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
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return user;
  }
}
