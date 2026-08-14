import { Medium } from './medium';
import { TrackingStatus } from './tracking-status';

export interface LibraryItem {
  id: string;
  title: string;
  medium: Medium;
  status: TrackingStatus;
  favorite: boolean;
}
