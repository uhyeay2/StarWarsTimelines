import { CanonType } from './canon-type';
import { Medium } from './medium';

export interface ApiSourceMaterial {
  id: string;
  title: string;
  medium: Medium;
  canonType: CanonType;
}
