/**
 * @fileoverview Individual timeline event card component.
 *
 * Renders a single timeline event as a card within the timeline list.
 * Displays the event date, title, source material chips, canon badges,
 * and optional details (description, locations, characters, vehicles).
 *
 * Supports interactive filtering via clickable chips and tracking controls
 * (add to library / status select) when the user is authenticated.
 *
 * @see {@link Timeline} for the parent component that renders a list of these.
 * @see {@link ToggleFacetEvent} for the chip toggle output shape.
 */

import { Component, input, output, signal } from '@angular/core';
import { FacetKey, SourceFilterChip } from '../../models/timeline-filters';
import { sourceUnitDetail, sourceUnitLabel } from '../../models/source-material';
import { TimelineEvent } from '../../models/timeline-event';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';

/** The facet key type for toggleable filter chips. */
export type ToggleableFacetKey = FacetKey;

/** Event payload emitted when a facet chip is toggled on an event card. */
export interface ToggleFacetEvent {
  /** The facet category (sources, locations, characters, vehicles). */
  key: ToggleableFacetKey;
  /** The values to add/remove from the filter. */
  values: readonly string[];
}

@Component({
  selector: 'app-timeline-event-item',
  imports: [],
  templateUrl: './timeline-event-item.html',
  styleUrl: './timeline-event-item.scss',
})
export class TimelineEventItem {
  // ─── Inputs ────────────────────────────────────────────────────────────

  /** The timeline event to render. */
  readonly event = input.required<TimelineEvent>();

  /** Currently selected location filter values (for chip highlighting). */
  readonly selectedLocations = input<readonly string[]>([]);

  /** Currently selected character filter values (for chip highlighting). */
  readonly selectedCharacters = input<readonly string[]>([]);

  /** Currently selected vehicle filter values (for chip highlighting). */
  readonly selectedVehicles = input<readonly string[]>([]);

  /** Currently selected source filter values (for chip highlighting). */
  readonly selectedSources = input<readonly string[]>([]);

  /** Source filter chips to display for this event. */
  readonly sourceChips = input<readonly SourceFilterChip[]>([]);

  /** The tracking status for this event's source, if tracked. */
  readonly status = input<TrackingStatus | undefined>();

  /** Whether the user can track this event's source material. */
  readonly canTrack = input(false);

  // ─── Constants ─────────────────────────────────────────────────────────

  /** All valid tracking status options for the status select. */
  readonly statuses = TRACKING_STATUSES;

  /** Function to generate a human-readable label for a source unit. */
  readonly sourceUnitLabel = sourceUnitLabel;

  /** Function to generate a detail string for a source unit. */
  readonly sourceUnitDetail = sourceUnitDetail;

  // ─── Outputs ───────────────────────────────────────────────────────────

  /** Emitted when a facet chip is toggled. */
  readonly toggleFacet = output<ToggleFacetEvent>();

  /** Emitted when the "Add to library" button is clicked. */
  readonly addToLibrary = output<void>();

  /** Emitted when the tracking status select changes. */
  readonly statusChange = output<TrackingStatus>();

  // ─── Internal state ────────────────────────────────────────────────────

  /** Whether the expanded details section is visible. */
  readonly detailsOpen = signal(false);

  // ─── Public methods ────────────────────────────────────────────────────

  /** Toggles the expanded details section. */
  toggleDetails(): void {
    this.detailsOpen.update((isOpen) => !isOpen);
  }

  /**
   * Emits a facet toggle event for the given key and values.
   *
   * @param key     The facet category to toggle.
   * @param values  The values to add/remove from the filter.
   */
  emitToggle(key: ToggleableFacetKey, values: readonly string[]): void {
    this.toggleFacet.emit({ key, values });
  }

  /**
   * Returns whether all values of a source chip are currently selected.
   *
   * @param chip  The source chip to check.
   * @returns `true` if all chip values are in the selected sources list.
   */
  sourceChipSelected(chip: SourceFilterChip): boolean {
    return chip.values.every((value) => this.selectedSources().includes(value));
  }

  /** Emits the `addToLibrary` output. */
  emitAddToLibrary(): void {
    this.addToLibrary.emit();
  }

  /**
   * Handles a change event from the status select dropdown.
   *
   * @param event  The native change event from the select element.
   */
  onStatusChange(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as TrackingStatus);
  }
}
