/**
 * @fileoverview Shared role-mapping helper for auth-related services.
 */

import { UserRole, USER_ROLES } from '../../../shared/models/user';

/**
 * Maps a numeric role code to a {@link UserRole} string.
 *
 * Falls back to `'Standard'` for unknown codes.
 */
export function mapRole(roleCode: number): UserRole {
  return (USER_ROLES[roleCode] ?? 'Standard') as UserRole;
}
