import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiCharacter } from '../models/api-character';
import { ApiLocation } from '../models/api-location';
import { ApiSourceMaterial } from '../models/api-source-material';
import { ApiVehicle } from '../models/api-vehicle';
import { canonTypeFromApiCode } from '../models/canon-type';
import { mediumFromApiCode } from '../models/medium';

interface SourceMaterialDto {
  id: string;
  title: string;
  medium: number;
  canonType: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly http: HttpClient) {}

  getSourceMaterials(): Observable<readonly ApiSourceMaterial[]> {
    return this.http
      .get<readonly SourceMaterialDto[]>(`${environment.apiBaseUrl}/api/source-materials`)
      .pipe(
        map((items) =>
          items.map((item) => ({
            id: item.id,
            title: item.title,
            medium: mediumFromApiCode(item.medium),
            canonType: canonTypeFromApiCode(item.canonType),
          })),
        ),
      );
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
}
