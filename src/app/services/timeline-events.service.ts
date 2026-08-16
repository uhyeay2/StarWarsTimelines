import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Canon } from '../models/canon';
import { mediumFromApiCode } from '../models/medium';
import { TimelineEvent } from '../models/timeline-event';
import { unitTypeFromApiCode } from '../models/unit-type';

interface SourceMaterialUnitDto {
  id: string;
  unitType: number;
  groupNumber: number | null;
  number: number;
  title: string | null;
}

interface SourceMaterialDto {
  id: string;
  title: string;
  medium: number;
  canonType: number;
}

interface NamedEntityDto {
  id: string;
  name: string;
}

interface TimelineEventDto {
  id: string;
  title: string;
  description: string;
  canonType: number;
  year: number;
  displayDate: string;
  displayDateEnd: string | null;
  sourceMaterial: SourceMaterialDto;
  sourceMaterialUnit: SourceMaterialUnitDto | null;
  characters: readonly NamedEntityDto[];
  locations: readonly NamedEntityDto[];
  vehicles: readonly NamedEntityDto[];
}

const CANON_BY_CODE: readonly Canon[][] = [['Canon'], ['Legends'], ['Canon', 'Legends']];

function canonFromApiCode(code: number): readonly Canon[] {
  const canon = CANON_BY_CODE[code];
  if (!canon) {
    throw new Error(`Unknown canon type code: ${code}`);
  }
  return canon;
}

@Injectable({ providedIn: 'root' })
export class TimelineEventsService {
  constructor(private readonly http: HttpClient) {}

  getEvents(): Observable<readonly TimelineEvent[]> {
    return this.http
      .get<readonly TimelineEventDto[]>(`${environment.apiBaseUrl}/api/source-material-events`)
      .pipe(
        map((events) =>
          events.map((event) => ({
            id: event.id,
            canon: canonFromApiCode(event.canonType),
            title: event.title,
            description: event.description,
            source: {
              title: event.sourceMaterial.title,
              medium: mediumFromApiCode(event.sourceMaterial.medium),
              sourceId: event.sourceMaterial.id,
              unit: event.sourceMaterialUnit
                ? {
                    unitType: unitTypeFromApiCode(event.sourceMaterialUnit.unitType),
                    groupNumber: event.sourceMaterialUnit.groupNumber ?? undefined,
                    number: event.sourceMaterialUnit.number,
                    title: event.sourceMaterialUnit.title ?? undefined,
                  }
                : undefined,
            },
            locations: event.locations.map((entity) => entity.name),
            characters: event.characters.map((entity) => entity.name),
            vehicles: event.vehicles.map((entity) => entity.name),
            year: event.year,
            displayDate: event.displayDate,
            displayDateEnd: event.displayDateEnd ?? undefined,
          })),
        ),
      );
  }
}
