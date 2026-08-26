/**
 * @fileoverview DTO-to-domain mappers for authentication and account responses.
 *
 * Centralises the conversion from wire-format DTOs (`LoginResponse`,
 * `AccountResponse`) to domain-level {@link User} objects. Both
 * {@link AuthService} and {@link AccountService} import from here instead
 * of duplicating the mapping logic.
 */

import { User } from '../../../shared/models/user';
import { LoginResponse, AccountResponse } from './auth.dto';
import { mapRole } from './role.helper';

/**
 * Maps the minimal user object from the login response to a partial {@link User}.
 *
 * The returned object does **not** include `email` or `emailVerified` —
 * the AccountService will fetch the full profile.
 *
 * @param response  The `user` field from {@link LoginResponse}.
 * @returns A partial domain-level {@link User}.
 */
export function mapLoginUser(response: LoginResponse['user']): User {
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
 * Maps a full {@link AccountResponse} to a domain-level {@link User}.
 *
 * @param response  The full account DTO from the server.
 * @returns The mapped domain-level {@link User}.
 */
export function mapAccountResponse(response: AccountResponse): User {
  return {
    id: response.id,
    username: response.username,
    displayName: response.displayName,
    email: response.email,
    emailVerified: response.emailVerified,
    role: mapRole(response.role),
  };
}
