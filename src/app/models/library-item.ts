import { Medium } from './medium';
import { TrackingStatus } from './tracking-status';
import { UnitType } from './unit-type';

export interface LibraryUnit {
  id: string;
  unitType: UnitType;
  groupNumber?: number;
  number: number;
  title?: string;
  isCompleted: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  medium: Medium;
  status: TrackingStatus;
  favorite: boolean;
  units?: readonly LibraryUnit[];
}
