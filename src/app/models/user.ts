export const USER_ROLES = ['Standard', 'Admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Domain-level user representation.
 *
 * After login the full profile is fetched via `GET /api/users/:id`, so all
 * fields are always present (no partial state).
 */
export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
}
