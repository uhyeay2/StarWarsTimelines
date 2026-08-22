/**
 * @fileoverview CRUD service for the catalog entities exposed by the API.
 *
 * Provides signal-based state for characters, locations, vehicles, species,
 * source materials, and source material units. Enum values returned by the
 * server as numeric codes are mapped to domain-level string unions before
 * they reach consumers.
 *
 * Mutations auto-invalidate the relevant cache. SSE-driven invalidation is
 * handled via {@link invalidateEntity} and {@link invalidateAll}.
 *
 * @see {@link NameCatalogAdmin} for the character / location / vehicle admin UI.
 * @see {@link SourceMaterialAdmin} for the source material + unit admin UI.
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCharacter } from '../../models/api-character';
import { ApiLocation } from '../../models/api-location';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
import { ApiSpecies } from '../../models/api-species';
import { ApiVehicle } from '../../models/api-vehicle';
import { CanonType, canonTypeFromApiCode, canonTypeToApiCode } from '../../models/canon-type';
import { CatalogError, EntityInUseError } from '../../models/catalog/catalog-error';
import { CreateCharacterInput } from '../../models/catalog/create-character-input';
import { CreateSourceMaterialInput } from '../../models/catalog/create-source-material-input';
import { CreateSourceMaterialUnitInput } from '../../models/catalog/create-source-material-unit-input';
import { Medium, mediumFromApiCode, mediumToApiCode } from '../../models/medium';
import { UnitType, unitTypeFromApiCode, unitTypeToApiCode } from '../../models/unit-type';
import { readProblemDetail } from '../../utils/problem-detail';
import { SignalCache } from '../../utils/signal-cache';
import { SourceMaterialDto, SourceMaterialUnitDto } from './catalog.dto';
import { LoggerService } from '../logging/logger.service';

/** Re-export so existing consumers can import from this module. */
export type { CreateSourceMaterialInput } from '../../models/catalog/create-source-material-input';
/** Re-export so existing consumers can import from this module. */
export type { CreateSourceMaterialUnitInput } from '../../models/catalog/create-source-material-unit-input';

/** Base URL for all catalog API endpoints. */
const BASE = `${environment.apiBaseUrl}/api`;

/** 5-minute TTL for catalog caches (resilience fallback). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Handles all catalog CRUD operations.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * **Enum mapping:** The server returns numeric codes for `medium`,
 * `canonType`, and `unitType`. This service maps them to domain-level string
 * unions (`Medium`, `CanonType`, `UnitType`) using the helpers in the
 * corresponding model files.
 *
 * **Signal-based state:** Each list endpoint is backed by a {@link SignalCache}.
 * Call the corresponding `fetch*()` method to populate or refresh the cache.
 * Mutations auto-invalidate the relevant cache. SSE-driven invalidation is
 * handled via {@link invalidateEntity} and {@link invalidateAll}.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // ─── Signal caches ───────────────────────────────────────────────────────

  private readonly charactersCache = new SignalCache<readonly ApiCharacter[]>(
    () => this.http.get<readonly ApiCharacter[]>(`${BASE}/characters`),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load characters'),
    CACHE_TTL_MS,
  );

  private readonly locationsCache = new SignalCache<readonly ApiLocation[]>(
    () => this.http.get<readonly ApiLocation[]>(`${BASE}/locations`),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load locations'),
    CACHE_TTL_MS,
  );

  private readonly vehiclesCache = new SignalCache<readonly ApiVehicle[]>(
    () => this.http.get<readonly ApiVehicle[]>(`${BASE}/vehicles`),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load vehicles'),
    CACHE_TTL_MS,
  );

  private readonly speciesCache = new SignalCache<readonly ApiSpecies[]>(
    () => this.http.get<readonly ApiSpecies[]>(`${BASE}/species`),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load species'),
    CACHE_TTL_MS,
  );

  private readonly sourceMaterialsCache = new SignalCache<readonly ApiSourceMaterial[]>(
    () =>
      this.http
        .get<readonly SourceMaterialDto[]>(`${BASE}/source-materials`)
        .pipe(map((items) => items.map((item) => this.mapSourceMaterial(item)))),
    (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load source materials'),
    CACHE_TTL_MS,
  );

  /** Per-material unit caches keyed by source material ID. */
  private readonly unitCaches = new Map<string, SignalCache<readonly ApiSourceMaterialUnit[]>>();

  // ─── Public signals ──────────────────────────────────────────────────────

  /** Characters currently loaded in the cache, or `null` if not yet fetched. */
  readonly characters = this.charactersCache.data.asReadonly();
  /** Whether a characters fetch is in flight. */
  readonly charactersLoading = this.charactersCache.loading.asReadonly();
  /** Last characters fetch error, or `null`. */
  readonly charactersError = this.charactersCache.error.asReadonly();

  /** Locations currently loaded in the cache, or `null` if not yet fetched. */
  readonly locations = this.locationsCache.data.asReadonly();
  /** Whether a locations fetch is in flight. */
  readonly locationsLoading = this.locationsCache.loading.asReadonly();
  /** Last locations fetch error, or `null`. */
  readonly locationsError = this.locationsCache.error.asReadonly();

  /** Vehicles currently loaded in the cache, or `null` if not yet fetched. */
  readonly vehicles = this.vehiclesCache.data.asReadonly();
  /** Whether a vehicles fetch is in flight. */
  readonly vehiclesLoading = this.vehiclesCache.loading.asReadonly();
  /** Last vehicles fetch error, or `null`. */
  readonly vehiclesError = this.vehiclesCache.error.asReadonly();

  /** Species currently loaded in the cache, or `null` if not yet fetched. */
  readonly species = this.speciesCache.data.asReadonly();
  /** Whether a species fetch is in flight. */
  readonly speciesLoading = this.speciesCache.loading.asReadonly();
  /** Last species fetch error, or `null`. */
  readonly speciesError = this.speciesCache.error.asReadonly();

  /** Source materials currently loaded in the cache, or `null` if not yet fetched. */
  readonly sourceMaterials = this.sourceMaterialsCache.data.asReadonly();
  /** Whether a source materials fetch is in flight. */
  readonly sourceMaterialsLoading = this.sourceMaterialsCache.loading.asReadonly();
  /** Last source materials fetch error, or `null`. */
  readonly sourceMaterialsError = this.sourceMaterialsCache.error.asReadonly();

  // ─── Fetch methods (populate / refresh caches) ───────────────────────────

  /**
   * Fetches all characters and stores them in the signal cache.
   *
   * No-op if a fetch is already in flight.
   */
  fetchCharacters(): void {
    this.charactersCache.fetch();
  }

  /**
   * Fetches all locations and stores them in the signal cache.
   *
   * No-op if a fetch is already in flight.
   */
  fetchLocations(): void {
    this.locationsCache.fetch();
  }

  /**
   * Fetches all vehicles and stores them in the signal cache.
   *
   * No-op if a fetch is already in flight.
   */
  fetchVehicles(): void {
    this.vehiclesCache.fetch();
  }

  /**
   * Fetches all species and stores them in the signal cache.
   *
   * No-op if a fetch is already in flight.
   */
  fetchSpecies(): void {
    this.speciesCache.fetch();
  }

  /**
   * Fetches all source materials and stores them in the signal cache.
   *
   * Numeric `medium` and `canonType` codes are mapped to string unions.
   * No-op if a fetch is already in flight.
   */
  fetchSourceMaterials(): void {
    this.sourceMaterialsCache.fetch();
  }

  /**
   * Probes all source materials to discover which have units.
   *
   * Fetches unit caches for every material in parallel. Call
   * {@link checkProbeResults} after flushing the HTTP requests to
   * synchronously read the results.
   */
  probeUnitPresence(): void {
    const materials = this.sourceMaterialsCache.data();
    if (!materials || materials.length === 0) {
      return;
    }

    for (const m of materials) {
      this.getUnitCache(m.id).fetch();
    }
  }

  /**
   * Synchronously checks whether all probe fetches have completed.
   *
   * @returns A `Set` of material IDs that have units, or `null` if any
   *          probe is still loading.
   */
  checkProbeResults(): Set<string> | null {
    const materials = this.sourceMaterialsCache.data();
    if (!materials || materials.length === 0) {
      return new Set<string>();
    }

    if (materials.some((m) => this.getUnitCache(m.id).loading())) {
      return null;
    }

    const withUnits = new Set<string>();
    for (const m of materials) {
      const units = this.getUnitCache(m.id).data();
      if (units && units.length > 0) {
        withUnits.add(m.id);
      }
    }
    return withUnits;
  }

  /**
   * Returns the signal cache for units of a specific source material.
   * Creates the cache on first access.
   */
  getUnitCache(sourceMaterialId: string): SignalCache<readonly ApiSourceMaterialUnit[]> {
    let cache = this.unitCaches.get(sourceMaterialId);
    if (!cache) {
      cache = new SignalCache<readonly ApiSourceMaterialUnit[]>(
        () =>
          this.http
            .get<readonly SourceMaterialUnitDto[]>(
              `${BASE}/source-materials/${sourceMaterialId}/units`,
            )
            .pipe(map((items) => items.map((item) => this.mapUnit(item)))),
        (err) => readProblemDetail(err as HttpErrorResponse, 'Failed to load units'),
        CACHE_TTL_MS,
      );
      this.unitCaches.set(sourceMaterialId, cache);
    }
    return cache;
  }

  // ─── Invalidation (SSE-driven or manual) ─────────────────────────────────

  /**
   * Invalidates caches affected by a change to the given entity type.
   *
   * When an `id` is provided, only the specific affected cache is invalidated
   * rather than the entire collection:
   * - `'source-material-units'` with a unit ID: scans loaded unit caches to
   *   find and invalidate only the cache that contains that unit.
   * - `'source-materials'` with a material ID: invalidates that material's
   *   unit cache (if loaded) in addition to the source materials collection.
   *
   * @param entity  The entity type string from the SSE event
   *                (e.g. `'characters'`, `'source-materials'`).
   * @param id      The ID of the specific entity that changed, when available.
   */
  invalidateEntity(entity: string, id?: string): void {
    switch (entity) {
      case 'characters':
        this.charactersCache.invalidate();
        break;
      case 'locations':
        this.locationsCache.invalidate();
        break;
      case 'vehicles':
        this.vehiclesCache.invalidate();
        break;
      case 'species':
        this.speciesCache.invalidate();
        break;
      case 'source-materials':
        this.sourceMaterialsCache.invalidate();
        if (id) {
          this.unitCaches.get(id)?.invalidate();
        }
        break;
      case 'source-material-units':
        if (id) {
          this.invalidateUnitById(id);
        } else {
          for (const cache of this.unitCaches.values()) {
            cache.invalidate();
          }
        }
        break;
    }
  }

  /**
   * Finds the unit cache that contains the given unit ID and invalidates it.
   *
   * When the unit isn't found in any loaded cache, no action is taken (the
   * data hasn't been fetched yet, so there's nothing to invalidate).
   */
  private invalidateUnitById(unitId: string): void {
    for (const [materialId, cache] of this.unitCaches) {
      const units = cache.data();
      if (units?.some((u) => u.id === unitId)) {
        cache.invalidate();
        return;
      }
    }
  }

  /**
   * Invalidates all caches. Useful for full refresh scenarios.
   */
  invalidateAll(): void {
    this.charactersCache.invalidate();
    this.locationsCache.invalidate();
    this.vehiclesCache.invalidate();
    this.speciesCache.invalidate();
    this.sourceMaterialsCache.invalidate();
    for (const cache of this.unitCaches.values()) {
      cache.invalidate();
    }
  }

  // ─── Characters ──────────────────────────────────────────────────────────

  /**
   * Creates a new character.
   *
   * @param input  The character payload, including optional biography fields.
   * @returns An observable of the created character.
   */
  createCharacter(input: CreateCharacterInput): Observable<ApiCharacter> {
    return this.http
      .post<ApiCharacter>(`${BASE}/characters`, {
        name: input.name,
        planetBornOnId: input.planetBornOnId ?? null,
        yearOfBirthEarliest: input.yearOfBirthEarliest ?? null,
        yearOfBirthLatest: input.yearOfBirthLatest ?? null,
        yearOfDeathEarliest: input.yearOfDeathEarliest ?? null,
        yearOfDeathLatest: input.yearOfDeathLatest ?? null,
        speciesId: input.speciesId ?? null,
      })
      .pipe(
        catchError(this.handleError('Unable to create the character. Please try again.', 'createCharacter')),
        tap(() => this.charactersCache.invalidate()),
      );
  }

  /**
   * Updates an existing character.
   *
   * The request replaces the character's data, so a `null` biography field
   * clears the stored value back to unknown. All fields are always sent.
   *
   * @param id     The ID of the character to update.
   * @param input  The updated payload.
   * @returns An observable of the updated character.
   */
  updateCharacter(id: string, input: CreateCharacterInput): Observable<ApiCharacter> {
    return this.http
      .put<ApiCharacter>(`${BASE}/characters/${id}`, {
        name: input.name,
        planetBornOnId: input.planetBornOnId ?? null,
        yearOfBirthEarliest: input.yearOfBirthEarliest ?? null,
        yearOfBirthLatest: input.yearOfBirthLatest ?? null,
        yearOfDeathEarliest: input.yearOfDeathEarliest ?? null,
        yearOfDeathLatest: input.yearOfDeathLatest ?? null,
        speciesId: input.speciesId ?? null,
      })
      .pipe(
        catchError(this.handleError('Unable to update the character. Please try again.', 'updateCharacter')),
        tap(() => this.charactersCache.invalidate()),
      );
  }

  /**
   * Deletes a character.
   *
   * The server returns `409 Conflict` when the character is referenced by one
   * or more timeline events.
   *
   * @param id  The ID of the character to delete.
   * @returns An observable that completes when the character has been deleted.
   */
  deleteCharacter(id: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/characters/${id}`)
      .pipe(
        catchError(this.handleError('Unable to delete the character. Please try again.', 'deleteCharacter')),
        tap(() => this.charactersCache.invalidate()),
      );
  }

  // ─── Locations ───────────────────────────────────────────────────────────

  /**
   * Creates a new location.
   *
   * @param name  The location's display name.
   * @returns An observable of the created location.
   */
  createLocation(name: string): Observable<ApiLocation> {
    return this.http
      .post<ApiLocation>(`${BASE}/locations`, { name })
      .pipe(
        catchError(this.handleError('Unable to create the location. Please try again.', 'createLocation')),
        tap(() => this.locationsCache.invalidate()),
      );
  }

  /**
   * Updates an existing location's name.
   *
   * @param id    The ID of the location to update.
   * @param name  The new display name.
   * @returns An observable of the updated location.
   */
  updateLocation(id: string, name: string): Observable<ApiLocation> {
    return this.http
      .put<ApiLocation>(`${BASE}/locations/${id}`, { name })
      .pipe(
        catchError(this.handleError('Unable to update the location. Please try again.', 'updateLocation')),
        tap(() => this.locationsCache.invalidate()),
      );
  }

  /**
   * Deletes a location.
   *
   * The server returns `409 Conflict` when the location is referenced by one
   * or more timeline events.
   *
   * @param id  The ID of the location to delete.
   * @returns An observable that completes when the location has been deleted.
   */
  deleteLocation(id: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/locations/${id}`)
      .pipe(
        catchError(this.handleError('Unable to delete the location. Please try again.', 'deleteLocation')),
        tap(() => this.locationsCache.invalidate()),
      );
  }

  // ─── Vehicles ────────────────────────────────────────────────────────────

  /**
   * Creates a new vehicle.
   *
   * @param name  The vehicle's display name.
   * @returns An observable of the created vehicle.
   */
  createVehicle(name: string): Observable<ApiVehicle> {
    return this.http
      .post<ApiVehicle>(`${BASE}/vehicles`, { name })
      .pipe(
        catchError(this.handleError('Unable to create the vehicle. Please try again.', 'createVehicle')),
        tap(() => this.vehiclesCache.invalidate()),
      );
  }

  /**
   * Updates an existing vehicle's name.
   *
   * @param id    The ID of the vehicle to update.
   * @param name  The new display name.
   * @returns An observable of the updated vehicle.
   */
  updateVehicle(id: string, name: string): Observable<ApiVehicle> {
    return this.http
      .put<ApiVehicle>(`${BASE}/vehicles/${id}`, { name })
      .pipe(
        catchError(this.handleError('Unable to update the vehicle. Please try again.', 'updateVehicle')),
        tap(() => this.vehiclesCache.invalidate()),
      );
  }

  /**
   * Deletes a vehicle.
   *
   * The server returns `409 Conflict` when the vehicle is referenced by one
   * or more timeline events.
   *
   * @param id  The ID of the vehicle to delete.
   * @returns An observable that completes when the vehicle has been deleted.
   */
  deleteVehicle(id: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/vehicles/${id}`)
      .pipe(
        catchError(this.handleError('Unable to delete the vehicle. Please try again.', 'deleteVehicle')),
        tap(() => this.vehiclesCache.invalidate()),
      );
  }

  // ─── Species ─────────────────────────────────────────────────────────────

  /**
   * Creates a new species.
   *
   * @param name          The species' display name.
   * @param homePlanetId  The optional home planet location ID.
   * @returns An observable of the created species.
   */
  createSpecies(name: string, homePlanetId: string | null): Observable<ApiSpecies> {
    return this.http
      .post<ApiSpecies>(`${BASE}/species`, { name, homePlanetId })
      .pipe(
        catchError(this.handleError('Unable to create the species. Please try again.', 'createSpecies')),
        tap(() => this.speciesCache.invalidate()),
      );
  }

  /**
   * Updates an existing species.
   *
   * The request replaces the species' data, so a `null` `homePlanetId` clears
   * the stored home planet back to unknown.
   *
   * @param id            The ID of the species to update.
   * @param name          The new display name.
   * @param homePlanetId  The new home planet location ID, or `null` for unknown.
   * @returns An observable of the updated species.
   */
  updateSpecies(id: string, name: string, homePlanetId: string | null): Observable<ApiSpecies> {
    return this.http
      .put<ApiSpecies>(`${BASE}/species/${id}`, { name, homePlanetId })
      .pipe(
        catchError(this.handleError('Unable to update the species. Please try again.', 'updateSpecies')),
        tap(() => this.speciesCache.invalidate()),
      );
  }

  /**
   * Deletes a species.
   *
   * Deletion always succeeds: characters referencing the species remain in
   * the catalog with their species attribute cleared (the server sets the
   * foreign key to `NULL`). The same applies when deleting a location that
   * is a species' home planet.
   *
   * @param id  The ID of the species to delete.
   * @returns An observable that completes when the species has been deleted.
   */
  deleteSpecies(id: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/species/${id}`)
      .pipe(
        catchError(this.handleError('Unable to delete the species. Please try again.', 'deleteSpecies')),
        tap(() => this.speciesCache.invalidate()),
      );
  }

  // ─── Source materials ────────────────────────────────────────────────────

  /**
   * Creates a new source material.
   *
   * The domain-level `Medium` and `CanonType` strings are mapped to numeric
   * codes before the request is sent.
   *
   * @param input  The source material payload.
   * @returns An observable of the created source material (with mapped enums).
   */
  createSourceMaterial(input: CreateSourceMaterialInput): Observable<ApiSourceMaterial> {
    return this.http
      .post<SourceMaterialDto>(`${BASE}/source-materials`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError(this.handleError('Unable to create the source material. Please try again.', 'createSourceMaterial')),
        map((item) => this.mapSourceMaterial(item)),
        tap(() => this.sourceMaterialsCache.invalidate()),
      );
  }

  /**
   * Updates an existing source material.
   *
   * @param id     The ID of the source material to update.
   * @param input  The updated payload.
   * @returns An observable of the updated source material (with mapped enums).
   */
  updateSourceMaterial(id: string, input: CreateSourceMaterialInput): Observable<ApiSourceMaterial> {
    return this.http
      .put<SourceMaterialDto>(`${BASE}/source-materials/${id}`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError(this.handleError('Unable to update the source material. Please try again.', 'updateSourceMaterial')),
        map((item) => this.mapSourceMaterial(item)),
        tap(() => this.sourceMaterialsCache.invalidate()),
      );
  }

  /**
   * Deletes a source material.
   *
   * The server returns `409 Conflict` when the source material is linked to
   * one or more timeline events.
   *
   * @param id  The ID of the source material to delete.
   * @returns An observable that completes when the source material has been deleted.
   */
  deleteSourceMaterial(id: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/source-materials/${id}`)
      .pipe(
        catchError(this.handleError('Unable to delete the source material. Please try again.', 'deleteSourceMaterial')),
        tap(() => {
          this.sourceMaterialsCache.invalidate();
          this.unitCaches.get(id)?.invalidate();
        }),
      );
  }

  // ─── Source material units ───────────────────────────────────────────────

  /**
   * Creates a new unit within a source material.
   *
   * The domain-level `UnitType` string is mapped to a numeric code before
   * the request is sent.
   *
   * @param sourceMaterialId  The ID of the parent source material.
   * @param input             The unit payload.
   * @returns An observable of the created unit (with mapped enum).
   */
  createSourceMaterialUnit(
    sourceMaterialId: string,
    input: CreateSourceMaterialUnitInput,
  ): Observable<ApiSourceMaterialUnit> {
    return this.http
      .post<SourceMaterialUnitDto>(
        `${BASE}/source-materials/${sourceMaterialId}/units`,
        {
          unitType: unitTypeToApiCode(input.unitType),
          groupNumber: input.groupNumber,
          number: input.number,
          title: input.title,
        },
      )
      .pipe(
        catchError(this.handleError('Unable to create the unit. Please try again.', 'createSourceMaterialUnit')),
        map((item) => this.mapUnit(item)),
        tap(() => this.unitCaches.get(sourceMaterialId)?.invalidate()),
      );
  }

  /**
   * Updates an existing unit within a source material.
   *
   * @param sourceMaterialId  The ID of the parent source material.
   * @param unitId            The ID of the unit to update.
   * @param input             The updated payload.
   * @returns An observable of the updated unit (with mapped enum).
   */
  updateSourceMaterialUnit(
    sourceMaterialId: string,
    unitId: string,
    input: CreateSourceMaterialUnitInput,
  ): Observable<ApiSourceMaterialUnit> {
    return this.http
      .put<SourceMaterialUnitDto>(
        `${BASE}/source-materials/${sourceMaterialId}/units/${unitId}`,
        {
          unitType: unitTypeToApiCode(input.unitType),
          groupNumber: input.groupNumber,
          number: input.number,
          title: input.title,
        },
      )
      .pipe(
        catchError(this.handleError('Unable to update the unit. Please try again.', 'updateSourceMaterialUnit')),
        map((item) => this.mapUnit(item)),
        tap(() => this.unitCaches.get(sourceMaterialId)?.invalidate()),
      );
  }

  /**
   * Deletes a unit from a source material.
   *
   * @param sourceMaterialId  The ID of the parent source material.
   * @param unitId            The ID of the unit to delete.
   * @returns An observable that completes when the unit has been deleted.
   */
  deleteSourceMaterialUnit(sourceMaterialId: string, unitId: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/source-materials/${sourceMaterialId}/units/${unitId}`)
      .pipe(
        catchError(this.handleError('Unable to delete the unit. Please try again.', 'deleteSourceMaterialUnit')),
        tap(() => this.unitCaches.get(sourceMaterialId)?.invalidate()),
      );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Returns a `catchError` callback that extracts the server-provided error
   * message from the
   * {@link https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.problemdetails|ProblemDetails}
   * body, logs it, and re-throws as a typed catalog error.
   *
   * - **409 Conflict** → {@link EntityInUseError} (entity referenced by timeline events).
   * - **404 Not Found** → {@link CatalogError} with code `'not-found'`.
   * - **Other** → {@link CatalogError} with code `'network-error'`.
   *
   * @param fallback  A human-readable default when the server does not provide one.
   * @param context   A short label for log context (e.g. `'createCharacter'`).
   * @returns A function suitable for `catchError(...)`.
   */
  private handleError(
    fallback: string,
    context: string,
  ): (error: HttpErrorResponse) => Observable<never> {
    return (error: HttpErrorResponse) => {
      const detail = readProblemDetail(error, fallback);

      if (error.status === 409) {
        this.logger.warn(`[CatalogService] ${context}: ${detail}`, { error });
        return throwError(() => new EntityInUseError(detail));
      }

      if (error.status === 404) {
        this.logger.warn(`[CatalogService] ${context}: ${detail}`, { error });
        return throwError(() => new CatalogError(detail, 'not-found'));
      }

      this.logger.error(`[CatalogService] ${context}: ${detail}`, { error });
      return throwError(() => new CatalogError(detail, 'network-error'));
    };
  }

  /**
   * Maps a {@link SourceMaterialDto} from the server to a domain-level
   * {@link ApiSourceMaterial}.
   *
   * @param item  The raw DTO with numeric enum codes.
   * @returns The mapped source material with string-union enums.
   */
  private mapSourceMaterial(item: SourceMaterialDto): ApiSourceMaterial {
    return {
      id: item.id,
      title: item.title,
      medium: mediumFromApiCode(item.medium),
      canonType: canonTypeFromApiCode(item.canonType),
    };
  }

  /**
   * Maps a {@link SourceMaterialUnitDto} from the server to a domain-level
   * {@link ApiSourceMaterialUnit}.
   *
   * @param item  The raw DTO with a numeric unit-type code.
   * @returns The mapped unit with a string-union `unitType`.
   */
  private mapUnit(item: SourceMaterialUnitDto): ApiSourceMaterialUnit {
    return {
      id: item.id,
      sourceMaterialId: item.sourceMaterialId,
      unitType: unitTypeFromApiCode(item.unitType),
      groupNumber: item.groupNumber,
      number: item.number,
      title: item.title,
    };
  }
}
