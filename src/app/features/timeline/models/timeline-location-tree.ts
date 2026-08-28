/**
 * @fileoverview Builds the hierarchical "Locations" filter tree for the
 * timeline's advanced filter panel, grouping the galaxy's place names by
 * Region -> Subregion -> PlanetSystem -> Planet -> PlanetLocation.
 *
 * Every node is a selectable place in its own right (`ownLeaf`) while also
 * nesting its descendants, so checking a planet selects that planet plus all
 * of its surface locations, and checking a region selects everything beneath
 * it. Place names that cannot be reached from a Region root (orphaned
 * subregions / systems / planets / locations) are appended as top-level
 * leaves so no catalogued place is ever hidden from filtering.
 */

import { FilterTreeNode } from '../../../shared/models/filter-tree';
import {
  ApiPlanet,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../shared/models/api-galaxy';

/** A light named galaxy link (surface location child of a planet). */
type NamedLocationLink = ApiPlanet['locations'][number];

/** The galaxy data needed to assemble the location filter tree. */
export interface TimelineLocationTreeData {
  /** All regions (may be empty or `null` before load). */
  readonly regions: readonly ApiRegion[] | null;
  /** All subregions (may be empty or `null` before load). */
  readonly subregions: readonly ApiSubregion[] | null;
  /** All planet systems (may be empty or `null` before load). */
  readonly planetSystems: readonly ApiPlanetSystem[] | null;
  /** All planets, each carrying its embedded surface-location links. */
  readonly planets: readonly ApiPlanet[] | null;
}

/**
 * Builds the hierarchical location filter options from galaxy data.
 *
 * @param data  The galaxy regions / subregions / systems / planets.
 * @returns The location filter tree, sorted by label at every level.
 */
export function buildLocationFilterTree(data: TimelineLocationTreeData): readonly FilterTreeNode[] {
  const regions = data.regions ?? [];
  const subregions = data.subregions ?? [];
  const systems = data.planetSystems ?? [];
  const planets = data.planets ?? [];

  const regionNode = (region: ApiRegion): FilterTreeNode => ({
    value: region.name,
    label: region.name,
    ownLeaf: true,
    children: subregions
      .filter((subregion) => subregion.regions.some((link) => link.id === region.id))
      .map(subregionNode)
      .sort(byLabel),
  });

  const subregionNode = (subregion: ApiSubregion): FilterTreeNode => ({
    value: subregion.name,
    label: subregion.name,
    ownLeaf: true,
    children: systems
      .filter((system) => system.subregions.some((link) => link.id === subregion.id))
      .map(systemNode)
      .sort(byLabel),
  });

  const systemNode = (system: ApiPlanetSystem): FilterTreeNode => ({
    value: system.name,
    label: system.name,
    ownLeaf: true,
    children: planets
      .filter((planet) => planet.planetSystemId === system.id)
      .map(planetNode)
      .sort(byLabel),
  });

  const planetNode = (planet: ApiPlanet): FilterTreeNode => ({
    value: planet.name,
    label: planet.name,
    ownLeaf: true,
    children: planet.locations.map(locationNode).sort(byLabel),
  });

  const locationNode = (location: NamedLocationLink): FilterTreeNode => ({
    value: location.name,
    label: location.name,
  });

  // A node is an orphan when it cannot be reached from any Region root.
  const regionIds = new Set(regions.map((region) => region.id));
  const reachableSubregionIds = new Set(
    subregions
      .filter((subregion) => subregion.regions.some((link) => regionIds.has(link.id)))
      .map((s) => s.id),
  );
  const reachableSystemIds = new Set(
    systems
      .filter((system) => system.subregions.some((link) => reachableSubregionIds.has(link.id)))
      .map((s) => s.id),
  );
  const reachablePlanetIds = new Set(
    planets.filter((planet) => reachableSystemIds.has(planet.planetSystemId)).map((p) => p.id),
  );

  const regionNodes = regions.map(regionNode).sort(byLabel);
  const orphanNodes = [
    ...subregions.filter((s) => !reachableSubregionIds.has(s.id)).map(subregionNode),
    ...systems.filter((s) => !reachableSystemIds.has(s.id)).map(systemNode),
    ...planets.filter((p) => !reachablePlanetIds.has(p.id)).map(planetNode),
  ].sort(byLabel);

  return [...regionNodes, ...orphanNodes];
}

/** Sorts a pair of tree nodes by their display labels. */
function byLabel(a: FilterTreeNode, b: FilterTreeNode): number {
  return a.label.localeCompare(b.label);
}
