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
 * - `'server-error'` — The server returned an unexpected error (HTTP 5xx / network).
 * - `'network-error'` — The HTTP request failed entirely (network / offline).
 */
export type AuthErrorCode =
  'email-not-verified' | 'invalid-credentials' | 'server-error' | 'network-error';

export const AuthErrorCode = {
  EmailNotVerified: 'email-not-verified' as const,
  InvalidCredentials: 'invalid-credentials' as const,
  ServerError: 'server-error' as const,
  NetworkError: 'network-error' as const,
} satisfies Record<string, AuthErrorCode>;

/** Backend error title that signals an unverified email address. */
export const EMAIL_NOT_VERIFIED_TITLE = 'Email not verified';

/**
 * A domain-specific error thrown when an authentication operation fails.
 *
 * Carries a machine-readable {@link code} that UI consumers can inspect to show
 * context-specific messaging (e.g. a "resend verification email" prompt).
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof AuthError && err.code === AuthErrorCode.EmailNotVerified) {
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
