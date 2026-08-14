import { matchesCanonView, CanonView } from './canon';
import { MEDIA, Medium } from './medium';
import { TimelineEvent } from './timeline-event';

export type FacetKey = 'mediums' | 'sources' | 'locations' | 'characters' | 'vehicles';

export interface TimelineFilters {
  canonView: CanonView;
  mediums: readonly string[];
  sources: readonly string[];
  locations: readonly string[];
  characters: readonly string[];
  vehicles: readonly string[];
}

export interface TimelineFacetOptions {
  mediums: readonly string[];
  sources: readonly string[];
  locations: readonly string[];
  characters: readonly string[];
  vehicles: readonly string[];
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

export function collectFacetOptions(events: readonly TimelineEvent[]): TimelineFacetOptions {
  const mediums = new Set<Medium>();
  const sources = new Set<string>();
  const locations = new Set<string>();
  const characters = new Set<string>();
  const vehicles = new Set<string>();

  for (const event of events) {
    mediums.add(event.source.medium);
    sources.add(event.source.title);
    for (const location of event.locations) locations.add(location);
    for (const character of event.characters) characters.add(character);
    for (const vehicle of event.vehicles) vehicles.add(vehicle);
  }

  const sorted = (values: ReadonlySet<string>): string[] =>
    [...values].sort((a, b) => a.localeCompare(b));

  return {
    mediums: MEDIA.filter((medium) => mediums.has(medium)),
    sources: sorted(sources),
    locations: sorted(locations),
    characters: sorted(characters),
    vehicles: sorted(vehicles),
  };
}

export function matchesFacetFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
  if (filters.mediums.length > 0 && !filters.mediums.includes(event.source.medium)) {
    return false;
  }
  if (filters.sources.length > 0 && !filters.sources.includes(event.source.title)) {
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
