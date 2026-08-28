/**
 * @fileoverview Shared HTTP-mock fixtures for the galaxy catalog specs. Both
 * `GalaxyCatalog` and `GalaxyBrowser` integration tests run against the real
 * {@link GalaxyService} over the Angular HTTP testing backend; this module
 * centralizes the URL plumbing and fixture flushing so neither spec duplicates
 * it.
 */
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  PlanetDto,
  PlanetLocationDto,
  PlanetSystemDto,
  RegionDto,
  SubregionDto,
} from '../services/galaxy.dto';
import { GalaxyService } from '../services/galaxy.service';

const REGIONS_URL = '/api/regions';
const SUBREGIONS_URL = '/api/subregions';
const PLANET_SYSTEMS_URL = '/api/planet-systems';
export { REGIONS_URL, SUBREGIONS_URL, PLANET_SYSTEMS_URL };

/** Fixture group passed to {@link drainGalaxyRequests} / {@link seedGalaxy}. */
export interface GalaxySeed {
  readonly regions?: readonly RegionDto[];
  readonly subregions?: readonly SubregionDto[];
  readonly systems?: readonly PlanetSystemDto[];
  /** Planets keyed by their owning planet-system id. */
  readonly planets?: Readonly<Record<number, readonly PlanetDto[]>>;
  /** Locations keyed by their owning planet id. */
  readonly locations?: Readonly<Record<number, readonly PlanetLocationDto[]>>;
}

/** Whether the pending request is one of the galaxy catalog feeds. */
export function isGalaxyRequest({ url }: HttpRequest<unknown>): boolean {
  return (
    url.includes(REGIONS_URL) ||
    url.includes(SUBREGIONS_URL) ||
    url.includes(PLANET_SYSTEMS_URL) ||
    url.includes('/api/planets')
  );
}

/**
 * Flushes every pending galaxy GET with the matching fixture, looping so the
 * aggregate planet-systems request can cascade into per-system planet lists.
 */
export function drainGalaxyRequests(httpMock: HttpTestingController, seed: GalaxySeed = {}): void {
  const regions = seed.regions ?? [];
  const subregions = seed.subregions ?? [];
  const systems = seed.systems ?? [];
  const planets = seed.planets ?? {};
  const locations = seed.locations ?? {};

  let pending = httpMock.match(isGalaxyRequest);
  while (pending.length > 0) {
    for (const request of pending) {
      const url = request.request.url;
      if (url.endsWith(REGIONS_URL)) {
        request.flush([...regions]);
      } else if (url.endsWith(SUBREGIONS_URL)) {
        request.flush([...subregions]);
      } else if (url.endsWith(PLANET_SYSTEMS_URL)) {
        request.flush([...systems]);
      } else {
        const systemMatch = url.match(/planet-systems\/(\d+)\/planets$/);
        if (systemMatch) {
          request.flush([...(planets[Number(systemMatch[1])] ?? [])]);
        } else {
          const planetMatch = url.match(/planets\/(\d+)\/locations$/);
          if (planetMatch) {
            request.flush([...(locations[Number(planetMatch[1])] ?? [])]);
          } else {
            request.flush([]);
          }
        }
      }
    }
    pending = httpMock.match(isGalaxyRequest);
  }
}

/** Re-seeds every galaxy cache and renders the new state. */
export function seedGalaxy(
  galaxyService: GalaxyService,
  httpMock: HttpTestingController,
  fixture: ComponentFixture<unknown>,
  seed: GalaxySeed,
): void {
  galaxyService.invalidateRegions();
  galaxyService.invalidateSubregions();
  galaxyService.invalidatePlanetSystems();
  galaxyService.invalidatePlanets();
  drainGalaxyRequests(httpMock, seed);
  fixture.detectChanges();
}
