/**
 * @fileoverview Individual timeline event card component.
 *
 * Renders a single timeline event as a card within the timeline list.
 * Displays the event date, title, source material chips, canon badges,
 * and optional details (description, locations, characters, vehicles).
 *
 * Supports interactive filtering via clickable chips.
 *
 * For signed-in users, each card also shows a tracking status dropdown
 * that mirrors the catalog page's behavior:
 *
 * - Movies, Short Films, Books, and Video Games are tracked at the
 *   material level (units like chapters / levels are informational).
 * - Comics are tracked per Volume (the volume containing the event's issue).
 * - Shows (live action / animated) are tracked per Season (the season
 *   containing the event's episode).
 *
 * @see {@link Timeline} for the parent component that renders a list of these.
 * @see {@link ToggleFacetEvent} for the chip toggle output shape.
 */

import { switchMap } from 'rxjs';
import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FacetKey, SourceFilterChip } from '../../models/timeline-filters';
import { sourceUnitDetail, sourceUnitLabel } from '../../models/source-material';
import { TimelineEvent } from '../../models/timeline-event';
import { LibraryItem } from '../../models/library-item';
import { TrackSelectOption, findTrackedItem, groupTrackingStatus, groupUnitIsTracked, materialTrackingStatus, trackSelectOptions } from '../../models/tracking-selection';
import { TrackingStatus } from '../../models/tracking-status';
import { AuthService } from '../../services/auth/auth.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';

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
export class TimelineEventItem implements OnInit {
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

  // ─── Constants ─────────────────────────────────────────────────────────

  /** Function to generate a human-readable label for a source unit. */
  readonly sourceUnitLabel = sourceUnitLabel;

  /** Function to generate a detail string for a source unit. */
  readonly sourceUnitDetail = sourceUnitDetail;

  // ─── Outputs ───────────────────────────────────────────────────────────

  /** Emitted when a facet chip is toggled. */
  readonly toggleFacet = output<ToggleFacetEvent>();

  // ─── Internal state ────────────────────────────────────────────────────

  /** Whether the expanded details section is visible. */
  readonly detailsOpen = signal(false);

  // ─── Tracking state ────────────────────────────────────────────────────

  private readonly authService = inject(AuthService);
  private readonly libraryService = inject(LibraryService);
  private readonly catalogService = inject(CatalogService);

  /** The signed-in user, or `null` when anonymous (dropdown hidden). */
  readonly currentUser = this.authService.currentUser;

  /** Whether this event's medium tracks at season/volume group level. */
  readonly isGroupedMedium = computed(() => {
    const medium = this.event().source.medium;
    return medium === 'Comic' || medium === 'Live Action Show' || medium === 'Animated Show';
  });

  /** The tracked library item for this event's source material, or null. */
  readonly trackedItem = computed(() => {
    const sourceId = this.event().source.sourceId;
    return sourceId === undefined ? null : findTrackedItem(this.libraryService.items(), sourceId);
  });

  /**
   * The Season/Volume container unit ID governing tracking for grouped-media
   * events, resolved from the catalog's unit cache. `null` for flat mediums,
   * whole-material events on grouped mediums, or when no explicit container
   * unit exists (mirroring the catalog page, which hides the dropdown then).
   */
  readonly containerUnitId = computed(() => {
    if (!this.isGroupedMedium()) {
      return null;
    }
    const source = this.event().source;
    const unit = source.unit;
    if (source.sourceId === undefined || unit === undefined) {
      return null;
    }
    const targetGroup = unit.groupNumber ?? unit.number;
    const units = this.catalogService.getUnitCache(source.sourceId).data() ?? [];
    const container = units.find(
      (u) =>
        (u.unitType === 'Season' || u.unitType === 'Volume') &&
        (u.number === targetGroup || u.groupNumber === targetGroup),
    );
    return container?.id ?? null;
  });

  /** Whether the tracking dropdown should be rendered for this event. */
  readonly showTracking = computed(() => {
    if (this.currentUser() === null) {
      return false;
    }
    if (this.isGroupedMedium()) {
      return this.containerUnitId() !== null;
    }
    return this.event().source.sourceId !== undefined;
  });

  /** Select options: statuses, plus 'Remove From Library' once tracked. */
  readonly trackingOptions = computed((): readonly TrackSelectOption[] => {
    if (this.isGroupedMedium()) {
      const unitId = this.containerUnitId();
      const item = this.trackedItem();
      return trackSelectOptions(unitId !== null && groupUnitIsTracked(item, unitId));
    }
    return trackSelectOptions(this.trackedItem() !== null);
  });

  /** The currently selected tracking status, or `null` (shows "Track…"). */
  readonly currentStatus = computed((): TrackingStatus | null => {
    if (this.isGroupedMedium()) {
      const unitId = this.containerUnitId();
      return unitId === null ? null : groupTrackingStatus(this.trackedItem(), unitId);
    }
    return materialTrackingStatus(this.trackedItem());
  });

  ngOnInit(): void {
    const user = this.currentUser();
    if (!user) {
      return;
    }
    this.libraryService.ensureTracked(user.id);
    if (this.isGroupedMedium()) {
      const sourceId = this.event().source.sourceId;
      if (sourceId !== undefined) {
        this.catalogService.getUnitCache(sourceId).fetch();
      }
    }
  }

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

  /**
   * Handles a tracking status change from the dropdown, applying it at the
   * scope implied by the medium (material level, or Season/Volume level).
   *
   * @param changeEvent  The select's change event.
   */
  onTrackChange(changeEvent: Event): void {
    const status = (changeEvent.target as HTMLSelectElement).value as
      | TrackingStatus
      | 'remove'
      | '';
    const user = this.currentUser();
    const source = this.event().source;
    if (!user || !status || source.sourceId === undefined) {
      return;
    }
    const userId = user.id;
    const material = {
      id: source.sourceId,
      title: source.title,
      medium: source.medium,
    };

    if (this.isGroupedMedium()) {
      const unitId = this.containerUnitId();
      if (unitId === null) {
        return;
      }
      if (status === 'remove') {
        this.libraryService.clearUnitProgress(userId, material.id, unitId).subscribe();
        return;
      }
      if (!this.trackedItem()) {
        this.libraryService
          .addTracked(userId, material, status)
          .pipe(switchMap(() => this.libraryService.setStatus(userId, material.id, status, unitId)))
          .subscribe();
        return;
      }
      this.libraryService.setStatus(userId, material.id, status, unitId).subscribe();
      return;
    }

    if (status === 'remove') {
      this.libraryService.removeTracked(userId, material.id).subscribe();
      return;
    }
    if (this.trackedItem()) {
      this.libraryService.setStatus(userId, material.id, status).subscribe();
      return;
    }
    this.libraryService.addTracked(userId, material, status).subscribe();
  }
}
