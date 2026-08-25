import { UnitType } from './unit-type';

export interface ApiSourceMaterialUnit {
  readonly id: number;
  readonly sourceMaterialId: number;
  readonly unitType: UnitType;
  readonly number: number;
  readonly title: string | null;
  readonly parentUnitId: number | null;
}
