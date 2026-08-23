import { TimelineEventDto } from './timeline-events.dto';
import {
  canonFromApiCode,
  isValidNamedEntityDto,
  isValidSourceMaterialDto,
  isValidSourceMaterialLinkDto,
  isValidSourceMaterialUnitDto,
  isValidTimelineEventDto,
  mapEventSource,
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
    yearStart: 0,
    yearEnd: 0,
    sequence: 1,
    sourceMaterials: [
      {
        sourceMaterial: { id: 'mat-1', title: 'A New Hope', medium: 0, canonType: 0 },
        sourceMaterialUnit: null,
      },
    ],
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

  it('validates source material links and their optional units', () => {
    const material = { id: 'm', title: 'T', medium: 0, canonType: 0 };
    expect(
      isValidSourceMaterialLinkDto({ sourceMaterial: material, sourceMaterialUnit: null }),
    ).toBe(true);
    expect(
      isValidSourceMaterialLinkDto({
        sourceMaterial: material,
        sourceMaterialUnit: { id: 'u', unitType: 0, groupNumber: null, number: 1, title: null },
      }),
    ).toBe(true);
    expect(
      isValidSourceMaterialLinkDto({
        sourceMaterial: material,
        sourceMaterialUnit: { id: '', unitType: 0, number: 1 },
      }),
    ).toBe(false);
    expect(isValidSourceMaterialLinkDto({ sourceMaterial: null, sourceMaterialUnit: null })).toBe(
      false,
    );
  });

  it('accepts empty source arrays but rejects missing arrays or fields', () => {
    expect(isValidTimelineEventDto(eventDto())).toBe(true);
    expect(isValidTimelineEventDto(eventDto({ characters: undefined as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ locations: {} as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ vehicles: undefined as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ sourceMaterials: undefined as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ yearStart: undefined as never }))).toBe(false);
    expect(isValidTimelineEventDto(eventDto({ sequence: undefined as never }))).toBe(false);
  });
});

describe('mapEventSource', () => {
  it('maps codes and nested material/unit into the domain shape', () => {
    const source = mapEventSource({
      sourceMaterial: { id: 'mat-9', title: 'Heir to the Empire', medium: 1, canonType: 1 },
      sourceMaterialUnit: {
        id: 'u5',
        unitType: 4,
        groupNumber: 2,
        number: 7,
        title: 'Crazy Like a Wookiee',
      },
    });

    expect(source.canon).toEqual(['Legends']);
    expect(source.title).toBe('Heir to the Empire');
    expect(source.medium).toBe('Book');
    expect(source.sourceId).toBe('mat-9');
    expect(source.unit).toEqual({
      id: 'u5',
      unitType: 'Volume',
      groupNumber: 2,
      number: 7,
      title: 'Crazy Like a Wookiee',
    });
  });

  it('omits the unit when the link has none', () => {
    const source = mapEventSource({
      sourceMaterial: { id: 'mat-1', title: 'A New Hope', medium: 0, canonType: 0 },
      sourceMaterialUnit: null,
    });

    expect(source.unit).toBeUndefined();
  });
});

describe('mapTimelineEvent', () => {
  it('maps the single-source case into the domain shape', () => {
    const mapped = mapTimelineEvent(eventDto());

    expect(mapped.yearStart).toBe(0);
    expect(mapped.yearEnd).toBe(0);
    expect(mapped.sequence).toBe(1);
    expect(mapped.canon).toEqual(['Canon']);
    expect(mapped.sources).toHaveLength(1);
    expect(mapped.sources[0]).toMatchObject({
      title: 'A New Hope',
      medium: 'Movie',
      sourceId: 'mat-1',
      canon: ['Canon'],
    });
    expect(mapped.sources[0].unit).toBeUndefined();
  });

  it('unions canon coverage across multiple source materials', () => {
    const mapped = mapTimelineEvent(
      eventDto({
        sourceMaterials: [
          {
            sourceMaterial: { id: 'mat-1', title: 'A New Hope', medium: 0, canonType: 0 },
            sourceMaterialUnit: null,
          },
          {
            sourceMaterial: { id: 'mat-2', title: 'Heir to the Empire', medium: 1, canonType: 1 },
            sourceMaterialUnit: null,
          },
        ],
      }),
    );

    expect(mapped.sources.map((source) => source.sourceId)).toEqual(['mat-1', 'mat-2']);
    expect(mapped.canon).toEqual(['Canon', 'Legends']);
  });

  it('keeps per-source pinned units distinct', () => {
    const mapped = mapTimelineEvent(
      eventDto({
        sourceMaterials: [
          {
            sourceMaterial: { id: 'mat-3', title: 'Darth Vader (2017)', medium: 2, canonType: 1 },
            sourceMaterialUnit: {
              id: 'u1',
              unitType: 3,
              groupNumber: 1,
              number: 1,
              title: 'Force Storm, Part 1',
            },
          },
          {
            sourceMaterial: { id: 'mat-4', title: 'A New Hope', medium: 0, canonType: 0 },
            sourceMaterialUnit: null,
          },
        ],
      }),
    );

    expect(mapped.sources[0].unit?.title).toBe('Force Storm, Part 1');
    expect(mapped.sources[1].unit).toBeUndefined();
  });

  it('discards malformed source links while keeping valid ones', () => {
    const mapped = mapTimelineEvent({
      ...eventDto(),
      sourceMaterials: [
        { sourceMaterial: { id: 'mat-1', title: 'A New Hope', medium: 0, canonType: 0 }, sourceMaterialUnit: null },
        { broken: true },
        null,
      ],
    } as unknown as TimelineEventDto);

    expect(mapped.sources).toHaveLength(1);
    expect(mapped.sources[0].sourceId).toBe('mat-1');
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
