/**
 * @fileoverview Shared pure helpers for tracking-status selection UIs.
 *
 * Used by both the catalog page ({@link SourceMaterialCatalog}) and the
 * timeline event cards ({@link TimelineEventItem}) so that tracking
 * dropdowns behave identically everywhere:
 *
 * - Movies, Short Films, Books, and Video Games are tracked at the
 *   material level (their units — chapters / levels — are informational).
 * - Comics are tracked per Volume (which contains issues).
 * - Shows (live action and animated) are tracked per Season (which
 *   contains episodes).
 *
 * @see {@link LibraryItem} for the tracked-library shape these helpers read.
 */

import { LibraryItem } from './library-item';
import { TRACKING_STATUSES, TrackingStatus } from './tracking-status';

/** A selectable option in a tracking status dropdown. */
export type TrackSelectOption = TrackingStatus | 'remove';

/**
 * Finds the tracked library item for a source material.
 *
 * @param items       The user's tracked library items.
 * @param materialId  The source material ID to look up.
 * @returns The matching {@link LibraryItem}, or `null` when untracked.
 */
export function findTrackedItem(
  items: readonly LibraryItem[],
  materialId: string,
): LibraryItem | null {
  return items.find((item) => item.id === materialId) ?? null;
}

/**
 * Builds the option list for a tracking status select.
 *
 * Always offers every status; appends 'Remove From Library' once tracked.
 *
 * @param isTracked  Whether the target (material or group unit) is currently tracked.
 * @returns The ordered option values for the select.
 */
export function trackSelectOptions(isTracked: boolean): readonly TrackSelectOption[] {
  return isTracked ? [...TRACKING_STATUSES, 'remove'] : [...TRACKING_STATUSES];
}

/**
 * Returns the material-level tracked status, or `null` when untracked.
 *
 * Used to preselect material-level tracking dropdowns for mediums whose
 * tracking scope is the whole title (movies, short films, books, games).
 *
 * @param item  The tracked library item, or `null` when untracked.
 * @returns The current {@link TrackingStatus}, or `null`.
 */
export function materialTrackingStatus(item: LibraryItem | null): TrackingStatus | null {
  return item?.status ?? null;
}

/**
 * Returns whether a specific group (Season/Volume) container unit is
 * directly tracked within a library item.
 *
 * @param item    The tracked library item, or `null` when the material is untracked.
 * @param unitId  The Season/Volume container unit ID.
 * @returns `true` when that exact unit has `isTracked === true`.
 */
export function groupUnitIsTracked(item: LibraryItem | null, unitId: string): boolean {
  return item?.units?.some((u) => u.id === unitId && u.isTracked === true) ?? false;
}

/**
 * Returns the effective tracked status for a group (Season/Volume) unit,
 * or `null` when neither the unit nor any of its child units is tracked
 * (showing the "Track…" placeholder). Derivation is scoped to this
 * container's children only so sibling seasons never influence the result.
 *
 * @param item    The tracked library item, or `null` when the material is untracked.
 * @param unitId  The Season/Volume container unit ID.
 * @returns The derived {@link TrackingStatus}, or `null`.
 */
export function groupTrackingStatus(item: LibraryItem | null, unitId: string): TrackingStatus | null {
  const units = item?.units ?? [];
  const container = units.find((u) => u.id === unitId);
  if (!container) {
    return null;
  }
  if (container.isTracked === true) {
    return container.isCompleted ? 'Completed' : 'In progress';
  }
  const children = units.filter(
    (u) =>
      u.unitType !== 'Season' &&
      u.unitType !== 'Volume' &&
      u.groupNumber === container.number,
  );
  if (!children.some((c) => c.isTracked === true)) {
    return null;
  }
  const completed = children.filter((c) => c.isCompleted).length;
  if (children.length > 0 && completed === children.length) {
    return 'Completed';
  }
  return completed > 0 ? 'In progress' : 'Wish Listed';
}
