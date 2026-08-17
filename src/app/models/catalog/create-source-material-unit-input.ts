/**
 * @fileoverview Write-side payload for creating or updating a source material unit.
 */

import { UnitType } from '../unit-type';

/**
 * The body sent to `POST /api/source-materials/:id/units` or
 * `PUT /api/source-materials/:id/units/:unitId`.
 *
 * @property unitType    The type of unit (Episode, Chapter, etc.).
 * @property groupNumber Optional group/season number (null for standalone works).
 * @property number      The sequential number of the unit within its group.
 * @property title       Optional display title for the unit.
 */
export interface CreateSourceMaterialUnitInput {
  unitType: UnitType;
  groupNumber: number | null;
  number: number;
  title: string | null;
}
