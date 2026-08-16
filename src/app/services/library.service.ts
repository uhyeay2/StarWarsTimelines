import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, mergeMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LibraryItem } from '../models/library-item';
import { Medium, mediumFromApiCode } from '../models/medium';
import { statusFromApiCode, statusToApiCode, TrackingStatus } from '../models/tracking-status';
import { unitTypeFromApiCode } from '../models/unit-type';

export interface CatalogMaterial {
  id: string;
  title: string;
  medium: Medium;
}

interface LibraryUnitDto {
  id: string;
  unitType: number;
  number: number;
  title: string | null;
  isCompleted: boolean;
}

interface LibraryItemDto {
  sourceMaterialId: string;
  title: string;
  medium: number;
  canonType: number;
  status: number;
  isFavorite: boolean;
  units: readonly LibraryUnitDto[];
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  constructor(private readonly http: HttpClient) {}

  private urlFor(userId: string): string {
    return `${environment.apiBaseUrl}/api/users/${userId}/source-materials`;
  }

  private mapItem(dto: LibraryItemDto): LibraryItem {
    return {
      id: dto.sourceMaterialId,
      title: dto.title,
      medium: mediumFromApiCode(dto.medium),
      status: statusFromApiCode(dto.status),
      favorite: dto.isFavorite,
      units: dto.units.map((unit) => ({
        id: unit.id,
        unitType: unitTypeFromApiCode(unit.unitType),
        number: unit.number,
        title: unit.title ?? undefined,
        isCompleted: unit.isCompleted,
      })),
    };
  }

  private getLibrary(userId: string): Observable<readonly LibraryItem[]> {
    return this.http
      .get<readonly LibraryItemDto[]>(this.urlFor(userId))
      .pipe(map((items) => items.map((item) => this.mapItem(item))));
  }

  getTracked(userId: string): Observable<readonly LibraryItem[]> {
    return this.getLibrary(userId);
  }

  addTracked(userId: string, material: CatalogMaterial): Observable<readonly LibraryItem[]> {
    return this.http
      .post(this.urlFor(userId), { sourceMaterialId: material.id })
      .pipe(mergeMap(() => this.getLibrary(userId)));
  }

  setStatus(
    userId: string,
    materialId: string,
    status: TrackingStatus,
  ): Observable<readonly LibraryItem[]> {
    return this.http
      .put<void>(`${this.urlFor(userId)}/${materialId}`, { status: statusToApiCode(status) })
      .pipe(mergeMap(() => this.getLibrary(userId)));
  }

  setFavorite(
    userId: string,
    materialId: string,
    favorite: boolean,
  ): Observable<readonly LibraryItem[]> {
    return this.http
      .put<void>(`${this.urlFor(userId)}/${materialId}`, { isFavorite: favorite })
      .pipe(mergeMap(() => this.getLibrary(userId)));
  }

  removeTracked(userId: string, materialId: string): Observable<readonly LibraryItem[]> {
    return this.http
      .delete<void>(`${this.urlFor(userId)}/${materialId}`)
      .pipe(mergeMap(() => this.getLibrary(userId)));
  }

  setUnitProgress(
    userId: string,
    materialId: string,
    unitId: string,
    isCompleted: boolean,
  ): Observable<readonly LibraryItem[]> {
    return this.http
      .put<void>(`${this.urlFor(userId)}/${materialId}/units/${unitId}`, { isCompleted })
      .pipe(mergeMap(() => this.getLibrary(userId)));
  }

  reorderTrackedItem(
    userId: string,
    orderedSourceMaterialIds: readonly string[],
  ): Observable<readonly LibraryItem[]> {
    return this.http
      .put<void>(`${this.urlFor(userId)}/reorder`, {
        orderedSourceMaterialIds: [...orderedSourceMaterialIds],
      })
      .pipe(mergeMap(() => this.getLibrary(userId)));
  }
}
