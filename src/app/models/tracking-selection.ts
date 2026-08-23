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
 * - Book collections are tracked per Book (which contains chapters).
 *
 * A unit is "tracked" when its `status` is non-null (in progress or
 * completed); untracked units report `null`.
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
 * Returns whether a specific group (Season/Volume/Book) container unit is
 * tracked within a library item, either directly or through any child unit.
 *
 * @param item    The tracked library item, or `null` when the material is untracked.
 * @param unitId  The container unit ID.
 * @returns `true` when that exact unit or one of its children has a non-null `status`.
 */
export function groupUnitIsTracked(item: LibraryItem | null, unitId: string): boolean {
  const units = item?.units ?? [];
  return units.some(
    (u) => (u.id === unitId || u.parentUnitId === unitId) && u.status !== null,
  );
}

/**
 * Returns whether a unit is a container unit type.
 *
 * @param unitType  The unit type to check.
 * @returns `true` for Season, Volume, and Book.
 */
export function isContainerUnit(unitType: string): boolean {
  return unitType === 'Season' || unitType === 'Volume' || unitType === 'Book';
}

/**
 * Returns the effective tracked status for a group (Season/Volume/Book)
 * container unit, or `null` when neither the container nor any of its child
 * units is tracked (showing the "Track…" placeholder). Derivation is scoped
 * to this container's children only so sibling containers never influence
 * the result.
 *
 * Children are matched by `parentUnitId` first; when absent (e.g. stale or
 * partial data), children fall back to matching by group number. When some
 * but not all children are completed, the status derives as in progress;
 * only fully-completed groups report completed.
 *
 * @param item    The tracked library item, or `null` when the material is untracked.
 * @param unitId  The container unit ID.
 * @returns The derived {@link TrackingStatus}, or `null`.
 */
export function groupTrackingStatus(item: LibraryItem | null, unitId: string): TrackingStatus | null {
  const units = item?.units ?? [];
  const container = units.find((u) => u.id === unitId);
  if (!container) {
    return null;
  }
  if (container.status !== null) {
    return container.status;
  }
  const children = units.filter(
    (u) =>
      !isContainerUnit(u.unitType) &&
      (u.parentUnitId ? u.parentUnitId === container.id : u.groupNumber === container.number),
  );
  if (!children.some((c) => c.status !== null)) {
    return null;
  }
  if (children.length > 0 && children.every((c) => c.status === 'Completed')) {
    return 'Completed';
  }
  return 'In progress';
}

// ─── Tracked-scope helpers (Known Timeline filtering) ───────────────────────

/**
 * The tracked scope of one source material within the user's library:
 *
 * - `'all'` — the material tracks at the material level (movies, standalone
 *   books, games), so every depiction of it counts as known.
 * - A set of unit IDs — the material tracks through its units (shows via
 *   seasons, comics via volumes, book collections via books), and only the
 *   content inside those tracked units counts as known. The library returns
 *   exactly this pruned hierarchy: directly tracked containers include their
 *   full subtree, and containers included only because descendants are
 *   tracked list just those branches.
 */
export type TrackedScope = 'all' | ReadonlySet<string>;

/** Maps each tracked source material ID to its {@link TrackedScope}. */
export type TrackedScopeMap = ReadonlyMap<string, TrackedScope>;

/**
 * Builds the tracked scope for a set of library items, optionally filtered
 * by tracking status. Items whose status does not match the selection (or
 * whose status is null when specific statuses are selected) contribute
 * nothing, mirroring the status filter semantics of the library pages.
 *
 * @param items             The user's tracked library items.
 * @param selectedStatuses  Active status-filter selection; empty means all.
 * @returns A map of material ID to tracked scope.
 */
export function buildTrackedScope(
  items: readonly LibraryItem[],
  selectedStatuses: readonly TrackingStatus[] = [],
): TrackedScopeMap {
  const scope = new Map<string, TrackedScope>();
  for (const item of items) {
    if (
      selectedStatuses.length > 0 &&
      (item.status === null || !selectedStatuses.includes(item.status))
    ) {
      continue;
    }
    scope.set(item.id, item.status !== null ? 'all' : new Set((item.units ?? []).map((u) => u.id)));
  }
  return scope;
}

/**
 * Tests whether a single depiction (a source material with an optional
 * pinned unit) falls inside the user's tracked scope:
 *
 * - Materials outside the scope are never known.
 * - Material-level scopes (`'all'`) make every depiction of that material
 *   known.
 * - Unit-tracked materials make unpinned depictions known (the item itself
 *   shows in My Tracked Events), while pinned depictions count only when
 *   their exact unit is part of the tracked scope.
 *
 * @param scope     The tracked scope built by {@link buildTrackedScope}.
 * @param sourceId  The depicting material's ID, or `undefined`.
 * @param unitId    The pinned unit's ID, or `undefined` when unpinned.
 * @returns `true` when the depiction is within the tracked scope.
 */
export function depictionIsTracked(
  scope: TrackedScopeMap,
  sourceId: string | undefined,
  unitId: string | undefined,
): boolean {
  if (sourceId === undefined) {
    return false;
  }
  const materialScope = scope.get(sourceId);
  if (!materialScope) {
    return false;
  }
  // Material-level scopes cover every depiction, and unpinned depictions of
  // a unit-tracked material count whenever the item itself is tracked.
  if (materialScope === 'all' || unitId === undefined) {
    return true;
  }
  return materialScope.has(unitId);
}
