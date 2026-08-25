/**
 * @fileoverview Domain error types for authentication failures.
 *
 * {@link AuthError} is thrown by {@link AuthService} when a login, registration,
 * or email-verification request fails in a way that requires specific user-facing
 * handling (e.g. prompting for email verification).
 */

/**
 * Machine-readable error codes returned by the authentication layer.
 *
 * - `'email-not-verified'` — The user's account exists but their email has not
 *   been verified yet.
 * - `'invalid-credentials'` — The username or password was incorrect.
 */
export type AuthErrorCode = 'email-not-verified' | 'invalid-credentials';

/**
 * A domain-specific error thrown when an authentication operation fails.
 *
 * Carries a machine-readable {@link code} that UI consumers can inspect to show
 * context-specific messaging (e.g. a "resend verification email" prompt).
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof AuthError && err.code === 'email-not-verified') {
 *     showResendPrompt();
 *   }
 * }
 * ```
 */
export class AuthError extends Error {
  /** The machine-readable error code. */
  readonly code: AuthErrorCode;

  constructor(message: string, code: AuthErrorCode) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
