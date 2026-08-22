import { LibraryItemDto, LibraryUnitDto } from './library.dto';
import { isValidItemDto, isValidUnitDto, mapLibraryItem, mapLibraryUnit } from './library.mapper';

function unitDto(partial: Partial<LibraryUnitDto> = {}): LibraryUnitDto {
  return {
    id: 'unit-1',
    unitType: 0,
    groupNumber: null,
    number: 1,
    title: null,
    isCompleted: false,
    isTracked: false,
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

  it('rejects non-objects and missing or mistyped fields', () => {
    expect(isValidUnitDto(null)).toBe(false);
    expect(isValidUnitDto('unit')).toBe(false);
    expect(isValidUnitDto(unitDto({ id: '' }))).toBe(false);
    expect(isValidUnitDto(unitDto({ unitType: 'Episode' as unknown as number }))).toBe(false);
    expect(isValidUnitDto(unitDto({ number: '1' as unknown as number }))).toBe(false);
    expect(isValidUnitDto(unitDto({ isCompleted: undefined as unknown as boolean }))).toBe(false);
  });
});

describe('isValidItemDto', () => {
  it('accepts a well-formed item', () => {
    expect(isValidItemDto(itemDto)).toBe(true);
  });

  it('rejects non-objects and missing or mistyped fields', () => {
    expect(isValidItemDto(null)).toBe(false);
    expect(isValidItemDto({})).toBe(false);
    expect(isValidItemDto({ ...itemDto, sourceMaterialId: '' })).toBe(false);
    expect(isValidItemDto({ ...itemDto, status: 'In progress' as unknown as number })).toBe(false);
    expect(isValidItemDto({ ...itemDto, units: null as unknown as [] })).toBe(false);
    expect(isValidItemDto({ ...itemDto, isFavorite: undefined as unknown as boolean })).toBe(
      false,
    );
  });
});

describe('mapLibraryUnit', () => {
  it('maps numeric codes and nullables to the domain shape', () => {
    const mapped = mapLibraryUnit(
      unitDto({ unitType: 2, groupNumber: 2, number: 5, title: 'Twilight', isCompleted: true }),
    );

    expect(mapped).toEqual({
      id: 'unit-1',
      unitType: 'Issue',
      groupNumber: 2,
      number: 5,
      title: 'Twilight',
      isCompleted: true,
      isTracked: false,
    });
  });

  it('converts null group/title to undefined', () => {
    const mapped = mapLibraryUnit(unitDto());

    expect(mapped.groupNumber).toBeUndefined();
    expect(mapped.title).toBeUndefined();
  });

  it('throws on an unknown unit type code', () => {
    expect(() => mapLibraryUnit(unitDto({ unitType: 99 }))).toThrow();
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
    expect(typeof mapped.status).toBe('string');
  });

  it('drops malformed units instead of throwing', () => {
    const dto: LibraryItemDto = {
      ...itemDto,
      units: [unitDto({ id: 'good' }), { bad: true } as unknown as LibraryUnitDto],
    };

    const mapped = mapLibraryItem(dto);

    expect((mapped.units ?? []).map((u) => u.id)).toEqual(['good']);
  });
});
