import { Environment } from './environment.model';

/**
 * Production environment configuration.
 *
 * **Deployment:** Replace `apiBaseUrl` with the real production API URL
 * before building. The `example.com` placeholder will fail at runtime.
 */
export const environment: Environment = {
  production: true,
  /** Replace with the actual production API base URL before deploy. */
  apiBaseUrl: 'https://api.starwarstimelines.example.com',
};
