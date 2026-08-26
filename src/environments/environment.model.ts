/**
 * @fileoverview Deployment environment configuration model.
 *
 * Each build configuration (`development`, `qa`, `production`) provides a
 * concrete `Environment` object via Angular file replacements in `angular.json`.
 *
 * - `production`: Enables AOT, minification, and output hashing.
 * - `apiBaseUrl`: The root URL for the backend REST API (no trailing slash).
 *   During development this points to `https://localhost:7089` (the .NET
 *   backend running locally). QA and production values are replaced at build
 *   time via environment files — placeholder `example.com` URLs must be
 *   swapped for real endpoints before deployment.
 */
export interface Environment {
  /** Whether this is a production build (enables Angular production mode). */
  readonly production: boolean;

  /** Root URL for the backend API (no trailing slash). */
  readonly apiBaseUrl: string;
}
