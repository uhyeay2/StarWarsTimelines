import { PlanetLocationType } from './planet-location-type';

/** A lightweight reference to a linked galaxy entry, carrying just id + name. */
export interface ApiNamedLink {
  readonly id: number;
  readonly name: string;
}

/** A region: the top level of the galaxy hierarchy. */
export interface ApiRegion {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  /** The subregions that sit inside this region. */
  readonly subregions: readonly ApiNamedLink[];
}

/** A subregion (sector) spanning one or more regions. */
export interface ApiSubregion {
  readonly id: number;
  readonly name: string;
  readonly sectorType: string | null;
  readonly description: string | null;
  /** The regions this subregion belongs to. */
  readonly regions: readonly ApiNamedLink[];
  /** The planet systems inside this subregion. */
  readonly planetSystems: readonly ApiNamedLink[];
}

/** A planet system (star system) spanning one or more subregions. */
export interface ApiPlanetSystem {
  readonly id: number;
  readonly name: string;
  readonly coordinates: string | null;
  readonly description: string | null;
  /** The subregions this system sits inside. */
  readonly subregions: readonly ApiNamedLink[];
}

/** A planet inside exactly one planet system. */
export interface ApiPlanet {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly planetSystemId: number;
  readonly planetSystemName: string;
  /** The locations on the planet's surface. */
  readonly locations: readonly ApiNamedLink[];
}

/** A single place on a planet's surface. */
export interface ApiPlanetLocation {
  readonly id: number;
  readonly name: string;
  readonly type: PlanetLocationType;
  readonly coordinates: string | null;
  readonly description: string | null;
  readonly planetId: number;
  readonly planetName: string;
}
