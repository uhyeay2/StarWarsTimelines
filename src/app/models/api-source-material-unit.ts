import { UnitType } from './unit-type';

export interface ApiSourceMaterialUnit {
  id: string;
  sourceMaterialId: string;
  unitType: UnitType;
  groupNumber: number | null;
  number: number;
  title: string | null;
}
