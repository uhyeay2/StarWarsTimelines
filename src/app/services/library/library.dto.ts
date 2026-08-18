/**
 * @fileoverview DTO types for the user-library API endpoints.
 *
 * These interfaces mirror the JSON shape returned by the ASP.NET Core backend.
 * Numeric enum codes for `medium`, `canonType`, `status`, and `unitType` are
 * mapped to domain-level string unions by {@link LibraryService}.
 *
 * Response DTOs represent wire-format data. Request DTOs represent typed
 * payloads sent to the server, replacing inline object literals for type safety.
 */

import { Medium } from '../../models/medium';

// ─── Response DTOs ──────────────────────────────────────────────────────────

/** Wire-format for a single unit within a library item. */
export interface LibraryUnitDto {
  id: string;
  unitType: number;
  groupNumber: number | null;
  number: number;
  title: string | null;
  isCompleted: boolean;
}

/** Wire-format for a library item returned by the API. */
export interface LibraryItemDto {
  sourceMaterialId: string;
  title: string;
  medium: number;
  canonType: number;
  status: number;
  isFavorite: boolean;
  units: readonly LibraryUnitDto[];
}

// ─── Request DTOs ───────────────────────────────────────────────────────────

/**
 * Payload sent to `POST /api/users/:id/source-materials` to add a material
 * to the user's library.
 */
export interface AddMaterialRequest {
  sourceMaterialId: string;
}

/**
 * Payload sent to `PUT /api/users/:id/source-materials/:materialId` to update
 * the tracking status.
 */
export interface UpdateStatusRequest {
  status: number;
}

/**
 * Payload sent to `PUT /api/users/:id/source-materials/:materialId` to update
 * the favorite flag.
 */
export interface UpdateFavoriteRequest {
  isFavorite: boolean;
}

/**
 * Payload sent to
 * `PUT /api/users/:id/source-materials/:materialId/units/:unitId` to update
 * a unit's completion status.
 */
export interface UpdateUnitProgressRequest {
  isCompleted: boolean;
}

/**
 * Payload sent to `PUT /api/users/:id/source-materials/reorder` to change the
 * library ordering.
 */
export interface ReorderRequest {
  orderedSourceMaterialIds: string[];
}

// ─── Catalog material (add-tracked helper) ──────────────────────────────────

/**
 * Domain-level material descriptor accepted by {@link LibraryService.addTracked}.
 *
 * Carries enough information for the UI to display the material while only
 * the `id` is sent to the server.
 */
export interface CatalogMaterial {
  id: string;
  title: string;
  medium: Medium;
}
