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

  private readProblemDetail(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { detail?: string } | null;
    return body?.detail || fallback;
  }
}
