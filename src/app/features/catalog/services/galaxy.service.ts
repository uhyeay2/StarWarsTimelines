/**
 * @fileoverview CRUD service for the galaxy hierarchy (regions, subregions,
 * planet systems, planets, planet locations). Manages SignalCache instances
 * per hierarchy level and exposes reactive signals for the catalog UI,
 * character/species home-planet selects, and the timeline location pickers.
 */
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  ApiNamedLink,
  ApiPlanet,
  ApiPlanetLocation,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../shared/models/api-galaxy';
import {
  PlanetLocationType,
  planetLocationTypeToApiCode,
} from '../../../shared/models/planet-location-type';
import { catalogErrorHandler } from './catalog-error-handler';
import { CATALOG_API_BASE, CACHE_TTL_MS } from './catalog-constants';
import { CatalogErrorCode } from '../models/catalog-error';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { SignalCache } from '../../../shared/utils/signal-cache';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import {
  mapPlanet,
  mapPlanetLocation,
  mapPlanetSystem,
  mapRegion,
  mapSubregion,
} from './galaxy.mapper';
import {
  PlanetDto,
  PlanetLocationDto,
  PlanetSystemDto,
  RegionDto,
  SubregionDto,
} from './galaxy.dto';

/** A flat planet-location reference (id + name) with its owning planet. */
export interface GalaxyPlanetLocationRef extends ApiNamedLink {
  readonly planetId: number;
  readonly planetName: string;
}

/** Maps a raw error to a display string for a given catalog feed. */
function galaxyError(label: string) {
  return (err: unknown): string =>
    err instanceof HttpErrorResponse
      ? readProblemDetail(err, `Failed to load ${label}`)
      : `Failed to load ${label}`;
}

@Injectable({ providedIn: 'root' })
export class GalaxyService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // ─── Level caches ────────────────────────────────────────────────────────

  private readonly regionsCache = new SignalCache<readonly ApiRegion[]>(
    () =>
      this.http
        .get<readonly RegionDto[]>(`${CATALOG_API_BASE}/regions`)
        .pipe(map((items) => items.map(mapRegion))),
    galaxyError('regions'),
    CACHE_TTL_MS,
  );

  private readonly subregionsCache = new SignalCache<readonly ApiSubregion[]>(
    () =>
      this.http
        .get<readonly SubregionDto[]>(`${CATALOG_API_BASE}/subregions`)
        .pipe(map((items) => items.map(mapSubregion))),
    galaxyError('subregions'),
    CACHE_TTL_MS,
  );

  private readonly planetSystemsCache = new SignalCache<readonly ApiPlanetSystem[]>(
    () =>
      this.http
        .get<readonly PlanetSystemDto[]>(`${CATALOG_API_BASE}/planet-systems`)
        .pipe(map((items) => items.map(mapPlanetSystem))),
    galaxyError('planet systems'),
    CACHE_TTL_MS,
  );

  /** Aggregated planet list built by fetching every system's planets. */
  private readonly planetsCache = new SignalCache<readonly ApiPlanet[]>(
    () => this.fetchAllPlanets(),
    galaxyError('planets'),
    CACHE_TTL_MS,
  );

  /** Per-planet location caches keyed by planet ID (full detail incl. type). */
  private readonly planetLocationCaches = new Map<
    number,
    SignalCache<readonly ApiPlanetLocation[]>
  >();

  // ─── Public signals ──────────────────────────────────────────────────────

  readonly regions = this.regionsCache.data;
  readonly regionsLoading = this.regionsCache.loading;
  readonly regionsError = this.regionsCache.error;

  readonly subregions = this.subregionsCache.data;
  readonly subregionsLoading = this.subregionsCache.loading;
  readonly subregionsError = this.subregionsCache.error;

  readonly planetSystems = this.planetSystemsCache.data;
  readonly planetSystemsLoading = this.planetSystemsCache.loading;
  readonly planetSystemsError = this.planetSystemsCache.error;

  readonly planets = this.planetsCache.data;
  readonly planetsLoading = this.planetsCache.loading;
  readonly planetsError = this.planetsCache.error;

  /** Flat planet-location refs derived from the aggregated planet list. */
  readonly planetLocations = computed<readonly GalaxyPlanetLocationRef[]>(() => {
    const refs: GalaxyPlanetLocationRef[] = [];
    for (const planet of this.planets() ?? []) {
      for (const location of planet.locations) {
        refs.push({
          id: location.id,
          name: location.name,
          planetId: planet.id,
          planetName: planet.name,
        });
      }
    }
    return refs;
  });

  // ─── Fetch methods ───────────────────────────────────────────────────────

  /** Fetches every hierarchy level (regions, subregions, systems, planets). */
  fetchAll(): void {
    this.fetchRegions();
    this.fetchSubregions();
    this.fetchPlanetSystems();
    this.fetchPlanets();
  }

  /** Fetches the regions list. */
  fetchRegions(): void {
    this.regionsCache.fetch();
  }

  /** Fetches the subregions list. */
  fetchSubregions(): void {
    this.subregionsCache.fetch();
  }

  /** Fetches the planet systems list. */
  fetchPlanetSystems(): void {
    this.planetSystemsCache.fetch();
  }

  /** Fetches the aggregated planets list (one request per system). */
  fetchPlanets(): void {
    this.planetsCache.fetch();
  }

  /**
   * Returns the full planet-location list for a planet, creating the cache if
   * needed.
   * @param planetId - The owning planet's identifier.
   */
  getPlanetLocationCache(planetId: number): SignalCache<readonly ApiPlanetLocation[]> {
    let cache = this.planetLocationCaches.get(planetId);
    if (!cache) {
      cache = new SignalCache<readonly ApiPlanetLocation[]>(
        () =>
          this.http
            .get<readonly PlanetLocationDto[]>(`${CATALOG_API_BASE}/planets/${planetId}/locations`)
            .pipe(map((items) => items.map(mapPlanetLocation))),
        galaxyError('planet locations'),
        CACHE_TTL_MS,
      );
      this.planetLocationCaches.set(planetId, cache);
    }
    return cache;
  }

  // ─── Invalidation ────────────────────────────────────────────────────────

  /** Invalidates the regions cache (and subregions, which embed region names). */
  invalidateRegions(): void {
    this.regionsCache.invalidate();
    this.subregionsCache.invalidate();
  }

  /** Invalidates the subregions cache (and its display dependents). */
  invalidateSubregions(): void {
    this.subregionsCache.invalidate();
    this.regionsCache.invalidate();
    this.planetSystemsCache.invalidate();
  }

  /** Invalidates the planet systems cache (and its display dependents). */
  invalidatePlanetSystems(): void {
    this.planetSystemsCache.invalidate();
    this.subregionsCache.invalidate();
    this.planetsCache.invalidate();
  }

  /** Invalidates the aggregated planets cache and all per-planet location caches. */
  invalidatePlanets(): void {
    this.planetsCache.invalidate();
    this.invalidateLocationCaches();
  }

  /** Invalidates every per-planet location cache and the embedded planet locations. */
  invalidatePlanetLocations(): void {
    this.planetsCache.invalidate();
    this.invalidateLocationCaches();
  }

  // ─── Region CRUD ─────────────────────────────────────────────────────────

  /**
   * Creates a new region.
   * @param name - The region name.
   * @param description - An optional description.
   */
  createRegion(name: string, description: string | null): Observable<ApiRegion> {
    return this.http.post<RegionDto>(`${CATALOG_API_BASE}/regions`, { name, description }).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to create the region. Please try again.',
          'createRegion',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      map(mapRegion),
      tap(() => this.invalidateRegions()),
    );
  }

  /**
   * Replaces a region's fields.
   * @param id - The region identifier.
   * @param name - The region name.
   * @param description - An optional description; `null` clears it.
   */
  updateRegion(id: number, name: string, description: string | null): Observable<ApiRegion> {
    return this.http
      .put<RegionDto>(`${CATALOG_API_BASE}/regions/${id}`, { name, description })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the region. Please try again.',
            'updateRegion',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapRegion),
        tap(() => this.invalidateRegions()),
      );
  }

  /**
   * Deletes a region by id.
   * @param id - The region identifier.
   */
  deleteRegion(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/regions/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the region. Please try again.',
          'deleteRegion',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.invalidateRegions()),
    );
  }

  // ─── Subregion CRUD ──────────────────────────────────────────────────────

  /**
   * Creates a new subregion and links it to its regions.
   * @param name - The subregion name.
   * @param sectorType - An optional classification such as "sector".
   * @param description - An optional description.
   * @param regionIds - The regions the subregion belongs to.
   */
  createSubregion(
    name: string,
    sectorType: string | null,
    description: string | null,
    regionIds: readonly number[],
  ): Observable<ApiSubregion> {
    return this.http
      .post<SubregionDto>(`${CATALOG_API_BASE}/subregions`, {
        name,
        sectorType,
        description,
        regionIds: [...regionIds],
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the subregion. Please try again.',
            'createSubregion',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapSubregion),
        tap(() => this.invalidateSubregions()),
      );
  }

  /**
   * Replaces a subregion's fields and region links.
   * @param id - The subregion identifier.
   * @param name - The subregion name.
   * @param sectorType - An optional classification; `null` clears it.
   * @param description - An optional description; `null` clears it.
   * @param regionIds - The complete region link list replacing the previous links.
   */
  updateSubregion(
    id: number,
    name: string,
    sectorType: string | null,
    description: string | null,
    regionIds: readonly number[],
  ): Observable<ApiSubregion> {
    return this.http
      .put<SubregionDto>(`${CATALOG_API_BASE}/subregions/${id}`, {
        name,
        sectorType,
        description,
        regionIds: [...regionIds],
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the subregion. Please try again.',
            'updateSubregion',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapSubregion),
        tap(() => this.invalidateSubregions()),
      );
  }

  /**
   * Deletes a subregion by id.
   * @param id - The subregion identifier.
   */
  deleteSubregion(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/subregions/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the subregion. Please try again.',
          'deleteSubregion',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.invalidateSubregions()),
    );
  }

  // ─── Planet system CRUD ──────────────────────────────────────────────────

  /**
   * Creates a new planet system and links it to its subregions.
   * @param name - The system name.
   * @param coordinates - An optional galactic grid reference.
   * @param description - An optional description.
   * @param subregionIds - The subregions the system sits inside.
   */
  createPlanetSystem(
    name: string,
    coordinates: string | null,
    description: string | null,
    subregionIds: readonly number[],
  ): Observable<ApiPlanetSystem> {
    return this.http
      .post<PlanetSystemDto>(`${CATALOG_API_BASE}/planet-systems`, {
        name,
        coordinates,
        description,
        subregionIds: [...subregionIds],
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the planet system. Please try again.',
            'createPlanetSystem',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapPlanetSystem),
        tap(() => this.invalidatePlanetSystems()),
      );
  }

  /**
   * Replaces a planet system's fields and subregion links.
   * @param id - The system identifier.
   * @param name - The system name.
   * @param coordinates - An optional grid reference; `null` clears it.
   * @param description - An optional description; `null` clears it.
   * @param subregionIds - The complete subregion link list replacing the previous links.
   */
  updatePlanetSystem(
    id: number,
    name: string,
    coordinates: string | null,
    description: string | null,
    subregionIds: readonly number[],
  ): Observable<ApiPlanetSystem> {
    return this.http
      .put<PlanetSystemDto>(`${CATALOG_API_BASE}/planet-systems/${id}`, {
        name,
        coordinates,
        description,
        subregionIds: [...subregionIds],
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the planet system. Please try again.',
            'updatePlanetSystem',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapPlanetSystem),
        tap(() => this.invalidatePlanetSystems()),
      );
  }

  /**
   * Deletes a planet system by id.
   * @param id - The system identifier.
   */
  deletePlanetSystem(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/planet-systems/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the planet system. Please try again.',
          'deletePlanetSystem',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.invalidatePlanetSystems()),
    );
  }

  // ─── Planet CRUD ─────────────────────────────────────────────────────────

  /**
   * Creates a new planet inside a planet system.
   * @param planetSystemId - The owning system identifier.
   * @param name - The planet name.
   * @param description - An optional description.
   */
  createPlanet(
    planetSystemId: number,
    name: string,
    description: string | null,
  ): Observable<ApiPlanet> {
    return this.http
      .post<PlanetDto>(`${CATALOG_API_BASE}/planet-systems/${planetSystemId}/planets`, {
        name,
        description,
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the planet. Please try again.',
            'createPlanet',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapPlanet),
        tap(() => this.invalidatePlanets()),
      );
  }

  /**
   * Replaces a planet's fields.
   * @param id - The planet identifier.
   * @param name - The planet name.
   * @param description - An optional description; `null` clears it.
   */
  updatePlanet(id: number, name: string, description: string | null): Observable<ApiPlanet> {
    return this.http
      .put<PlanetDto>(`${CATALOG_API_BASE}/planets/${id}`, { name, description })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the planet. Please try again.',
            'updatePlanet',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapPlanet),
        tap(() => this.invalidatePlanets()),
      );
  }

  /**
   * Deletes a planet by id.
   * @param id - The planet identifier.
   */
  deletePlanet(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/planets/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the planet. Please try again.',
          'deletePlanet',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.invalidatePlanets()),
    );
  }

  // ─── Planet location CRUD ────────────────────────────────────────────────

  /**
   * Creates a new location on a planet's surface.
   * @param planetId - The owning planet identifier.
   * @param name - The location name.
   * @param type - The kind of place.
   * @param coordinates - An optional coordinate reference.
   * @param description - An optional description.
   */
  createPlanetLocation(
    planetId: number,
    name: string,
    type: PlanetLocationType,
    coordinates: string | null,
    description: string | null,
  ): Observable<ApiPlanetLocation> {
    return this.http
      .post<PlanetLocationDto>(`${CATALOG_API_BASE}/planets/${planetId}/locations`, {
        name,
        type: planetLocationTypeToApiCode(type),
        coordinates,
        description,
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the planet location. Please try again.',
            'createPlanetLocation',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapPlanetLocation),
        tap(() => this.invalidatePlanetLocationCache(planetId)),
      );
  }

  /**
   * Replaces a planet location's fields.
   * @param id - The location identifier.
   * @param name - The location name.
   * @param type - The kind of place.
   * @param coordinates - An optional reference; `null` clears it.
   * @param description - An optional description; `null` clears it.
   */
  updatePlanetLocation(
    id: number,
    name: string,
    type: PlanetLocationType,
    coordinates: string | null,
    description: string | null,
  ): Observable<ApiPlanetLocation> {
    return this.http
      .put<PlanetLocationDto>(`${CATALOG_API_BASE}/planet-locations/${id}`, {
        name,
        type: planetLocationTypeToApiCode(type),
        coordinates,
        description,
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the planet location. Please try again.',
            'updatePlanetLocation',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        map(mapPlanetLocation),
        tap(() => this.invalidatePlanetLocations()),
      );
  }

  /**
   * Deletes a planet location by id.
   * @param id - The location identifier.
   */
  deletePlanetLocation(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/planet-locations/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the planet location. Please try again.',
          'deletePlanetLocation',
          CatalogErrorCode.EntityInUse,
          this.logger,
        ),
      ),
      tap(() => this.invalidatePlanetLocations()),
    );
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /** Invalidates every per-planet location cache (owner id unknown). */
  private invalidateLocationCaches(): void {
    for (const cache of this.planetLocationCaches.values()) {
      cache.invalidate();
    }
  }

  /** Invalidates one planet's location cache (and the embedded planet refs). */
  private invalidatePlanetLocationCache(planetId: number): void {
    this.planetLocationCaches.get(planetId)?.invalidate();
    this.planetsCache.invalidate();
  }

  /** Fetches every system, then merges their planet lists into one. */
  private fetchAllPlanets(): Observable<readonly ApiPlanet[]> {
    return this.http.get<readonly PlanetSystemDto[]>(`${CATALOG_API_BASE}/planet-systems`).pipe(
      switchMap((systems) => {
        if (systems.length === 0) {
          return of([] as readonly ApiPlanet[]);
        }
        return forkJoin(
          systems.map((system) =>
            this.http
              .get<readonly PlanetDto[]>(`${CATALOG_API_BASE}/planet-systems/${system.id}/planets`)
              .pipe(map((planets) => planets.map(mapPlanet))),
          ),
        ).pipe(map((chunks) => chunks.flat() as readonly ApiPlanet[]));
      }),
    );
  }
}
