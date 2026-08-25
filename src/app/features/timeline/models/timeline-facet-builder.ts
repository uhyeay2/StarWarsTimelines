import { MEDIA, Medium } from '../../../shared/models/medium';
import { isContainerOrCollectionUnit } from '../../../shared/models/unit-type';
import { sourceUnitLabel } from '../../../shared/models/source-material';
import { EventSource, TimelineEvent } from './timeline-event';
import {
  FilterTreeNode,
  TimelineFacetOptions,
  simpleOption,
} from './timeline-filters-types';

/**
 * Resolves the display label ("Season 1", "Volume 2") for a material's
 * container unit, or `undefined` while the unit data is unavailable.
 */
export type ContainerLabelResolver = (
  materialId: number,
  containerUnitId: number,
) => string | undefined;

/** Per-container facet state accumulated from pinned event units. */
interface ContainerFacet {
  /** Label resolved via the container-label resolver, when available. */
  label: string | undefined;
  /** Per-issue leaf nodes when the container holds pinned issues. */
  issues: Map<number, FilterTreeNode>;
}

/** Internal state for a material's facet data during collection. */
interface MaterialFacet {
  title: string;
  sourceId: number | undefined;
  whole: FilterTreeNode | undefined;
  /** Container scopes keyed by container unit ID. */
  containers: Map<number, ContainerFacet>;
  /**
   * Standalone unit leaves keyed by unit ID — chapters pinned without a
   * container plus nested containers (books within collections) that are
   * individually addressable.
   */
  unitLeaves: Map<number, string>;
}

/**
 * Builds tree children for a material facet.
 *
 * Creates a "Whole" entry when the material has both plain and unit-linked
 * events, then one node per container scope (nesting individual issue leaves
 * when present) and standalone unit leaves (chapters, nested books).
 *
 * @param facet  The material facet data.
 * @returns An array of tree nodes representing the material's children.
 */
function materialChildren(facet: MaterialFacet): FilterTreeNode[] {
  const children: FilterTreeNode[] = [];
  if (facet.whole !== undefined && (facet.containers.size > 0 || facet.unitLeaves.size > 0)) {
    children.push({ value: facet.whole.value, label: `${facet.title} — Whole` });
  }
  const sourcePrefix = facet.sourceId !== undefined ? String(facet.sourceId) : facet.title;
  for (const [containerId, container] of [...facet.containers.entries()].sort((a, b) => a[0] - b[0])) {
    const value = `${sourcePrefix}:${containerId}`;
    const label = container.label ?? 'Group';
    if (container.issues.size > 0) {
      children.push({
        value,
        label,
        children: [...container.issues.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, node]) => node),
      });
    } else {
      children.push({ value, label });
    }
  }
  for (const [unitId, label] of [...facet.unitLeaves.entries()].sort((a, b) => a[0] - b[0])) {
    children.push({ value: `${sourcePrefix}:u${unitId}`, label });
  }
  return children;
}

/**
 * Accumulates a single source into its material's facet data.
 *
 * Whole-material entries come from plain depictions; container-scoped
 * depictions register their parent container (with per-issue leaves for
 * comics); nested containers (books within collections) and standalone
 * chapters become individually addressable leaves.
 *
 * @param source             The event source to accumulate.
 * @param materialsByMedium  Mutable facet maps keyed by medium and material key.
 */
function accumulateMaterialFacet(
  source: EventSource,
  materialsByMedium: Map<Medium, Map<string, MaterialFacet>>,
): void {
  let byMedium = materialsByMedium.get(source.medium);
  if (byMedium === undefined) {
    byMedium = new Map();
    materialsByMedium.set(source.medium, byMedium);
  }
  const materialKey = source.sourceId !== undefined ? String(source.sourceId) : source.title;
  let facet = byMedium.get(materialKey);
  if (facet === undefined) {
    facet = {
      title: source.title,
      sourceId: source.sourceId,
      whole: undefined,
      containers: new Map(),
      unitLeaves: new Map(),
    };
    byMedium.set(materialKey, facet);
  }

  const unit = source.unit;
  if (source.sourceId === undefined || unit === undefined) {
    facet.whole = { value: materialKey, label: source.title };
    return;
  }
  if (unit.parentUnitId !== undefined && unit.parentUnitId !== null) {
    if (isContainerOrCollectionUnit(unit.unitType)) {
      if (!facet.unitLeaves.has(unit.id!)) {
        facet.unitLeaves.set(unit.id!, sourceUnitLabel(unit));
      }
      return;
    }
    let container = facet.containers.get(unit.parentUnitId);
    if (container === undefined) {
      container = { label: undefined, issues: new Map() };
      facet.containers.set(unit.parentUnitId, container);
    }
    if (unit.unitType === 'Issue') {
      if (!container.issues.has(unit.id!)) {
        container.issues.set(unit.id!, {
          value: `${source.sourceId}:${unit.parentUnitId}:${unit.id}`,
          label: `Issue ${unit.number}`,
        });
      }
      return;
    }
    return;
  }
  if (unit.unitType === 'Chapter') {
    if (!facet.unitLeaves.has(unit.id!)) {
      facet.unitLeaves.set(unit.id!, `Chapter ${unit.number}`);
    }
    return;
  }
  facet.whole = { value: materialKey, label: source.title };
}

/**
 * Collects facet options from a set of timeline events.
 *
 * Builds a hierarchical source tree grouped by medium and material,
 * and flat lists of locations, characters, and vehicles. Every source
 * depicting an event contributes to the facets; source tree nodes include
 * container nesting (seasons/volumes/books) for multi-unit materials, with
 * labels resolved through `resolveContainerLabel` when provided.
 *
 * @param events                 The timeline events to collect facet data from.
 * @param resolveContainerLabel  Optional resolver producing display labels for
 *                               container units ("Season 1") from catalog data.
 * @returns A complete set of {@link TimelineFacetOptions}.
 */
export function collectFacetOptions(
  events: readonly TimelineEvent[],
  resolveContainerLabel?: ContainerLabelResolver,
): TimelineFacetOptions {
  const materialsByMedium = new Map<Medium, Map<string, MaterialFacet>>();
  const locations = new Set<string>();
  const characters = new Set<string>();
  const vehicles = new Set<string>();

  for (const event of events) {
    for (const source of event.sources) {
      accumulateMaterialFacet(source, materialsByMedium);
    }
    for (const location of event.locations) locations.add(location);
    for (const character of event.characters) characters.add(character);
    for (const vehicle of event.vehicles) vehicles.add(vehicle);
  }

  if (resolveContainerLabel !== undefined) {
    for (const byMedium of materialsByMedium.values()) {
      for (const facet of byMedium.values()) {
        if (facet.sourceId === undefined) {
          continue;
        }
        for (const [containerId, container] of facet.containers) {
          container.label = resolveContainerLabel(facet.sourceId, containerId);
        }
      }
    }
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
        const materialValue =
          facet.sourceId !== undefined ? String(facet.sourceId) : facet.title;
        materialNodes.push({ value: materialValue, label: facet.title, children });
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
