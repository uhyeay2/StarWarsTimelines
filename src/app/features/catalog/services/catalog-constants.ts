import { environment } from '../../../../environments/environment';

/** Base URL for all catalog API endpoints. */
export const CATALOG_API_BASE = `${environment.apiBaseUrl}/api`;

/** 5-minute TTL for catalog caches (resilience fallback). */
export const CACHE_TTL_MS = 5 * 60 * 1000;
