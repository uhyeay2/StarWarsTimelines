import { CanonType } from './canon-type';
import { Medium } from './medium';

export interface ApiSourceMaterial {
  readonly id: number;
  readonly title: string;
  readonly medium: Medium;
  readonly canonType: CanonType;
}
