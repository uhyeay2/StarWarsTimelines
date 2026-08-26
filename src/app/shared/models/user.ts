/**
 * @fileoverview Domain-level user model and role constants.
 */
export const USER_ROLES = ['Standard', 'Admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Domain-level user representation.
 *
 * After login the full profile is fetched via `GET /api/users/:id`, so all
 * fields are always present (no partial state).
 */
export interface User {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: UserRole;
}
