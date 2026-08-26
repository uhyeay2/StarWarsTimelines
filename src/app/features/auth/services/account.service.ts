/**
 * @fileoverview Account-management service.
 *
 * Handles profile read/update operations (getAccount, updateDisplayName,
 * updateEmail, updatePassword). Authentication and token management
 * remain in {@link AuthService}.
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { User } from '../../../shared/models/user';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import { AccountResponse } from './auth.dto';
import { mapAccountResponse } from './auth.mapper';
import { AuthService } from './auth.service';
import { LoggerService } from '../../../core/services/logging/logger.service';

/** Base URL for account-related endpoints. */
const USERS_BASE = `${environment.apiBaseUrl}/api/users`;

/**
 * Standalone helper to fetch a user profile by ID.
 *
 * Used by both {@link AuthService} (login flow) and {@link AccountService}
 * without creating a circular dependency.
 */
export function fetchUserProfile(
  http: HttpClient,
  logger: LoggerService,
  userId: string,
): Observable<User> {
  return http.get<AccountResponse>(`${USERS_BASE}/${userId}`).pipe(
    catchError((error: HttpErrorResponse) => {
      logger.error('Failed to load account details', { error });
      return throwError(
        () =>
          new Error(
            readProblemDetail(error, 'Unable to load your account details. Please try again.'),
          ),
      );
    }),
    map((response) => mapAccountResponse(response)),
  );
}

/**
 * Manages user-profile CRUD operations.
 *
 * Delegates authentication state (current user signal, token storage)
 * to {@link AuthService}.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  /**
   * Fetches the full account profile for the given user.
   *
   * Also updates the local user state and sessionStorage via AuthService.
   *
   * @param userId  The ID of the user to load.
   * @returns An observable that emits the refreshed {@link User}.
   */
  getAccount(userId: string): Observable<User> {
    return fetchUserProfile(this.http, this.logger, userId).pipe(
      map((user) => {
        this.auth.syncUser(user);
        return user;
      }),
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
      .put<AccountResponse>(`${USERS_BASE}/${userId}/display-name`, { displayName })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Failed to update display name', { error });
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
    return this.http.put<AccountResponse>(`${USERS_BASE}/${userId}/email`, { email }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Failed to update email', { error });
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
      .put<void>(`${USERS_BASE}/${userId}/password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Failed to change password', { error });
          return throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to change your password. Please try again.'),
              ),
          );
        }),
      );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Applies a full {@link AccountResponse} to the local user state.
   *
   * Delegates to {@link AuthService.syncUser} for signal + sessionStorage
   * persistence.
   *
   * @param response  The full account DTO from the server.
   * @returns The updated domain-level {@link User}.
   */
  private applyAccount(response: AccountResponse): User {
    const user = mapAccountResponse(response);
    this.auth.syncUser(user);
    return user;
  }
}
