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

function named(id: number, name: string): { id: number; name: string } {
  return { id, name };
}

function eventDto(partial: Partial<TimelineEventDto> = {}): TimelineEventDto {
  return {
    id: 1,
    title: 'Battle of Yavin',
    description: 'The Death Star is destroyed.',
    yearStart: 0,
    yearEnd: 0,
    sequence: 1,
    sourceMaterials: [
      {
        sourceMaterial: { id: 10, title: 'A New Hope', medium: 0, canonType: 0 },
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
    expect(isValidNamedEntityDto(named(7, 'Luke'))).toBe(true);
    expect(isValidNamedEntityDto(null)).toBe(false);
    expect(isValidNamedEntityDto({ id: 0, name: 'Luke' })).toBe(true);
    expect(isValidNamedEntityDto({ id: 7, name: '' })).toBe(false);
  });

  it('validates source material DTOs', () => {
    expect(
      isValidSourceMaterialDto({ id: 10, title: 'T', medium: 0, canonType: 0 }),
    ).toBe(true);
    expect(isValidSourceMaterialDto(null)).toBe(false);
    expect(isValidSourceMaterialDto({ id: 10, title: 'T' })).toBe(false);
    expect(isValidSourceMaterialDto({ id: 10, title: 'T', medium: 'Movie', canonType: 0 })).toBe(
      false,
    );
  });

  it('validates source material unit DTOs', () => {
    expect(isValidSourceMaterialUnitDto({ id: 50, unitType: 0, number: 1 })).toBe(true);
    expect(isValidSourceMaterialUnitDto(null)).toBe(false);
    expect(isValidSourceMaterialUnitDto({ id: null, unitType: 0, number: 1 })).toBe(false);
  });

  it('validates source material links and their optional units', () => {
    const material = { id: 10, title: 'T', medium: 0, canonType: 0 };
    expect(
      isValidSourceMaterialLinkDto({ sourceMaterial: material, sourceMaterialUnit: null }),
    ).toBe(true);
    expect(
      isValidSourceMaterialLinkDto({
        sourceMaterial: material,
        sourceMaterialUnit: { id: 51, unitType: 0, parentUnitId: null, number: 1, title: null },
      }),
    ).toBe(true);
    expect(
      isValidSourceMaterialLinkDto({
        sourceMaterial: material,
        sourceMaterialUnit: { id: null, unitType: 0, number: 1 },
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
      sourceMaterial: { id: 90, title: 'Heir to the Empire', medium: 1, canonType: 1 },
      sourceMaterialUnit: {
        id: 55,
        unitType: 4,
        parentUnitId: 71,
        number: 7,
        title: 'Crazy Like a Wookiee',
      },
    });

    expect(source.canon).toEqual(['Legends']);
    expect(source.title).toBe('Heir to the Empire');
    expect(source.medium).toBe('Book');
    expect(source.sourceId).toBe(90);
    expect(source.unit).toEqual({
      id: 55,
      unitType: 'Volume',
      parentUnitId: 71,
      number: 7,
      title: 'Crazy Like a Wookiee',
    });
  });

  it('omits the unit when the link has none', () => {
    const source = mapEventSource({
      sourceMaterial: { id: 10, title: 'A New Hope', medium: 0, canonType: 0 },
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
      sourceId: 10,
      canon: ['Canon'],
    });
    expect(mapped.sources[0].unit).toBeUndefined();
  });

  it('unions canon coverage across multiple source materials', () => {
    const mapped = mapTimelineEvent(
      eventDto({
        sourceMaterials: [
          {
            sourceMaterial: { id: 10, title: 'A New Hope', medium: 0, canonType: 0 },
            sourceMaterialUnit: null,
          },
          {
            sourceMaterial: { id: 20, title: 'Heir to the Empire', medium: 1, canonType: 1 },
            sourceMaterialUnit: null,
          },
        ],
      }),
    );

    expect(mapped.sources.map((source) => source.sourceId)).toEqual([10, 20]);
    expect(mapped.canon).toEqual(['Canon', 'Legends']);
  });

  it('keeps per-source pinned units distinct', () => {
    const mapped = mapTimelineEvent(
      eventDto({
        sourceMaterials: [
          {
            sourceMaterial: { id: 30, title: 'Darth Vader (2017)', medium: 2, canonType: 1 },
            sourceMaterialUnit: {
              id: 61,
              unitType: 3,
              parentUnitId: 81,
              number: 1,
              title: 'Force Storm, Part 1',
            },
          },
          {
            sourceMaterial: { id: 40, title: 'A New Hope', medium: 0, canonType: 0 },
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
        { sourceMaterial: { id: 10, title: 'A New Hope', medium: 0, canonType: 0 }, sourceMaterialUnit: null },
        { broken: true },
        null,
      ],
    } as unknown as TimelineEventDto);

    expect(mapped.sources).toHaveLength(1);
    expect(mapped.sources[0].sourceId).toBe(10);
  });

  it('discards malformed entities while mapping names', () => {
    const mapped = mapTimelineEvent({
      ...eventDto(),
      characters: [named(7, 'Luke'), null],
      locations: [named(8, 'Yavin 4'), { broken: true }],
      vehicles: [named(9, 'X-wing')],
    } as TimelineEventDto);

    expect(mapped.characters).toEqual(['Luke']);
    expect(mapped.locations).toEqual(['Yavin 4']);
    expect(mapped.vehicles).toEqual(['X-wing']);
  });
});
