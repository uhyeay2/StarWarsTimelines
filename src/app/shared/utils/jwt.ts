/**
 * @fileoverview Lightweight JWT parsing utilities.
 *
 * These helpers decode the **payload** of a JSON Web Token without verifying
 * the signature. Signature verification is the server's responsibility — the
 * client only needs the `exp` claim to manage session timers.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7519#section-4
 */

/**
 * The claims we care about from the JWT payload.
 *
 * The backend signs tokens with `sub` (user ID), `unique_name` (username),
 * `role` (Standard | Admin), `iat` (issued-at), and `exp` (expiration).
 */
export interface JwtPayload {
  sub: string;
  unique_name: string;
  role: string;
  exp: number;
  iat: number;
}

/**
 * Decodes the payload portion of a JWT string.
 *
 * Returns `null` if the token is malformed or the payload cannot be parsed.
 *
 * @param token  The full JWT string (header.payload.signature).
 * @returns The decoded {@link JwtPayload}, or `null` on failure.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1]!;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns the expiration date of a JWT.
 *
 * @param token  The full JWT string.
 * @returns The `Date` when the token expires, or `null` if parsing fails.
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = decodeJwt(token);
  return payload ? new Date(payload.exp * 1000) : null;
}

/**
 * Checks whether a JWT is expired (or about to expire).
 *
 * A `bufferSeconds` margin is subtracted from the actual expiry to allow
 * proactive refresh before the token becomes invalid.
 *
 * @param token          The full JWT string.
 * @param bufferSeconds  Seconds before actual expiry to consider the token expired (default 60).
 * @returns `true` if the token is expired or will expire within the buffer window.
 */
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const expiry = getTokenExpiration(token);
  if (!expiry) return true;
  return Date.now() >= expiry.getTime() - bufferSeconds * 1000;
}
