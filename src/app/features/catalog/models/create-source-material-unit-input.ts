/**
 * @fileoverview Write-side payload for creating or updating a source material unit.
 */

import { UnitType } from '../../../shared/models/unit-type';

/**
 * The body sent to `POST /api/source-materials/:id/units` or
 * `PUT /api/source-materials/:id/units/:unitId`.
 *
 * @property unitType      The type of unit (Episode, Chapter, etc.).
 * @property number        The sequential number of the unit within its parent scope.
 * @property title         Optional display title for the unit.
 * @property parentUnitId  The container unit (season/volume/book) this unit nests
 *                         inside, or `null` when it sits directly under its material.
 */
export interface CreateSourceMaterialUnitInput {
  readonly unitType: UnitType;
  readonly number: number;
  readonly title: string | null;
  readonly parentUnitId: number | null;
}
