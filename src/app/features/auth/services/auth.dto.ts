/**
 * @fileoverview Internal wire-type DTOs for the authentication API.
 *
 * These interfaces represent the raw JSON shapes returned by the ASP.NET Core
 * backend. They use numeric role codes rather than the domain-level string
 * roles used throughout the Angular application.
 *
 * @see {@link AuthService} for the service that consumes these DTOs.
 */

/**
 * Response body of `POST /api/auth/login`.
 *
 * The `user.role` field is a numeric index into the server-side role enum:
 * - `0` → Standard
 * - `1` → Admin
 */
export interface LoginResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly displayName: string;
    readonly role: number;
  };
}

/**
 * Response body of `POST /api/auth/refresh`.
 */
export interface RefreshTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Response body of the account-related endpoints
 * (`GET /api/users/:id`, `PUT /api/users/:id/display-name`,
 * `PUT /api/users/:id/email`).
 */
export interface AccountResponse {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: number;
}
