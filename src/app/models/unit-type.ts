export const UNIT_TYPES = ['Episode', 'Chapter', 'Issue', 'Season', 'Volume', 'Level'] as const;

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
