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

interface SourceMaterialDto {
  id: string;
  title: string;
  medium: number;
  canonType: number;
}

interface SourceMaterialUnitDto {
  id: string;
  sourceMaterialId: string;
  unitType: number;
  groupNumber: number | null;
  number: number;
  title: string | null;
}

export interface CreateSourceMaterialInput {
  title: string;
  medium: Medium;
  canonType: CanonType;
}

export interface CreateSourceMaterialUnitInput {
  unitType: UnitType;
  groupNumber: number | null;
  number: number;
  title: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly http: HttpClient) {}

  getSourceMaterials(): Observable<readonly ApiSourceMaterial[]> {
    return this.http
      .get<readonly SourceMaterialDto[]>(`${environment.apiBaseUrl}/api/source-materials`)
      .pipe(map((items) => items.map((item) => this.mapSourceMaterial(item))));
  }

  getCharacters(): Observable<readonly ApiCharacter[]> {
    return this.http.get<readonly ApiCharacter[]>(`${environment.apiBaseUrl}/api/characters`);
  }

  getLocations(): Observable<readonly ApiLocation[]> {
    return this.http.get<readonly ApiLocation[]>(`${environment.apiBaseUrl}/api/locations`);
  }

  getVehicles(): Observable<readonly ApiVehicle[]> {
    return this.http.get<readonly ApiVehicle[]>(`${environment.apiBaseUrl}/api/vehicles`);
  }

  getSourceMaterialUnits(sourceMaterialId: string): Observable<readonly ApiSourceMaterialUnit[]> {
    return this.http
      .get<readonly SourceMaterialUnitDto[]>(
        `${environment.apiBaseUrl}/api/source-materials/${sourceMaterialId}/units`,
      )
      .pipe(map((items) => items.map((item) => this.mapUnit(item))));
  }

  createCharacter(name: string): Observable<ApiCharacter> {
    return this.http
      .post<ApiCharacter>(`${environment.apiBaseUrl}/api/characters`, { name })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to create the character. Please try again.')),
          ),
        ),
      );
  }

  updateCharacter(id: string, name: string): Observable<ApiCharacter> {
    return this.http
      .put<ApiCharacter>(`${environment.apiBaseUrl}/api/characters/${id}`, { name })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to update the character. Please try again.')),
          ),
        ),
      );
  }

  deleteCharacter(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/api/characters/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to delete the character. Please try again.')),
          ),
        ),
        map(() => undefined),
      );
  }

  createLocation(name: string): Observable<ApiLocation> {
    return this.http
      .post<ApiLocation>(`${environment.apiBaseUrl}/api/locations`, { name })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to create the location. Please try again.')),
          ),
        ),
      );
  }

  updateLocation(id: string, name: string): Observable<ApiLocation> {
    return this.http
      .put<ApiLocation>(`${environment.apiBaseUrl}/api/locations/${id}`, { name })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to update the location. Please try again.')),
          ),
        ),
      );
  }

  deleteLocation(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/api/locations/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to delete the location. Please try again.')),
          ),
        ),
        map(() => undefined),
      );
  }

  createVehicle(name: string): Observable<ApiVehicle> {
    return this.http
      .post<ApiVehicle>(`${environment.apiBaseUrl}/api/vehicles`, { name })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to create the vehicle. Please try again.')),
          ),
        ),
      );
  }

  updateVehicle(id: string, name: string): Observable<ApiVehicle> {
    return this.http
      .put<ApiVehicle>(`${environment.apiBaseUrl}/api/vehicles/${id}`, { name })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to update the vehicle. Please try again.')),
          ),
        ),
      );
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/api/vehicles/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to delete the vehicle. Please try again.')),
          ),
        ),
        map(() => undefined),
      );
  }

  createSourceMaterial(input: CreateSourceMaterialInput): Observable<ApiSourceMaterial> {
    return this.http
      .post<SourceMaterialDto>(`${environment.apiBaseUrl}/api/source-materials`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to create the source material. Please try again.')),
          ),
        ),
        map((item) => this.mapSourceMaterial(item)),
      );
  }

  updateSourceMaterial(
    id: string,
    input: CreateSourceMaterialInput,
  ): Observable<ApiSourceMaterial> {
    return this.http
      .put<SourceMaterialDto>(`${environment.apiBaseUrl}/api/source-materials/${id}`, {
        title: input.title,
        medium: mediumToApiCode(input.medium),
        canonType: canonTypeToApiCode(input.canonType),
      })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to update the source material. Please try again.')),
          ),
        ),
        map((item) => this.mapSourceMaterial(item)),
      );
  }

  deleteSourceMaterial(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/api/source-materials/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(
                readProblemDetail(error, 'Unable to delete the source material. Please try again.'),
              ),
          ),
        ),
        map(() => undefined),
      );
  }

  createSourceMaterialUnit(
    sourceMaterialId: string,
    input: CreateSourceMaterialUnitInput,
  ): Observable<ApiSourceMaterialUnit> {
    return this.http
      .post<SourceMaterialUnitDto>(`${environment.apiBaseUrl}/api/source-materials/${sourceMaterialId}/units`, {
        unitType: unitTypeToApiCode(input.unitType),
        groupNumber: input.groupNumber,
        number: input.number,
        title: input.title,
      })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to create the unit. Please try again.')),
          ),
        ),
        map((item) => this.mapUnit(item)),
      );
  }

  updateSourceMaterialUnit(
    sourceMaterialId: string,
    unitId: string,
    input: CreateSourceMaterialUnitInput,
  ): Observable<ApiSourceMaterialUnit> {
    return this.http
      .put<SourceMaterialUnitDto>(
        `${environment.apiBaseUrl}/api/source-materials/${sourceMaterialId}/units/${unitId}`,
        {
          unitType: unitTypeToApiCode(input.unitType),
          groupNumber: input.groupNumber,
          number: input.number,
          title: input.title,
        },
      )
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to update the unit. Please try again.')),
          ),
        ),
        map((item) => this.mapUnit(item)),
      );
  }

  deleteSourceMaterialUnit(sourceMaterialId: string, unitId: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/api/source-materials/${sourceMaterialId}/units/${unitId}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          throwError(
            () =>
              new Error(readProblemDetail(error, 'Unable to delete the unit. Please try again.')),
          ),
        ),
        map(() => undefined),
      );
  }

  private mapSourceMaterial(item: SourceMaterialDto): ApiSourceMaterial {
    return {
      id: item.id,
      title: item.title,
      medium: mediumFromApiCode(item.medium),
      canonType: canonTypeFromApiCode(item.canonType),
    };
  }

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
