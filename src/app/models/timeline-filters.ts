import { matchesCanonView, CanonView } from './canon';
import { MEDIA, Medium } from './medium';
import { sourceGroupName } from './source-material';
import { TimelineEvent } from './timeline-event';

export type FacetKey = 'sources' | 'locations' | 'characters' | 'vehicles';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterTreeNode extends FilterOption {
  children?: readonly FilterTreeNode[];
}

export interface TimelineFilters {
  canonView: CanonView;
  sources: readonly string[];
  locations: readonly string[];
  characters: readonly string[];
  vehicles: readonly string[];
}

export interface TimelineFacetOptions {
  sources: readonly FilterTreeNode[];
  locations: readonly FilterTreeNode[];
  characters: readonly FilterTreeNode[];
  vehicles: readonly FilterTreeNode[];
}

export function createEmptyFilters(): TimelineFilters {
  return {
    canonView: 'Canon',
    sources: [],
    locations: [],
    characters: [],
    vehicles: [],
  };
}

function simpleOption(value: string): FilterTreeNode {
  return { value, label: value };
}

export function collectTreeLeaves(node: FilterTreeNode): string[] {
  if (node.children !== undefined && node.children.length > 0) {
    return node.children.flatMap(collectTreeLeaves);
  }
  return [node.value];
}

export interface SourceFilterChip {
  label: string;
  values: readonly string[];
  medium?: boolean;
}

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

interface MaterialFacet {
  title: string;
  sourceId: string | undefined;
  whole: FilterTreeNode | undefined;
  groups: Map<number, string>;
  volumes: Map<number, Map<number, string>>;
  chapters: Map<number, string>;
}

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

export function matchesFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
  return matchesCanonView(event.canon, filters.canonView) && matchesFacetFilters(event, filters);
}
