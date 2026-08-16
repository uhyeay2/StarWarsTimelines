import { matchesCanonView, CanonView } from './canon';
import { MEDIA, Medium } from './medium';
import { sourceGroupName } from './source-material';
import { TimelineEvent } from './timeline-event';

export type FacetKey = 'mediums' | 'sources' | 'locations' | 'characters' | 'vehicles';

export interface FilterOption {
  value: string;
  label: string;
}

export interface TimelineFilters {
  canonView: CanonView;
  mediums: readonly string[];
  sources: readonly string[];
  locations: readonly string[];
  characters: readonly string[];
  vehicles: readonly string[];
}

export interface TimelineFacetOptions {
  mediums: readonly FilterOption[];
  sources: readonly FilterOption[];
  locations: readonly FilterOption[];
  characters: readonly FilterOption[];
  vehicles: readonly FilterOption[];
}

export function createEmptyFilters(): TimelineFilters {
  return {
    canonView: 'Canon',
    mediums: [],
    sources: [],
    locations: [],
    characters: [],
    vehicles: [],
  };
}

function simpleOption(value: string): FilterOption {
  return { value, label: value };
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
    return `${event.source.sourceId}:${unit.groupNumber}`;
  }
  if (unit.unitType === 'Chapter') {
    return `${event.source.sourceId}:chapter-${unit.number}`;
  }
  return event.source.sourceId;
}

export function collectFacetOptions(events: readonly TimelineEvent[]): TimelineFacetOptions {
  const mediums = new Set<Medium>();
  const sources = new Map<string, FilterOption>();
  const locations = new Set<string>();
  const characters = new Set<string>();
  const vehicles = new Set<string>();

  for (const event of events) {
    mediums.add(event.source.medium);
    const source = event.source;
    const key = sourceFacetKey(event);
    if (source.sourceId === undefined) {
      sources.set(key, simpleOption(source.title));
    } else {
      const unit = source.unit;
      if (unit !== undefined && unit.groupNumber !== undefined) {
        const groupName = sourceGroupName(unit.unitType);
        sources.set(key, {
          value: key,
          label:
            groupName === undefined
              ? `${source.title} — Group ${unit.groupNumber}`
              : `${source.title} — ${groupName} ${unit.groupNumber}`,
        });
      } else if (unit !== undefined && unit.unitType === 'Chapter') {
        sources.set(key, {
          value: key,
          label: `${source.title} — Chapter ${unit.number}`,
        });
      } else {
        sources.set(key, { value: key, label: source.title });
      }
    }
    for (const location of event.locations) locations.add(location);
    for (const character of event.characters) characters.add(character);
    for (const vehicle of event.vehicles) vehicles.add(vehicle);
  }

  const sorted = (values: ReadonlySet<string>): string[] =>
    [...values].sort((a, b) => a.localeCompare(b));
  const sortedSources = [...sources.values()].sort((a, b) => a.value.localeCompare(b.value));

  return {
    mediums: MEDIA.filter((medium) => mediums.has(medium)).map(simpleOption),
    sources: sortedSources,
    locations: sorted(locations).map(simpleOption),
    characters: sorted(characters).map(simpleOption),
    vehicles: sorted(vehicles).map(simpleOption),
  };
}

export function matchesFacetFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
  if (filters.mediums.length > 0 && !filters.mediums.includes(event.source.medium)) {
    return false;
  }
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
