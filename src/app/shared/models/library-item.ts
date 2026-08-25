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
  readonly id: number;
  readonly unitType: UnitType;
  readonly number: number;
  readonly title?: string;
  readonly parentUnitId?: number | null;
  readonly status: TrackingStatus | null;
}

export interface LibraryItem {
  readonly id: number;
  readonly title: string;
  readonly medium: Medium;
  /**
   * The item's material-level tracking status, or `null` when the material
   * tracks through nested container units (their statuses carry the progress).
   */
  readonly status: TrackingStatus | null;
  readonly favorite: boolean;
  readonly units?: readonly LibraryUnit[];
}
