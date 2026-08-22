import { TimelineEventDto } from './timeline-events.dto';
import {
  canonFromApiCode,
  isValidNamedEntityDto,
  isValidSourceMaterialDto,
  isValidSourceMaterialUnitDto,
  isValidTimelineEventDto,
  mapTimelineEvent,
} from './timeline-events.mapper';

function named(id: string, name: string): { id: string; name: string } {
  return { id, name };
}

function eventDto(partial: Partial<TimelineEventDto> = {}): TimelineEventDto {
  return {
    id: 'ev-1',
    title: 'Battle of Yavin',
    description: 'The Death Star is destroyed.',
    canonType: 0,
    year: 0,
    displayDate: '35:3',
    displayDateEnd: null,
    sourceMaterial: { id: 'mat-1', title: 'A New Hope', medium: 0, canonType: 0 },
    sourceMaterialUnit: null,
    characters: [],
    locations: [],
    vehicles: [],
    ...partial,
  };
}

describe('canonFromApiCode', () => {
  it('maps codes to canon label arrays', () => {
    expect(canonFromApiCode(0)).toEqual(['Canon']);
    expect(canonFromApiCode(2)).toEqual(['Canon', 'Legends']);
  });

  it('throws on unknown codes', () => {
    expect(() => canonFromApiCode(99)).toThrow();
  });
});

describe('type guards', () => {
  it('validates named entities strictly', () => {
    expect(isValidNamedEntityDto(named('x', 'Luke'))).toBe(true);
    expect(isValidNamedEntityDto(null)).toBe(false);
    expect(isValidNamedEntityDto({ id: '', name: 'Luke' })).toBe(false);
    expect(isValidNamedEntityDto({ id: 'x', name: '' })).toBe(false);
  });

  it('validates source material DTOs', () => {
    expect(
      isValidSourceMaterialDto({ id: 'm', title: 'T', medium: 0, canonType: 0 }),
    ).toBe(true);
    expect(isValidSourceMaterialDto(null)).toBe(false);
    expect(isValidSourceMaterialDto({ id: 'm', title: 'T' })).toBe(false);
    expect(isValidSourceMaterialDto({ id: 'm', title: 'T', medium: 'Movie', canonType: 0 })).toBe(
      false,
    );
  });

  it('validates source material unit DTOs', () => {
    expect(isValidSourceMaterialUnitDto({ id: 'u', unitType: 0, number: 1 })).toBe(true);
    expect(isValidSourceMaterialUnitDto(null)).toBe(false);
    expect(isValidSourceMaterialUnitDto({ id: '', unitType: 0, number: 1 })).toBe(false);
  });

  it('accepts a null unit but rejects missing entity arrays', () => {
    expect(isValidTimelineEventDto(eventDto())).toBe(true);
    expect(isValidTimelineEventDto(eventDto({ characters: undefined as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ locations: {} as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ vehicles: undefined as never }))).toBe(false);
  });
});

describe('mapTimelineEvent', () => {
  it('maps codes and nested sources into the domain shape', () => {
    const mapped = mapTimelineEvent(
      eventDto({
        canonType: 2,
        sourceMaterial: { id: 'mat-9', title: 'Heir to the Empire', medium: 1, canonType: 1 },
        sourceMaterialUnit: {
          id: 'u5',
          unitType: 4,
          groupNumber: 2,
          number: 7,
          title: 'Crazy Like a Wookiee',
        },
      }),
    );

    expect(mapped.canon).toEqual(['Canon', 'Legends']);
    expect(mapped.source).toMatchObject({
      title: 'Heir to the Empire',
      sourceId: 'mat-9',
    });
    expect(mapped.source.unit).toEqual({
      id: 'u5',
      unitType: 'Volume',
      groupNumber: 2,
      number: 7,
      title: 'Crazy Like a Wookiee',
    });
  });

  it('omits the unit when the event has no source material unit', () => {
    const mapped = mapTimelineEvent(eventDto());

    expect(mapped.source.unit).toBeUndefined();
    expect(mapped.displayDateEnd).toBeUndefined();
  });

  it('discards malformed entities while mapping names', () => {
    const mapped = mapTimelineEvent({
      ...eventDto(),
      characters: [named('c1', 'Luke'), null],
      locations: [named('l1', 'Yavin 4'), { broken: true }],
      vehicles: [named('v1', 'X-wing')],
    } as TimelineEventDto);

    expect(mapped.characters).toEqual(['Luke']);
    expect(mapped.locations).toEqual(['Yavin 4']);
    expect(mapped.vehicles).toEqual(['X-wing']);
  });
});
