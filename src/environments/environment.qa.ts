import { Environment } from './environment.model';

/**
 * QA/staging environment configuration.
 *
 * **Deployment:** Replace `apiBaseUrl` with the real QA API URL before building.
 */
export const environment: Environment = {
  production: false,
  /** Replace with the actual QA API base URL before deploy. */
  apiBaseUrl: 'https://qa-api.starwarstimelines.example.com',
};
