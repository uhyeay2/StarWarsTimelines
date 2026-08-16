import { Component, input, output, signal } from '@angular/core';
import { FacetKey, SourceFilterChip } from '../../models/timeline-filters';
import { sourceUnitDetail, sourceUnitLabel } from '../../models/source-material';
import { TimelineEvent } from '../../models/timeline-event';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';

export type ToggleableFacetKey = FacetKey;

export interface ToggleFacetEvent {
  key: ToggleableFacetKey;
  values: readonly string[];
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
  readonly selectedSources = input<readonly string[]>([]);
  readonly sourceChips = input<readonly SourceFilterChip[]>([]);
  readonly status = input<TrackingStatus | undefined>();
  readonly canTrack = input(false);
  readonly statuses = TRACKING_STATUSES;
  readonly sourceUnitLabel = sourceUnitLabel;
  readonly sourceUnitDetail = sourceUnitDetail;

  readonly toggleFacet = output<ToggleFacetEvent>();
  readonly addToLibrary = output<void>();
  readonly statusChange = output<TrackingStatus>();

  readonly detailsOpen = signal(false);

  toggleDetails(): void {
    this.detailsOpen.update((isOpen) => !isOpen);
  }

  emitToggle(key: ToggleableFacetKey, values: readonly string[]): void {
    this.toggleFacet.emit({ key, values });
  }

  sourceChipSelected(chip: SourceFilterChip): boolean {
    return chip.values.every((value) => this.selectedSources().includes(value));
  }

  emitAddToLibrary(): void {
    this.addToLibrary.emit();
  }

  onStatusChange(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as TrackingStatus);
  }
}
