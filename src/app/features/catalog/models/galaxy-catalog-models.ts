/**
 * @fileoverview View models shared by the `GalaxyCatalog` pages and the
 * extracted child components that render its forms and tree lists.
 */

import {
  ApiPlanet,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../shared/models/api-galaxy';

/** One of the three galaxy browsing views. */
export type GalaxyView = 'regions' | 'subregions' | 'systems';

/** One of the five hierarchy levels, used to branch form and mutation logic. */
export type GalaxyKind = 'region' | 'subregion' | 'planet-system' | 'planet' | 'planet-location';

/** What the inline form is currently editing or adding. */
export interface GalaxyItemFormState {
  /** The level being edited, or created when `id` is null. */
  readonly kind: GalaxyKind;
  /** The row being edited, or `null` when adding. */
  readonly id: number | null;
  /** Owning parent id (region / subregion / system / planet), or `null`. */
  readonly parentId: number | null;
}

/** A pending server-side delete awaiting confirmation. */
export interface GalaxyDeleteTarget {
  readonly kind: GalaxyKind;
  readonly id: number;
  readonly name: string;
}

/** One location row nested under a planet. */
export interface GalaxyLocationNode {
  readonly id: number;
  readonly name: string;
}

/** Payload for editing a planet location, pinning its owning planet. */
export interface GalaxyLocationEdit {
  readonly location: GalaxyLocationNode;
  readonly planetId: number;
}

/** One planet row plus its surface locations. */
export interface GalaxyPlanetNode {
  readonly planet: ApiPlanet;
  readonly locations: readonly GalaxyLocationNode[];
}

/** One planet system row plus its planets. */
export interface GalaxySystemNode {
  readonly system: ApiPlanetSystem;
  readonly planets: readonly GalaxyPlanetNode[];
}

/** One subregion row plus its planet systems. */
export interface GalaxySubregionNode {
  readonly subregion: ApiSubregion;
  readonly systems: readonly GalaxySystemNode[];
}

/** One region row plus its subregions. */
export interface GalaxyRegionNode {
  readonly region: ApiRegion;
  readonly subregions: readonly GalaxySubregionNode[];
}

/**
 * The slice of the `GalaxyCatalog` component's API surface consumed by the
 * extracted tree-list child components. Typed as a narrow interface so the
 * children stay coupled to a contract instead of the concrete parent.
 */
export interface GalaxyCatalogHost {
  /** Whether the current viewer may edit the catalogs. */
  isAdmin(): boolean;
  /** Whether the given tree node key is currently expanded. */
  isExpanded(key: string): boolean;
  /** Toggles one tree node's expanded state. */
  toggleExpanded(key: string): void;
  /** Expands a planet row and warms its location cache for inline editing. */
  togglePlanet(planet: ApiPlanet): void;
  /** Opens the edit form for a region row. */
  startEditRegion(region: ApiRegion): void;
  /** Opens the edit form for a subregion row, preserving its region links. */
  startEditSubregion(subregion: ApiSubregion): void;
  /** Opens the edit form for a planet system row, preserving its subregion links. */
  startEditSystem(system: ApiPlanetSystem): void;
  /** Opens the edit form for a planet row. */
  startEditPlanet(planet: ApiPlanet): void;
  /** Opens the edit form for a planet location row. */
  startEditLocation(location: GalaxyLocationNode, planetId: number): void;
  /** Prompts the user to confirm deleting one galaxy row. */
  requestDelete(kind: GalaxyKind, id: number, name: string): void;
  /** Opens the add-subregion form, optionally pre-selecting the owning region. */
  openAddSubregion(regionId: number | null): void;
  /** Opens the add-planet-system form, optionally pre-selecting the owning subregion. */
  openAddSystem(subregionId: number | null): void;
  /** Opens the add-planet form scoped under one planet system. */
  openAddPlanet(systemId: number): void;
  /** Opens the add-location form scoped under one planet. */
  openAddLocation(planetId: number): void;
}
