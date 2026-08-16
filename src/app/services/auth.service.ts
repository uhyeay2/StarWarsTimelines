import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, UserRole } from '../models/user';

const TOKEN_STORAGE_KEY = 'starwars-timelines.token';
const USER_STORAGE_KEY = 'starwars-timelines.user';
const USER_ROLES = ['Standard', 'Admin'] as const;

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: number;
  };
}

interface AccountResponse {
  id: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  role: number;
}

export interface RegisterRequest {
  username: string;
  displayName?: string;
  email: string;
  password: string;
}

export type AuthErrorCode = 'email-not-verified' | 'invalid-credentials';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(message: string, code: AuthErrorCode) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSubject = new BehaviorSubject<User | null>(this.restoreUser());
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  private tokenValue = this.restoreToken();

  constructor(private readonly http: HttpClient) {}

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

  register(request: RegisterRequest): Observable<void> {
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/register`, request)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                this.readProblemDetail(error, 'Unable to create your account. Please try again.'),
              ),
          ),
        ),
      );
  }

  verifyEmail(token: string): Observable<void> {
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/verify-email`, { token })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                this.readProblemDetail(error, 'Unable to verify your email address. Please try again.'),
              ),
          ),
        ),
      );
  }

  resendVerificationEmail(usernameOrEmail: string): Observable<void> {
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/auth/resend-verification-email`, { usernameOrEmail })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                this.readProblemDetail(error, 'Unable to resend the verification email. Please try again.'),
              ),
          ),
        ),
      );
  }

  getAccount(userId: string): Observable<User> {
    return this.http
      .get<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                this.readProblemDetail(error, 'Unable to load your account details. Please try again.'),
              ),
          ),
        ),
        map((response) => this.applyAccount(response)),
      );
  }

  updateDisplayName(userId: string, displayName: string): Observable<User> {
    return this.http
      .put<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}/display-name`, { displayName })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                this.readProblemDetail(error, 'Unable to update your display name. Please try again.'),
              ),
          ),
        ),
        map((response) => this.applyAccount(response)),
      );
  }

  updateEmail(userId: string, email: string): Observable<User> {
    return this.http
      .put<AccountResponse>(`${environment.apiBaseUrl}/api/users/${userId}/email`, { email })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                this.readProblemDetail(error, 'Unable to update your email address. Please try again.'),
              ),
          ),
        ),
        map((response) => this.applyAccount(response)),
      );
  }

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
                this.readProblemDetail(error, 'Unable to change your password. Please try again.'),
              ),
          ),
        ),
        map(() => undefined),
      );
  }

  logout(): Observable<void> {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    this.tokenValue = null;
    this.currentUserSubject.next(null);
    return of(undefined);
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.restoreUser();
  }

  getToken(): string | null {
    return this.tokenValue;
  }

  private restoreToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

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

  private mapUser(response: LoginResponse['user']): User {
    const role = USER_ROLES[response.role];
    return {
      id: response.id,
      username: response.username,
      displayName: response.displayName,
      role: (role ?? 'Standard') as UserRole,
    };
  }

  private applyAccount(response: AccountResponse): User {
    const role = USER_ROLES[response.role];
    const user: User = {
      id: response.id,
      username: response.username,
      displayName: response.displayName,
      email: response.email,
      emailVerified: response.emailVerified,
      role: (role ?? 'Standard') as UserRole,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return user;
  }

  private readProblemDetail(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { detail?: string } | null;
    return body?.detail || fallback;
  }
}
