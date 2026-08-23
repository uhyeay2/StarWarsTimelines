/**
 * @fileoverview Individual timeline event card component.
 *
 * Renders a single timeline event as a card within the timeline list.
 * Displays the event's galactic date (or range), title, source material
 * chips, canon badges, and optional details (description, locations,
 * characters, vehicles).
 *
 * Supports interactive filtering via clickable chips.
 *
 * For signed-in users, each card also shows a tracking status dropdown
 * per depicting source material that mirrors the catalog page's behavior:
 *
 * - Movies, Short Films, Books, and Video Games are tracked at the
 *   material level (units like chapters / levels are informational).
 * - Comics are tracked per Volume (the volume containing the event's issue).
 * - Shows (live action / animated) are tracked per Season (the season
 *   containing the event's episode).
 * - Book collections are tracked per Book (the book containing the
 *   event's chapter or depicting the event directly).
 *
 * Materials whose units nest inside containers but whose events resolve no
 * container (e.g. a whole-collection event) hide the dropdown, mirroring
 * the catalog page.
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
import { formatGalacticYears, EventSource } from '../../models/timeline-event';
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

  /** Function to format the event's galactic date or range. */
  readonly formatDate = formatGalacticYears;

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

  /**
   * Stable key for tracking an `@for` loop over an event's sources.
   *
   * @param source  The event source.
   * @returns The material ID when known, otherwise the material title.
   */
  trackSource(source: EventSource): string {
    return source.sourceId ?? source.title;
  }

  /** The tracked library item for this source material, or null. */
  trackedItem(source: EventSource): LibraryItem | null {
    return source.sourceId === undefined ? null : findTrackedItem(this.libraryService.items(), source.sourceId);
  }

  /** Whether this source's medium tracks at season/volume/book group level. */
  isGroupedMedium(source: EventSource): boolean {
    if (
      source.medium === 'Comic' ||
      source.medium === 'Live Action Show' ||
      source.medium === 'Animated Show'
    ) {
      return true;
    }
    // Books whose pinned unit resolves to an explicit container (book
    // collections) track at the book level like shows/comics.
    return source.medium === 'Book' && this.resolveContainerUnit(source) !== null;
  }

  /**
   * Resolves the Season/Volume/Book container unit for the source's pinned
   * unit from the catalog's unit cache, or `null` when none matches.
   */
  private resolveContainerUnit(source: EventSource): string | null {
    const unit = source.unit;
    if (source.sourceId === undefined || unit === undefined) {
      return null;
    }
    const targetGroup = unit.groupNumber ?? unit.number;
    const units = this.catalogService.getUnitCache(source.sourceId).data() ?? [];
    const container = units.find(
      (u) =>
        (u.unitType === 'Season' || u.unitType === 'Volume' || u.unitType === 'Book') &&
        (u.number === targetGroup || u.groupNumber === targetGroup),
    );
    return container?.id ?? null;
  }

  /**
   * The Season/Volume/Book container unit ID governing tracking for grouped
   * sources, resolved from the catalog's unit cache. `null` for flat mediums,
   * whole-material events on grouped mediums, or when no explicit container
   * unit exists (mirroring the catalog page, which hides the dropdown then).
   */
  containerUnitId(source: EventSource): string | null {
    if (!this.isGroupedMedium(source)) {
      return null;
    }
    return this.resolveContainerUnit(source);
  }

  /** Whether the tracking dropdown should be rendered for this source. */
  showTracking(source: EventSource): boolean {
    if (this.currentUser() === null) {
      return false;
    }
    if (this.containerUnitId(source) !== null) {
      return true;
    }
    if (this.isGroupedMedium(source)) {
      return false;
    }
    return !this.materialTracksViaContainers(source);
  }

  /**
   * Whether the material's units nest inside container units (e.g. chapters
   * inside books). Such materials track per container; without a resolvable
   * container there is no meaningful dropdown scope, so it is hidden.
   */
  private materialTracksViaContainers(source: EventSource): boolean {
    if (source.sourceId === undefined) {
      return false;
    }
    const units = this.catalogService.getUnitCache(source.sourceId).data() ?? [];
    if (units.length === 0) {
      return false;
    }
    const ids = new Set(units.map((u) => u.id));
    return units.some(
      (u) => u.parentUnitId != null && u.parentUnitId !== '' && ids.has(u.parentUnitId),
    );
  }

  /** Select options: statuses, plus 'Remove From Library' once tracked. */
  trackingOptions(source: EventSource): readonly TrackSelectOption[] {
    const unitId = this.containerUnitId(source);
    if (unitId !== null) {
      return trackSelectOptions(groupUnitIsTracked(this.trackedItem(source), unitId));
    }
    return trackSelectOptions(this.trackedItem(source) !== null);
  }

  /** The currently selected tracking status, or `null` (shows "Track…"). */
  currentStatus(source: EventSource): TrackingStatus | null {
    const unitId = this.containerUnitId(source);
    if (unitId !== null) {
      return groupTrackingStatus(this.trackedItem(source), unitId);
    }
    return materialTrackingStatus(this.trackedItem(source));
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (!user) {
      return;
    }
    this.libraryService.ensureTracked(user.id);
    for (const source of this.event().sources) {
      if (source.sourceId !== undefined) {
        // Fetching every depicted material's unit cache lets container
        // resolution (and container-material detection) work everywhere.
        this.catalogService.getUnitCache(source.sourceId).fetch();
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
   * Handles a tracking status change from one source's dropdown, applying it
   * at the scope implied by the source (material level, or Season/Volume/
   * Book container level).
   *
   * @param changeEvent  The select's change event.
   * @param source       The event source whose dropdown changed.
   */
  onTrackChange(changeEvent: Event, source: EventSource): void {
    const status = (changeEvent.target as HTMLSelectElement).value as
      | TrackingStatus
      | 'remove'
      | '';
    const user = this.currentUser();
    if (!user || !status || source.sourceId === undefined) {
      return;
    }
    const userId = user.id;
    const material = {
      id: source.sourceId,
      title: source.title,
      medium: source.medium,
    };

    const unitId = this.containerUnitId(source);
    if (unitId !== null) {
      if (status === 'remove') {
        this.libraryService.clearUnitProgress(userId, material.id, unitId).subscribe();
        return;
      }
      if (!this.trackedItem(source)) {
        this.libraryService
          .addTracked(userId, material, status)
          .pipe(switchMap(() => this.libraryService.setStatus(userId, material.id, status, unitId)))
          .subscribe();
        return;
      }
      this.libraryService.setStatus(userId, material.id, status, unitId).subscribe();
      return;
    }

    // Grouped mediums and container-based materials without a resolvable
    // container have no meaningful material-level tracking scope.
    if (this.isGroupedMedium(source) || this.materialTracksViaContainers(source)) {
      return;
    }

    if (status === 'remove') {
      this.libraryService.removeTracked(userId, material.id).subscribe();
      return;
    }
    if (this.trackedItem(source)) {
      this.libraryService.setStatus(userId, material.id, status).subscribe();
      return;
    }
    this.libraryService.addTracked(userId, material, status).subscribe();
  }
}
