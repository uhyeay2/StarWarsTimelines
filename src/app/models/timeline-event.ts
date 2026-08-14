import { Canon } from './canon';
import { SourceMaterial } from './source-material';

export interface TimelineEvent {
  id: string;
  canon: readonly Canon[];
  title: string;
  description: string;
  source: SourceMaterial;
  locations: readonly string[];
  characters: readonly string[];
  vehicles: readonly string[];
  year: number;
  displayDate: string;
  displayDateEnd?: string;
}
