/**
 * @fileoverview Request payload for the user registration endpoint.
 */

/**
 * The body sent to `POST /api/auth/register`.
 *
 * @property username     The desired login name (must be unique).
 * @property displayName  Optional display name shown in the UI.
 * @property email        The user's email address (must be unique).
 * @property password     The desired password (minimum length enforced server-side).
 */
export interface RegisterRequest {
  username: string;
  displayName?: string;
  email: string;
  password: string;
}
