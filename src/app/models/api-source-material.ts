import { CanonType } from './canon-type';
import { Medium } from './medium';

export interface ApiSourceMaterial {
  id: number;
  title: string;
  medium: Medium;
  canonType: CanonType;
}
