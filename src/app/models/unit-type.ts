/**
 * Unit types in backend enum order (`Episode=0` … `Book=7`); the array index
 * is the numeric API code.
 */
export const UNIT_TYPES = [
  'Episode',
  'Chapter',
  'Issue',
  'Season',
  'Volume',
  'Level',
  'Collection',
  'Book',
] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

export function unitTypeFromApiCode(code: number): UnitType {
  const unitType = UNIT_TYPES[code];
  if (unitType === undefined) {
    throw new Error(`Unknown unit type code: ${code}`);
  }
  return unitType;
}

export function unitTypeToApiCode(unitType: UnitType): number {
  return UNIT_TYPES.indexOf(unitType);
}

/**
 * Returns whether a unit type acts as a container for other units
 * (seasons, volumes, books) or a top-level collection grouping them.
 *
 * @param unitType  The unit type to check.
 * @returns `true` for Season, Volume, Book, and Collection.
 */
export function isContainerOrCollectionUnit(unitType: UnitType): boolean {
  return (
    unitType === 'Season' ||
    unitType === 'Volume' ||
    unitType === 'Book' ||
    unitType === 'Collection'
  );
}
