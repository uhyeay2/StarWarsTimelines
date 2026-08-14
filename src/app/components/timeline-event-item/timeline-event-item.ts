import { Component, input, output } from '@angular/core';
import { TimelineEvent } from '../../models/timeline-event';

export type ToggleableFacetKey = 'locations' | 'characters' | 'vehicles';

export interface ToggleFacetEvent {
  key: ToggleableFacetKey;
  value: string;
}

@Component({
  selector: 'app-timeline-event-item',
  imports: [],
  templateUrl: './timeline-event-item.html',
  styleUrl: './timeline-event-item.scss',
})
export class TimelineEventItem {
  readonly event = input.required<TimelineEvent>();
  readonly selectedLocations = input<readonly string[]>([]);
  readonly selectedCharacters = input<readonly string[]>([]);
  readonly selectedVehicles = input<readonly string[]>([]);

  readonly toggleFacet = output<ToggleFacetEvent>();

  emitToggle(key: ToggleableFacetKey, value: string): void {
    this.toggleFacet.emit({ key, value });
  }
}
