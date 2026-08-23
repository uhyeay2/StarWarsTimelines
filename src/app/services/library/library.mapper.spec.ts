import { LibraryItemDto, LibraryUnitDto } from './library.dto';
import { isValidItemDto, isValidUnitDto, mapLibraryItem, mapLibraryUnit } from './library.mapper';

function unitDto(partial: Partial<LibraryUnitDto> = {}): LibraryUnitDto {
  return {
    id: 'unit-1',
    unitType: 0,
    groupNumber: null,
    number: 1,
    title: null,
    status: 0,
    parentUnitId: null,
    ...partial,
  };
}

const itemDto: LibraryItemDto = {
  sourceMaterialId: 'mat-1',
  title: 'A New Hope',
  medium: 0,
  canonType: 1,
  status: 1,
  isFavorite: true,
  units: [],
};

describe('isValidUnitDto', () => {
  it('accepts a well-formed unit', () => {
    expect(isValidUnitDto(unitDto())).toBe(true);
  });

  it('accepts a unit with a null status', () => {
    expect(isValidUnitDto(unitDto({ status: null }))).toBe(true);
  });

  it('rejects non-objects and missing or mistyped fields', () => {
    expect(isValidUnitDto(null)).toBe(false);
    expect(isValidUnitDto('unit')).toBe(false);
    expect(isValidUnitDto(unitDto({ id: '' }))).toBe(false);
    expect(isValidUnitDto(unitDto({ unitType: 'Episode' as unknown as number }))).toBe(false);
    expect(isValidUnitDto(unitDto({ number: '1' as unknown as number }))).toBe(false);
    expect(isValidUnitDto(unitDto({ status: undefined as unknown as number | null }))).toBe(false);
  });
});

describe('isValidItemDto', () => {
  it('accepts a well-formed item', () => {
    expect(isValidItemDto(itemDto)).toBe(true);
  });

  it('accepts an item with a null status (container-based materials)', () => {
    expect(isValidItemDto({ ...itemDto, status: null })).toBe(true);
  });

  it('rejects non-objects and missing or mistyped fields', () => {
    expect(isValidItemDto(null)).toBe(false);
    expect(isValidItemDto({})).toBe(false);
    expect(isValidItemDto({ ...itemDto, sourceMaterialId: '' })).toBe(false);
    expect(
      isValidItemDto({ ...itemDto, status: 'In progress' as unknown as number | null }),
    ).toBe(false);
    expect(isValidItemDto({ ...itemDto, status: undefined as unknown as number | null })).toBe(
      false,
    );
    expect(isValidItemDto({ ...itemDto, units: null as unknown as [] })).toBe(false);
    expect(isValidItemDto({ ...itemDto, isFavorite: undefined as unknown as boolean })).toBe(
      false,
    );
  });
});

describe('mapLibraryUnit', () => {
  it('maps numeric codes and nullables to the domain shape', () => {
    const mapped = mapLibraryUnit(
      unitDto({
        unitType: 2,
        groupNumber: 2,
        number: 5,
        title: 'Twilight',
        status: 1,
        parentUnitId: 'vol-9',
      }),
    );

    expect(mapped).toEqual({
      id: 'unit-1',
      unitType: 'Issue',
      groupNumber: 2,
      number: 5,
      title: 'Twilight',
      parentUnitId: 'vol-9',
      status: 'Completed',
    });
  });

  it('converts null group/title/parent to undefined and null status to null', () => {
    const mapped = mapLibraryUnit(unitDto({ status: null }));

    expect(mapped.groupNumber).toBeUndefined();
    expect(mapped.title).toBeUndefined();
    expect(mapped.parentUnitId).toBeUndefined();
    expect(mapped.status).toBeNull();
  });

  it('throws on an unknown unit type code', () => {
    expect(() => mapLibraryUnit(unitDto({ unitType: 99 }))).toThrow();
  });

  it('throws on an unknown status code', () => {
    expect(() => mapLibraryUnit(unitDto({ status: 99 }))).toThrow();
  });
});

describe('mapLibraryItem', () => {
  it('maps codes into string-union domain enums', () => {
    const mapped = mapLibraryItem(itemDto);

    expect(mapped).toMatchObject({
      id: 'mat-1',
      title: 'A New Hope',
      favorite: true,
    });
    expect(typeof mapped.medium).toBe('string');
    expect(mapped.status).toBe('Completed');
  });

  it('preserves a null item status', () => {
    const mapped = mapLibraryItem({ ...itemDto, status: null });

    expect(mapped.status).toBeNull();
  });

  it('flattens a nested container hierarchy depth-first preserving parent links', () => {
    const dto: LibraryItemDto = {
      ...itemDto,
      status: null,
      units: [
        unitDto({
          id: 'season-1',
          unitType: 3,
          number: 1,
          title: 'Season 1',
          status: 1,
          units: [
            unitDto({
              id: 'episode-1',
              groupNumber: 1,
              number: 1,
              title: 'Ambush',
              status: null,
              parentUnitId: 'season-1',
            }),
            unitDto({
              id: 'episode-2',
              groupNumber: 1,
              number: 2,
              title: 'Rising Malevolence',
              status: null,
              parentUnitId: 'season-1',
            }),
          ],
        }),
      ],
    };

    const units = mapLibraryItem(dto).units ?? [];

    expect(units.map((u) => u.id)).toEqual(['season-1', 'episode-1', 'episode-2']);
    expect(units[0]).toMatchObject({ unitType: 'Season', status: 'Completed' });
    expect(units[1].parentUnitId).toBe('season-1');
    expect(units[2].parentUnitId).toBe('season-1');
  });

  it('drops malformed units instead of throwing', () => {
    const dto: LibraryItemDto = {
      ...itemDto,
      units: [unitDto({ id: 'good' }), { bad: true } as unknown as LibraryUnitDto],
    };

    const mapped = mapLibraryItem(dto);

    expect((mapped.units ?? []).map((u) => u.id)).toEqual(['good']);
  });

  it('drops malformed units nested inside a tracked container', () => {
    const dto: LibraryItemDto = {
      ...itemDto,
      status: null,
      units: [
        unitDto({
          id: 'season-1',
          unitType: 3,
          number: 1,
          status: 1,
          units: [unitDto({ id: 'good-child' }), { bad: true } as unknown as LibraryUnitDto],
        }),
      ],
    };

    const units = mapLibraryItem(dto).units ?? [];

    expect(units.map((u) => u.id)).toEqual(['season-1', 'good-child']);
  });
});
