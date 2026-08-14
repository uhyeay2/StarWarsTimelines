import { Component, input, output } from '@angular/core';
import { TimelineEvent } from '../../models/timeline-event';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';

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
  readonly status = input<TrackingStatus | undefined>();
  readonly canTrack = input(false);
  readonly statuses = TRACKING_STATUSES;

  readonly toggleFacet = output<ToggleFacetEvent>();
  readonly addToLibrary = output<void>();
  readonly statusChange = output<TrackingStatus>();

  emitToggle(key: ToggleableFacetKey, value: string): void {
    this.toggleFacet.emit({ key, value });
  }

  emitAddToLibrary(): void {
    this.addToLibrary.emit();
  }

  onStatusChange(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as TrackingStatus);
  }
}
