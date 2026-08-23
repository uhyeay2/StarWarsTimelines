import { Medium } from './medium';
import { TrackingStatus } from './tracking-status';
import { UnitType } from './unit-type';

/**
 * A single unit of a tracked library item together with the user's status.
 *
 * `status` is `null` when the unit is untracked. `parentUnitId` identifies
 * the container unit (season/volume/book) this unit nests inside; units
 * without a parent sit directly under the source material.
 */
export interface LibraryUnit {
  id: string;
  unitType: UnitType;
  groupNumber?: number;
  number: number;
  title?: string;
  parentUnitId?: string | null;
  status: TrackingStatus | null;
}

export interface LibraryItem {
  id: string;
  title: string;
  medium: Medium;
  /**
   * The item's material-level tracking status, or `null` when the material
   * tracks through nested container units (their statuses carry the progress).
   */
  status: TrackingStatus | null;
  favorite: boolean;
  units?: readonly LibraryUnit[];
}
