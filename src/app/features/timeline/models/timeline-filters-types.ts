import { matchesCanonView, CanonView } from '../../../shared/models/canon';
import { isContainerOrCollectionUnit } from '../../../shared/models/unit-type';
import { EventSource, TimelineEvent } from './timeline-event';

/** Facet category keys for timeline event filtering. */
export type FacetKey = 'sources' | 'locations' | 'characters' | 'vehicles';

/** A selectable filter option with a value and display label. */
export interface FilterOption {
  /** The unique value used for matching. */
  readonly value: string;
  /** The human-readable display label. */
  readonly label: string;
}

/** A filter option that may contain nested children (tree structure). */
export interface FilterTreeNode extends FilterOption {
  /** Optional child nodes for hierarchical filtering. */
  readonly children?: readonly FilterTreeNode[];
}

/** Complete filter state for the timeline view. */
export interface TimelineFilters {
  /** The active canon view filter. */
  readonly canonView: CanonView;
  /** Selected source material filter values. */
  readonly sources: readonly string[];
  /** Selected location filter values. */
  readonly locations: readonly string[];
  /** Selected character filter values. */
  readonly characters: readonly string[];
  /** Selected vehicle filter values. */
  readonly vehicles: readonly string[];
}

/** Facet options derived from the current event set. */
export interface TimelineFacetOptions {
  /** Source material tree nodes. */
  readonly sources: readonly FilterTreeNode[];
  /** Location filter options. */
  readonly locations: readonly FilterTreeNode[];
  /** Character filter options. */
  readonly characters: readonly FilterTreeNode[];
  /** Vehicle filter options. */
  readonly vehicles: readonly FilterTreeNode[];
}

/** A source filter chip displayed on an event card. */
export interface SourceFilterChip {
  /** Display label for the chip. */
  readonly label: string;
  /** The filter values this chip represents. */
  readonly values: readonly string[];
  /** Whether this is a medium-level chip (affects styling). */
  readonly medium?: boolean;
}

/**
 * Creates an empty filter state with the default Canon view.
 *
 * @returns A {@link TimelineFilters} object with no active facet selections.
 */
export function createEmptyFilters(): TimelineFilters {
  return {
    canonView: 'Canon',
    sources: [],
    locations: [],
    characters: [],
    vehicles: [],
  };
}

/** Creates a simple leaf-level filter option from a value string. */
export function simpleOption(value: string): FilterTreeNode {
  return { value, label: value };
}

/**
 * Recursively collects all leaf values from a tree node.
 *
 * If the node has no children, returns its own value. Otherwise,
 * recursively collects from all descendants.
 *
 * @param node  The tree node to collect leaves from.
 * @returns An array of all leaf values.
 */
export function collectTreeLeaves(node: FilterTreeNode): string[] {
  if (node.children !== undefined && node.children.length > 0) {
    return node.children.flatMap(collectTreeLeaves);
  }
  return [node.value];
}

/**
 * Generates the unique facet key for one of an event's source materials.
 *
 * The key format depends on the pinned unit's nesting:
 * - No unit or unpinned non-chapter unit: the material's ID (or title)
 * - Unit inside a container: `sourceId:parentUnitId`, except issues which
 *   are individually addressable as `sourceId:parentUnitId:unitId`
 * - Container units nested inside another container (e.g. a Book within a
 *   collection) address their own scope as `sourceId:u{unitId}`
 * - Standalone chapter: `sourceId:u{unitId}`
 *
 * @param source  One of the event's source materials.
 * @returns The unique source facet key string.
 */
export function sourceFacetKey(source: EventSource): string {
  if (source.sourceId === undefined) {
    return source.title;
  }
  const unit = source.unit;
  if (unit === undefined) {
    return String(source.sourceId);
  }
  if (unit.parentUnitId !== undefined && unit.parentUnitId !== null) {
    const parentId = unit.parentUnitId;
    if (isContainerOrCollectionUnit(unit.unitType)) {
      return unit.id !== undefined
        ? `${source.sourceId}:u${unit.id}`
        : `${source.sourceId}:${parentId}`;
    }
    if (unit.unitType === 'Issue') {
      return `${source.sourceId}:${parentId}:${unit.id}`;
    }
    return `${source.sourceId}:${parentId}`;
  }
  if (unit.unitType === 'Chapter') {
    return `${source.sourceId}:u${unit.id}`;
  }
  return String(source.sourceId);
}

/**
 * Generates every source facet key for an event (one per depicting source).
 *
 * @param event  The timeline event.
 * @returns The unique source facet key strings.
 */
export function eventSourceFacetKeys(event: TimelineEvent): readonly string[] {
  return event.sources.map(sourceFacetKey);
}

/**
 * Tests whether an event matches all active facet filters.
 *
 * Uses AND semantics for locations, characters, and vehicles — all
 * selected values in a category must be present on the event. Sources
 * match when ANY facet key of ANY depicting source is selected.
 *
 * @param event    The timeline event to test.
 * @param filters  The current filter state.
 * @returns `true` if the event matches all active facet filters.
 */
export function matchesFacetFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
  if (
    filters.sources.length > 0 &&
    !eventSourceFacetKeys(event).some((key) => filters.sources.includes(key))
  ) {
    return false;
  }
  if (
    filters.locations.length > 0 &&
    !filters.locations.every((l) => event.locations.includes(l))
  ) {
    return false;
  }
  if (
    filters.characters.length > 0 &&
    !filters.characters.every((c) => event.characters.includes(c))
  ) {
    return false;
  }
  if (filters.vehicles.length > 0 && !filters.vehicles.every((v) => event.vehicles.includes(v))) {
    return false;
  }
  return true;
}

/**
 * Tests whether an event matches the complete filter state.
 *
 * Combines canon view matching with facet filter matching.
 *
 * @param event    The timeline event to test.
 * @param filters  The complete filter state.
 * @returns `true` if the event matches all filters.
 */
export function matchesFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
  return matchesCanonView(event.canon, filters.canonView) && matchesFacetFilters(event, filters);
}
