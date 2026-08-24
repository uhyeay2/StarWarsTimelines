import { Medium } from './medium';
import { UnitType } from './unit-type';

export interface SourceMaterialUnit {
  id?: number;
  unitType: UnitType;
  number: number;
  /** Published unit title, or `null`/`undefined` when untitled. */
  title?: string | null;
  /** The container unit (season/volume/book/collection) this unit nests inside. */
  parentUnitId?: number | null;
}

export interface SourceMaterial {
  title: string;
  medium: Medium;
  sourceId?: number;
  unit?: SourceMaterialUnit;
}

/**
 * Returns true for container unit types that act as group headers.
 */
export function isContainerUnitType(unitType: UnitType): boolean {
  return unitType === 'Season' || unitType === 'Volume' || unitType === 'Book';
}

/**
 * Builds a label for the container a unit nests inside, e.g.
 * `"Season 2"` for an episode whose parent season carries number 2.
 *
 * @param parent  The resolved container unit, or `undefined` when unknown.
 * @returns The group prefix such as `Season 2`, or `undefined`.
 */
function containerPrefix(parent: SourceMaterialUnit | undefined): string | undefined {
  if (parent === undefined) {
    return undefined;
  }
  switch (parent.unitType) {
    case 'Season':
      return `Season ${parent.number}`;
    case 'Volume':
      return `Volume ${parent.number}`;
    case 'Book':
      return `Book ${parent.number}`;
    case 'Collection':
      return `Collection ${parent.number}`;
    default:
      return `${parent.unitType} ${parent.number}`;
  }
}

export function sourceUnitLabel(
  unit: SourceMaterialUnit,
  parent?: SourceMaterialUnit,
): string {
  const prefix = containerPrefix(parent);
  let base: string;
  switch (unit.unitType) {
    case 'Episode':
      base = prefix === undefined ? `Episode ${unit.number}` : `${prefix} · Episode ${unit.number}`;
      break;
    case 'Issue':
      base = prefix === undefined ? `Issue ${unit.number}` : `${prefix} · Issue ${unit.number}`;
      break;
    case 'Chapter':
      base = `Chapter ${unit.number}`;
      break;
    case 'Level':
      base = `Level ${unit.number}`;
      break;
    default:
      base = `${unit.unitType} ${unit.number}`;
      break;
  }
  return unit.title ? `${base}: ${unit.title}` : base;
}

/** The container kind ("Season" / "Volume") a child unit type groups under. */
export function sourceGroupName(unitType: UnitType): string | undefined {
  switch (unitType) {
    case 'Episode':
    case 'Season':
      return 'Season';
    case 'Issue':
    case 'Volume':
      return 'Volume';
    default:
      return undefined;
  }
}

export function sourceUnitDetail(
  unit: SourceMaterialUnit,
  parent?: SourceMaterialUnit,
): string | undefined {
  const prefix = containerPrefix(parent);
  switch (unit.unitType) {
    case 'Episode':
    case 'Issue': {
      const noun = unit.unitType === 'Episode' ? 'Episode' : 'Issue';
      const base = prefix === undefined ? `${noun} ${unit.number}` : `${prefix} · ${noun} ${unit.number}`;
      return unit.title ? `${base}: ${unit.title}` : base;
    }
    case 'Chapter':
      return unit.title ? `Chapter ${unit.number}: ${unit.title}` : undefined;
    case 'Season':
      return `Season ${unit.number}`;
    case 'Volume':
      return `Volume ${unit.number}`;
    case 'Level':
      return `Level ${unit.number}`;
    case 'Collection':
      return `Collection ${unit.number}`;
    case 'Book':
      return unit.title ? `Book ${unit.number}: ${unit.title}` : `Book ${unit.number}`;
  }
}
