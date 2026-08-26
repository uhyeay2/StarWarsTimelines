import { environment } from '../../../../environments/environment';

/** Base URL for all catalog API endpoints. */
export const CATALOG_API_BASE = `${environment.apiBaseUrl}/api`;

/** 5-minute TTL for catalog caches (resilience fallback). */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/** Known entity types broadcast via catalog SSE events. */
export const CATALOG_ENTITY_TYPES = [
  'characters',
  'locations',
  'vehicles',
  'species',
  'source-materials',
  'source-material-units',
] as const;

/** Union type of all known catalog entity type strings. */
export type CatalogEntityType = (typeof CATALOG_ENTITY_TYPES)[number];
