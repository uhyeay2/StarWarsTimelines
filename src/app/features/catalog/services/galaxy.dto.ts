/**
 * @fileoverview Internal wire-type DTOs for the galaxy API.
 *
 * These interfaces represent the raw JSON shapes returned by the ASP.NET Core
 * backend. Enum-typed fields (`type`, `locationHierarchyType`) are numeric
 * codes rather than the domain-level string unions used throughout the
 * Angular application.
 *
 * @see {@link GalaxyService} for the service that consumes these DTOs.
 */

/** A lightweight reference to a linked galaxy entry (id + name only). */
export interface NamedLinkDto {
  readonly id: number;
  readonly name: string;
}

/** Response body of the region endpoints. */
export interface RegionDto {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly subregions: readonly NamedLinkDto[];
}

/** Response body of the subregion endpoints. */
export interface SubregionDto {
  readonly id: number;
  readonly name: string;
  readonly sectorType: string | null;
  readonly description: string | null;
  readonly regions: readonly NamedLinkDto[];
  readonly planetSystems: readonly NamedLinkDto[];
}

/** Response body of the planet-system endpoints. */
export interface PlanetSystemDto {
  readonly id: number;
  readonly name: string;
  readonly coordinates: string | null;
  readonly description: string | null;
  readonly subregions: readonly NamedLinkDto[];
}

/** Response body of the planet endpoints. */
export interface PlanetDto {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly planetSystemId: number;
  readonly planetSystemName: string;
  readonly locations: readonly NamedLinkDto[];
}

/** Response body of the planet-location endpoints; `type` is a numeric enum code. */
export interface PlanetLocationDto {
  readonly id: number;
  readonly name: string;
  readonly type: number;
  readonly coordinates: string | null;
  readonly description: string | null;
  readonly planetId: number;
  readonly planetName: string;
}
