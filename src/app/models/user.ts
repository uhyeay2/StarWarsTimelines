export const USER_ROLES = ['Standard', 'Admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  emailVerified?: boolean;
  role?: UserRole;
}
