/**
 * Planet location types in backend enum order (`City=1` … `Ruins=10`); the
 * array index is the numeric API code minus one.
 */
export const PLANET_LOCATION_TYPES = [
  'City',
  'Temple',
  'Battlefield',
  'Landmark',
  'Spaceport',
  'MilitaryBase',
  'GovernmentBuilding',
  'NaturalWonder',
  'Settlement',
  'Ruins',
] as const;

export type PlanetLocationType = (typeof PLANET_LOCATION_TYPES)[number];

export function planetLocationTypeFromApiCode(code: number): PlanetLocationType {
  const type = PLANET_LOCATION_TYPES[code - 1];
  if (type === undefined) {
    throw new Error(`Unknown planet location type code: ${code}`);
  }
  return type;
}

export function planetLocationTypeToApiCode(type: PlanetLocationType): number {
  return PLANET_LOCATION_TYPES.indexOf(type) + 1;
}
