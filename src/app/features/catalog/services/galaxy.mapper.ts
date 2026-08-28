/**
 * @fileoverview Pure mapping functions for galaxy DTOs.
 * Converts wire-format DTOs (with numeric enum codes) into domain-level
 * interfaces (with string unions).
 */
import {
  ApiNamedLink,
  ApiPlanet,
  ApiPlanetLocation,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../shared/models/api-galaxy';
import { planetLocationTypeFromApiCode } from '../../../shared/models/planet-location-type';
import {
  NamedLinkDto,
  PlanetDto,
  PlanetLocationDto,
  PlanetSystemDto,
  RegionDto,
  SubregionDto,
} from './galaxy.dto';

/** Maps a lightweight named-link DTO to its domain-level shape. */
export function mapNamedLink(item: NamedLinkDto): ApiNamedLink {
  return { id: item.id, name: item.name };
}

/** Maps a region DTO to a domain-level {@link ApiRegion}. */
export function mapRegion(item: RegionDto): ApiRegion {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    subregions: item.subregions.map(mapNamedLink),
  };
}

/** Maps a subregion DTO to a domain-level {@link ApiSubregion}. */
export function mapSubregion(item: SubregionDto): ApiSubregion {
  return {
    id: item.id,
    name: item.name,
    sectorType: item.sectorType,
    description: item.description,
    regions: item.regions.map(mapNamedLink),
    planetSystems: item.planetSystems.map(mapNamedLink),
  };
}

/** Maps a planet-system DTO to a domain-level {@link ApiPlanetSystem}. */
export function mapPlanetSystem(item: PlanetSystemDto): ApiPlanetSystem {
  return {
    id: item.id,
    name: item.name,
    coordinates: item.coordinates,
    description: item.description,
    subregions: item.subregions.map(mapNamedLink),
  };
}

/** Maps a planet DTO to a domain-level {@link ApiPlanet}. */
export function mapPlanet(item: PlanetDto): ApiPlanet {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    planetSystemId: item.planetSystemId,
    planetSystemName: item.planetSystemName,
    locations: item.locations.map(mapNamedLink),
  };
}

/** Maps a planet-location DTO to a domain-level {@link ApiPlanetLocation}. */
export function mapPlanetLocation(item: PlanetLocationDto): ApiPlanetLocation {
  return {
    id: item.id,
    name: item.name,
    type: planetLocationTypeFromApiCode(item.type),
    coordinates: item.coordinates,
    description: item.description,
    planetId: item.planetId,
    planetName: item.planetName,
  };
}
