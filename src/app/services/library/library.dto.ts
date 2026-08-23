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

/**
 * Wire-format for a single unit within a library item.
 *
 * `status` is the user's per-unit tracking status (`0` in progress, `1`
 * completed) or `null` when the unit is untracked. `parentUnitId` points at
 * the container unit (season/volume/book) this unit nests inside, or is
 * `null` for top-level units.
 *
 * Library responses nest containers: a tracked season lists its episodes in
 * `units`, a tracked collection its books, and so on. The hierarchy is pruned
 * to tracked paths — a unit appears only when the user tracks it directly or
 * tracks content inside it, and untracked branches are omitted entirely.
 */
export interface LibraryUnitDto {
  id: string;
  unitType: number;
  groupNumber: number | null;
  number: number;
  title: string | null;
  status: number | null;
  parentUnitId?: string | null;
  units?: readonly LibraryUnitDto[];
}

/**
 * Wire-format for a library item returned by the API.
 *
 * `status` is `null` for materials that track through nested container units
 * (shows via seasons, comics via volumes, book collections via books);
 * clients read each unit's own status instead. Other materials report their
 * stored status here.
 *
 * `units` is the material's sub-unit hierarchy pruned to the user's tracked
 * paths (only tracked containers appear, each carrying its children nested).
 */
export interface LibraryItemDto {
  sourceMaterialId: string;
  title: string;
  medium: number;
  canonType: number;
  status: number | null;
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
  status?: number;
}

/**
 * Payload sent to `PUT /api/users/:id/source-materials/:materialId` to update
 * the tracking status or unit-specific progress.
 */
export interface UpdateStatusRequest {
  status: number;
  unitId?: string;
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
 * `PUT /api/users/:id/source-materials/:materialId/units/:unitId` to set a
 * unit's tracking status (`0` in progress or `1` completed). Clearing a
 * unit's tracking is done through the delete endpoint, not by sending a
 * status; wish-listing a unit removes its progress row server-side.
 */
export interface UpdateUnitProgressRequest {
  status: number;
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
