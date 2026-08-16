import { Medium } from './medium';
import { UnitType } from './unit-type';

export interface SourceMaterialUnit {
  unitType: UnitType;
  groupNumber?: number;
  number: number;
  title?: string;
}

export interface SourceMaterial {
  title: string;
  medium: Medium;
  sourceId?: string;
  unit?: SourceMaterialUnit;
}

export function sourceUnitLabel(unit: SourceMaterialUnit): string {
  let base: string;
  switch (unit.unitType) {
    case 'Episode':
      base =
        unit.groupNumber === undefined
          ? `Episode ${unit.number}`
          : `Season ${unit.groupNumber} · Episode ${unit.number}`;
      break;
    case 'Issue':
      base =
        unit.groupNumber === undefined
          ? `Issue ${unit.number}`
          : `Volume ${unit.groupNumber} · Issue ${unit.number}`;
      break;
    case 'Chapter':
      base = `Chapter ${unit.number}`;
      break;
    case 'Level':
      base = `Level ${unit.number}`;
      break;
  }
  return unit.title ? `${base}: ${unit.title}` : base;
}

export function sourceGroupName(unitType: UnitType): string | undefined {
  switch (unitType) {
    case 'Episode':
      return 'Season';
    case 'Issue':
      return 'Volume';
    default:
      return undefined;
  }
}

export function sourceUnitDetail(unit: SourceMaterialUnit | undefined): string | undefined {
  if (unit === undefined) {
    return undefined;
  }
  switch (unit.unitType) {
    case 'Episode':
    case 'Issue': {
      const base = unit.unitType === 'Episode' ? `Episode ${unit.number}` : `Issue ${unit.number}`;
      return unit.title ? `${base}: ${unit.title}` : base;
    }
    case 'Chapter':
      return unit.title ? `Chapter ${unit.number}: ${unit.title}` : undefined;
    case 'Level':
      return `Level ${unit.number}`;
  }
}
