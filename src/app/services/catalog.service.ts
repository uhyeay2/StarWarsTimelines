/**
 * @fileoverview CRUD service for the catalog entities exposed by the API.
 *
 * Provides typed accessors for characters, locations, vehicles, source
 * materials, and source material units. Enum values returned by the server as
 * numeric codes are mapped to domain-level string unions before they reach
 * consumers.
 *
 * @see {@link NameCatalogAdmin} for the character / location / vehicle admin UI.
 * @see {@link SourceMaterialAdmin} for the source material + unit admin UI.
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiCharacter } from '../models/api-character';
import { ApiLocation } from '../models/api-location';
import { ApiSourceMaterial } from '../models/api-source-material';
import { ApiSourceMaterialUnit } from '../models/api-source-material-unit';
import { ApiVehicle } from '../models/api-vehicle';
import { CanonType, canonTypeFromApiCode, canonTypeToApiCode } from '../models/canon-type';
import { Medium, mediumFromApiCode, mediumToApiCode } from '../models/medium';
import { UnitType, unitTypeFromApiCode, unitTypeToApiCode } from '../models/unit-type';
import { readProblemDetail } from '../utils/problem-detail';
import { SourceMaterialDto, SourceMaterialUnitDto } from './catalog/catalog.dto';

/** Re-export so existing consumers can import from this module. */
export type { CreateSourceMaterialInput } from '../models/catalog/create-source-material-input';
/** Re-export so existing consumers can import from this module. */
export type { CreateSourceMaterialUnitInput } from '../models/catalog/create-source-material-unit-input';

/** Base URL for all catalog API endpoints. */
const BASE = `${environment.apiBaseUrl}/api`;

/**
 * Handles all catalog CRUD operations.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * **Enum mapping:** The server returns numeric codes for `medium`,
 * `canonType`, and `unitType`. This service maps them to domain-level string
 * unions (`Medium`, `CanonType`, `UnitType`) using the helpers in the
 * corresponding model files.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly http: HttpClient) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  /**
   * Fetches all source materials.
   *
   * Numeric `medium` and `canonType` codes are mapped to string unions.
   *
   * @returns An observable of the mapped source materials.
   */
  getSourceMaterials(): Observable<readonly ApiSourceMaterial[]> {
    return this.http
      .get<readonly SourceMaterialDto[]>(`${BASE}/source-materials`)
      .pipe(map((items) => items.map((item) => this.mapSourceMaterial(item))));
  }

  /**
   * Fetches all characters.
   *
   * No mapping is needed — the server returns `{ id, name }` directly.
   *
   * @returns An observable of the characters.
   */
  getCharacters(): Observable<readonly ApiCharacter[]> {
    return this.http.get<readonly ApiCharacter[]>(`${BASE}/characters`);
  }

  /**
   * Fetches all locations.
   *
   * No mapping is needed — the server returns `{ id, name }` directly.
   *
   * @returns An observable of the locations.
   */
  getLocations(): Observable<readonly ApiLocation[]> {
    return this.http.get<readonly ApiLocation[]>(`${BASE}/locations`);
  }

  /**
   * Fetches all vehicles.
   *
   * No mapping is needed — the server returns `{ id, name }` directly.
   *
   * @returns An observable of the vehicles.
   */
  getVehicles(): Observable<readonly ApiVehicle[]> {
    return this.http.get<readonly ApiVehicle[]>(`${BASE}/vehicles`);
  }

  /**
   * Fetches all units belonging to a source material.
   *
   * Numeric `unitType` codes are mapped to string unions.
   *
   * @param sourceMaterialId  The ID of the parent source material.
   * @returns An observable of the mapped units.
   */
  getSourceMaterialUnits(sourceMaterialId: string): Observable<readonly ApiSourceMaterialUnit[]> {
    return this.http
      .get<readonly SourceMaterialUnitDto[]>(
        `${BASE}/source-materials/${sourceMaterialId}/units`,
      )
      .pipe(map((items) => items.map((item) => this.mapUnit(item))));
  }

  // ─── Characters ──────────────────────────────────────────────────────────

  /**
   * Creates a new character.
   *
   * @param name  The character's display name.
   * @returns An observable of the created character.
   */
  createCharacter(name: string): Observable<ApiCharacter> {
    return this.http
      .post<ApiCharacter>(`${BASE}/characters`, { name })
      .pipe(catchError(this.handleError('Unable to create the character. Please try again.')));
  }

  /**
   * Updates an existing character's name.
   *
   * @param id    The ID of the character to update.
   * @param name  The new display name.
   * @returns An observable of the updated character.
   */
  updateCharacter(id: string, name: string): Observable<ApiCharacter> {
    return this.http
      .put<ApiCharacter>(`${BASE}/characters/${id}`, { name })
      .pipe(catchError(this.handleError('Unable to update the character. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to delete the character. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to create the location. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to update the location. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to delete the location. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to create the vehicle. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to update the vehicle. Please try again.')));
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
      .pipe(catchError(this.handleError('Unable to delete the vehicle. Please try again.')));
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
  createSourceMaterial(input: {
    title: string;
    medium: Medium;
    canonType: CanonType;
  }): Observable<ApiSourceMaterial> {
    return this.http
      .post<SourceMaterialDto>(`${BASE}/source-materials`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError(this.handleError('Unable to create the source material. Please try again.')),
        map((item) => this.mapSourceMaterial(item)),
      );
  }

  /**
   * Updates an existing source material.
   *
   * @param id     The ID of the source material to update.
   * @param input  The updated payload.
   * @returns An observable of the updated source material (with mapped enums).
   */
  updateSourceMaterial(
    id: string,
    input: {
      title: string;
      medium: Medium;
      canonType: CanonType;
    },
  ): Observable<ApiSourceMaterial> {
    return this.http
      .put<SourceMaterialDto>(`${BASE}/source-materials/${id}`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError(this.handleError('Unable to update the source material. Please try again.')),
        map((item) => this.mapSourceMaterial(item)),
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
        catchError(this.handleError('Unable to delete the source material. Please try again.')),
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
    input: {
      unitType: UnitType;
      groupNumber: number | null;
      number: number;
      title: string | null;
    },
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
        catchError(this.handleError('Unable to create the unit. Please try again.')),
        map((item) => this.mapUnit(item)),
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
    input: {
      unitType: UnitType;
      groupNumber: number | null;
      number: number;
      title: string | null;
    },
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
        catchError(this.handleError('Unable to update the unit. Please try again.')),
        map((item) => this.mapUnit(item)),
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
      .pipe(catchError(this.handleError('Unable to delete the unit. Please try again.')));
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Returns a `catchError` callback that extracts the server-provided error
   * message from the {@link https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.problemdetails|ProblemDetails}
   * body and re-throws it as an `Error`.
   *
   * @param fallback  A human-readable default when the server does not provide one.
   * @returns A function suitable for `catchError(...)`.
   */
  private handleError(fallback: string): (error: HttpErrorResponse) => Observable<never> {
    return (error: HttpErrorResponse) =>
      throwError(() => new Error(readProblemDetail(error, fallback)));
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
