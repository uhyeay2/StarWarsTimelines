/**
 * Galaxy hierarchy levels in backend enum order (`Region=1` … `PlanetLocation=5`);
 * the array index is the numeric API code minus one.
 *
 * Timeline events reference places polymorphically across these levels: each
 * {@link LocationReference} pairs one of these levels with the identifier of a
 * row inside that level's table.
 */
export const LOCATION_HIERARCHY_TYPES = [
  'Region',
  'Subregion',
  'PlanetSystem',
  'Planet',
  'PlanetLocation',
] as const;

export type LocationHierarchyType = (typeof LOCATION_HIERARCHY_TYPES)[number];

export function locationHierarchyTypeFromApiCode(code: number): LocationHierarchyType {
  const type = LOCATION_HIERARCHY_TYPES[code - 1];
  if (type === undefined) {
    throw new Error(`Unknown location hierarchy type code: ${code}`);
  }
  return type;
}

export function locationHierarchyTypeToApiCode(type: LocationHierarchyType): number {
  return LOCATION_HIERARCHY_TYPES.indexOf(type) + 1;
}
