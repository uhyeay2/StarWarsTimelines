import { Environment } from './environment.model';

/**
 * Development environment configuration.
 *
 * `apiBaseUrl` points to the local .NET backend running on port 7089
 * (configured in the backend's `launchSettings.json`).
 */
export const environment: Environment = {
  production: false,
  /** Local .NET backend API (port 7089 from launchSettings.json). */
  apiBaseUrl: 'https://localhost:7089',
};
