import { matchesCanonView, CanonView } from './canon';
import { MEDIA, Medium } from './medium';
import { sourceGroupName } from './source-material';
import { TimelineEvent } from './timeline-event';

/** Facet category keys for timeline event filtering. */
export type FacetKey = 'sources' | 'locations' | 'characters' | 'vehicles';

/** A selectable filter option with a value and display label. */
export interface FilterOption {
  /** The unique value used for matching. */
  value: string;
  /** The human-readable display label. */
  label: string;
}

/** A filter option that may contain nested children (tree structure). */
export interface FilterTreeNode extends FilterOption {
  /** Optional child nodes for hierarchical filtering. */
  children?: readonly FilterTreeNode[];
}

/** Complete filter state for the timeline view. */
export interface TimelineFilters {
  /** The active canon view filter. */
  canonView: CanonView;
  /** Selected source material filter values. */
  sources: readonly string[];
  /** Selected location filter values. */
  locations: readonly string[];
  /** Selected character filter values. */
  characters: readonly string[];
  /** Selected vehicle filter values. */
  vehicles: readonly string[];
}

/** Facet options derived from the current event set. */
export interface TimelineFacetOptions {
  /** Source material tree nodes. */
  sources: readonly FilterTreeNode[];
  /** Location filter options. */
  locations: readonly FilterTreeNode[];
  /** Character filter options. */
  characters: readonly FilterTreeNode[];
  /** Vehicle filter options. */
  vehicles: readonly FilterTreeNode[];
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
function simpleOption(value: string): FilterTreeNode {
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

/** A source filter chip displayed on an event card. */
export interface SourceFilterChip {
  /** Display label for the chip. */
  label: string;
  /** The filter values this chip represents. */
  values: readonly string[];
  /** Whether this is a medium-level chip (affects styling). */
  medium?: boolean;
}

/**
 * Builds the source filter chips for a single timeline event.
 *
 * Constructs a hierarchy of chips: medium-level chip, material chip,
 * and optional group-level chips (season, volume, chapter).
 *
 * @param event    The timeline event to build chips for.
 * @param sources  The source filter tree nodes.
 * @returns An array of source filter chips.
 */
export function sourceChipsForEvent(
  event: TimelineEvent,
  sources: readonly FilterTreeNode[],
): readonly SourceFilterChip[] {
  const mediumNode = sources.find((node) => node.label === event.source.medium);
  const materialNode = mediumNode?.children?.find(
    (node) => node.value === (event.source.sourceId ?? event.source.title),
  );
  if (mediumNode === undefined || materialNode === undefined) {
    return [{ label: event.source.title, values: [sourceFacetKey(event)] }];
  }

  const chips: SourceFilterChip[] = [
    { label: mediumNode.label, values: collectTreeLeaves(mediumNode), medium: true },
    { label: materialNode.label, values: collectTreeLeaves(materialNode) },
  ];

  const unit = event.source.unit;
  if (unit !== undefined && event.source.sourceId !== undefined) {
    if (unit.groupNumber !== undefined) {
      const groupNode = materialNode.children?.find(
        (node) => node.value === `${event.source.sourceId}:${unit.groupNumber}`,
      );
      if (groupNode !== undefined) {
        chips.push({ label: groupNode.label, values: collectTreeLeaves(groupNode) });
      }
    } else if (unit.unitType === 'Chapter') {
      const chapterValue = `${event.source.sourceId}:chapter-${unit.number}`;
      if (materialNode.children?.some((node) => node.value === chapterValue)) {
        chips.push({ label: `Chapter ${unit.number}`, values: [chapterValue] });
      }
    }
  }

  return chips;
}

/**
 * Generates the unique facet key for an event's source material.
 *
 * The key format depends on the unit structure:
 * - No unit: `sourceId` or `title`
 * - Season/episode: `sourceId:groupNumber`
 * - Volume/issue: `sourceId:groupNumber:number`
 * - Chapter: `sourceId:chapter-number`
 *
 * @param event  The timeline event.
 * @returns The unique source facet key string.
 */
export function sourceFacetKey(event: TimelineEvent): string {
  if (event.source.sourceId === undefined) {
    return event.source.title;
  }
  const unit = event.source.unit;
  if (unit === undefined) {
    return event.source.sourceId;
  }
  if (unit.groupNumber !== undefined) {
    if (unit.unitType === 'Issue') {
      return `${event.source.sourceId}:${unit.groupNumber}:${unit.number}`;
    }
    return `${event.source.sourceId}:${unit.groupNumber}`;
  }
  if (unit.unitType === 'Chapter') {
    return `${event.source.sourceId}:chapter-${unit.number}`;
  }
  return event.source.sourceId;
}

/** Internal state for a material's facet data during collection. */
interface MaterialFacet {
  title: string;
  sourceId: string | undefined;
  whole: FilterTreeNode | undefined;
  groups: Map<number, string>;
  volumes: Map<number, Map<number, string>>;
  chapters: Map<number, string>;
}

/**
 * Builds tree children for a material facet.
 *
 * Creates "Whole" entries when the material has both plain and unit-linked
 * events, and creates group/volume/chapter nodes as appropriate.
 *
 * @param facet  The material facet data.
 * @returns An array of tree nodes representing the material's children.
 */
function materialChildren(facet: MaterialFacet): FilterTreeNode[] {
  const children: FilterTreeNode[] = [];
  if (
    facet.whole !== undefined &&
    (facet.groups.size > 0 || facet.volumes.size > 0 || facet.chapters.size > 0)
  ) {
    children.push({ value: facet.whole.value, label: `${facet.title} — Whole` });
  }
  for (const [groupNumber, label] of [...facet.groups.entries()].sort((a, b) => a[0] - b[0])) {
    children.push({ value: `${facet.sourceId}:${groupNumber}`, label });
  }
  for (const [volume, issues] of [...facet.volumes.entries()].sort((a, b) => a[0] - b[0])) {
    children.push({
      value: `${facet.sourceId}:${volume}`,
      label: `Volume ${volume}`,
      children: [...issues.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, label]) => ({ value: `${facet.sourceId}:${volume}:${number}`, label })),
    });
  }
  for (const [number, label] of [...facet.chapters.entries()].sort((a, b) => a[0] - b[0])) {
    children.push({ value: `${facet.sourceId}:chapter-${number}`, label });
  }
  return children;
}

/**
 * Collects facet options from a set of timeline events.
 *
 * Builds a hierarchical source tree grouped by medium and material,
 * and flat lists of locations, characters, and vehicles. Source tree
 * nodes include group/volume/chapter nesting for multi-unit materials.
 *
 * @param events  The timeline events to collect facet data from.
 * @returns A complete set of {@link TimelineFacetOptions}.
 */
export function collectFacetOptions(events: readonly TimelineEvent[]): TimelineFacetOptions {
  const materialsByMedium = new Map<Medium, Map<string, MaterialFacet>>();
  const locations = new Set<string>();
  const characters = new Set<string>();
  const vehicles = new Set<string>();

  for (const event of events) {
    const source = event.source;
    let byMedium = materialsByMedium.get(source.medium);
    if (byMedium === undefined) {
      byMedium = new Map();
      materialsByMedium.set(source.medium, byMedium);
    }
    const materialKey = source.sourceId ?? source.title;
    let facet = byMedium.get(materialKey);
    if (facet === undefined) {
      facet = {
        title: source.title,
        sourceId: source.sourceId,
        whole: undefined,
        groups: new Map(),
        volumes: new Map(),
        chapters: new Map(),
      };
      byMedium.set(materialKey, facet);
    }

    const unit = source.unit;
    if (
      source.sourceId === undefined ||
      unit === undefined ||
      (unit.groupNumber === undefined && unit.unitType !== 'Chapter')
    ) {
      facet.whole = { value: source.sourceId ?? source.title, label: source.title };
    } else if (unit.groupNumber !== undefined && unit.unitType === 'Issue') {
      let issues = facet.volumes.get(unit.groupNumber);
      if (issues === undefined) {
        issues = new Map();
        facet.volumes.set(unit.groupNumber, issues);
      }
      if (!issues.has(unit.number)) {
        issues.set(unit.number, `Issue ${unit.number}`);
      }
    } else if (unit.groupNumber !== undefined) {
      if (!facet.groups.has(unit.groupNumber)) {
        const groupName = sourceGroupName(unit.unitType);
        facet.groups.set(
          unit.groupNumber,
          groupName === undefined ? `Group ${unit.groupNumber}` : `${groupName} ${unit.groupNumber}`,
        );
      }
    } else if (!facet.chapters.has(unit.number)) {
      facet.chapters.set(unit.number, `Chapter ${unit.number}`);
    }

    for (const location of event.locations) locations.add(location);
    for (const character of event.characters) characters.add(character);
    for (const vehicle of event.vehicles) vehicles.add(vehicle);
  }

  const sources: FilterTreeNode[] = [];
  for (const medium of MEDIA) {
    const byMedium = materialsByMedium.get(medium);
    if (byMedium === undefined) {
      continue;
    }
    const materialNodes: FilterTreeNode[] = [];
    for (const facet of byMedium.values()) {
      const children = materialChildren(facet);
      if (children.length === 0 && facet.whole !== undefined) {
        materialNodes.push(facet.whole);
      } else if (children.length > 0) {
        materialNodes.push({ value: facet.sourceId ?? facet.title, label: facet.title, children });
      }
    }
    materialNodes.sort((a, b) => a.label.localeCompare(b.label));
    sources.push({ value: `medium:${medium}`, label: medium, children: materialNodes });
  }

  const sorted = (values: ReadonlySet<string>): string[] =>
    [...values].sort((a, b) => a.localeCompare(b));

  return {
    sources,
    locations: sorted(locations).map(simpleOption),
    characters: sorted(characters).map(simpleOption),
    vehicles: sorted(vehicles).map(simpleOption),
  };
}

/**
 * Tests whether an event matches all active facet filters.
 *
 * Uses AND semantics for locations, characters, and vehicles — all
 * selected values in a category must be present on the event. Sources
 * use exact key matching.
 *
 * @param event    The timeline event to test.
 * @param filters  The current filter state.
 * @returns `true` if the event matches all active facet filters.
 */
export function matchesFacetFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
  if (filters.sources.length > 0 && !filters.sources.includes(sourceFacetKey(event))) {
    return false;
  }
  if (filters.locations.length > 0 && !filters.locations.every((l) => event.locations.includes(l))) {
    return false;
  }
  if (filters.characters.length > 0 && !filters.characters.every((c) => event.characters.includes(c))) {
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
