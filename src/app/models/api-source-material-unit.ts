import { UnitType } from './unit-type';

export interface ApiSourceMaterialUnit {
  id: number;
  sourceMaterialId: number;
  unitType: UnitType;
  number: number;
  title: string | null;
  parentUnitId: number | null;
}
