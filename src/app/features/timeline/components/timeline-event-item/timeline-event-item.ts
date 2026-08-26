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

import {
  ChangeDetectionStrategy,
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
import { sourceUnitDetail } from '../../../../shared/models/source-material';
import { isContainerOrCollectionUnit } from '../../../../shared/models/unit-type';
import { TimelineEvent } from '../../models/timeline-event';
import { TrackSelectOption } from '../../../../shared/models/tracking-selection';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import { TrackingDropdownPresenter } from './timeline-event-item-presenter';

/** The facet key type for toggleable filter chips. */
export type ToggleableFacetKey = FacetKey;

/** Event payload emitted when a facet chip is toggled on an event card. */
export interface ToggleFacetEvent {
  /** The facet category (sources, locations, characters, vehicles). */
  key: ToggleableFacetKey;
  /** The values to add/remove from the filter. */
  values: readonly string[];
}

/** Precomputed render model for one depicting source material. */
interface SourceRow {
  /** Stable @for track key and tracking lookup key. */
  readonly key: number | string;
  /** Source display title (used in the dropdown aria-label). */
  readonly title: string;
  /** The original event source (passed back on tracking changes). */
  readonly source: EventSource;
  /** Plain-text pinned-unit detail, or null when suppressed. */
  readonly unitText: string | null;
  /** Dropdown state when tracking UI should render, else null. */
  readonly dropdown: {
    readonly options: readonly TrackSelectOption[];
    readonly status: TrackingStatus | null;
  } | null;
}

/** One non-empty facet group in the expanded details section. */
interface DetailGroup {
  readonly key: ToggleableFacetKey;
  readonly label: string;
  readonly values: readonly string[];
  readonly selected: ReadonlySet<string>;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-timeline-event-item',
  imports: [],
  templateUrl: './timeline-event-item.html',
  styleUrl: './timeline-event-item.scss',
  providers: [TrackingDropdownPresenter],
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

  /** Function to format the event's galactic date or range. */
  readonly formatDate = formatGalacticYears;

  /**
   * Detail string for the source's pinned unit alone ("Episode 5: Title").
   * Container scope ("Season 2") is intentionally excluded — containers
   * surface as clickable filter chips instead of text.
   *
   * @param source  The event source.
   * @returns The formatted detail, or `undefined` when no unit is pinned.
   */
  sourceDetail(source: EventSource): string | undefined {
    const unit = source.unit;
    if (unit === undefined) {
      return undefined;
    }
    return sourceUnitDetail(unit);
  }

  /**
   * Whether the source's pinned unit is itself a container nested inside
   * another container (e.g. a Book within a collection). Such units render
   * as filter chips, so their plain-text detail span is suppressed.
   *
   * @param source  The event source.
   * @returns `true` when the pinned unit renders as a chip.
   */
  isNestedContainerUnit(source: EventSource): boolean {
    const unit = source.unit;
    return (
      unit !== undefined && unit.parentUnitId != null && isContainerOrCollectionUnit(unit.unitType)
    );
  }

  // ─── Outputs ───────────────────────────────────────────────────────────

  /** Emitted when a facet chip is toggled. */
  readonly toggleFacet = output<ToggleFacetEvent>();

  // ─── Internal state ────────────────────────────────────────────────────

  /** Whether the expanded details section is visible. */
  readonly detailsOpen = signal(false);

  // ─── Pre-computed selection sets (avoids .includes() in @for loops) ────

  readonly selectedLocationSet = computed(() => new Set(this.selectedLocations()));
  readonly selectedCharacterSet = computed(() => new Set(this.selectedCharacters()));
  readonly selectedVehicleSet = computed(() => new Set(this.selectedVehicles()));
  readonly selectedSourceSet = computed(() => new Set(this.selectedSources()));

  // ─── Pre-computed per-source tracking state ───────────────────────────

  readonly sourceTrackingData = computed(() => {
    const sources = this.event().sources;
    const map = new Map<
      string | number,
      {
        showTracking: boolean;
        options: readonly TrackSelectOption[];
        status: TrackingStatus | null;
      }
    >();
    for (const source of sources) {
      const key = this.trackSource(source);
      map.set(key, {
        showTracking: this.showTracking(source),
        options: this.trackingOptions(source),
        status: this.currentStatus(source),
      });
    }
    return map;
  });

  /** Render rows per depicting source, with unit text and dropdown precomputed. */
  readonly sourceRows = computed<readonly SourceRow[]>(() =>
    this.event().sources.map((source) => {
      const key = this.trackSource(source);
      const detail = this.sourceDetail(source);
      const nested = this.isNestedContainerUnit(source);
      const data = this.sourceTrackingData().get(key);
      return {
        key,
        title: source.title,
        source,
        unitText: !nested && detail !== undefined ? detail : null,
        dropdown:
          data !== undefined && data.showTracking
            ? { options: data.options, status: data.status }
            : null,
      };
    }),
  );

  /** Non-empty facet groups rendered inside the expanded details section. */
  readonly detailGroups = computed<readonly DetailGroup[]>(() => {
    const item = this.event();
    return (
      [
        {
          key: 'locations',
          label: 'Locations',
          values: item.locations,
          selected: this.selectedLocationSet(),
        },
        {
          key: 'characters',
          label: 'Characters',
          values: item.characters,
          selected: this.selectedCharacterSet(),
        },
        {
          key: 'vehicles',
          label: 'Vehicles',
          values: item.vehicles,
          selected: this.selectedVehicleSet(),
        },
      ] as const
    ).filter((group) => group.values.length > 0);
  });

  // ─── Tracking state ────────────────────────────────────────────────────

  private readonly presenter = inject(TrackingDropdownPresenter);

  /** The signed-in user, or `null` when anonymous (dropdown hidden). */
  readonly currentUser = this.presenter.currentUser;

  /** @for key helper */
  trackSource(source: EventSource): number | string {
    return this.presenter.trackSource(source);
  }

  /** The tracked library item for this source material, or null. */
  trackedItem(source: EventSource) {
    return this.presenter.trackedItem(source);
  }

  /** Whether this source's medium tracks at season/volume/book group level. */
  isGroupedMedium(source: EventSource): boolean {
    return this.presenter.isGroupedMedium(source);
  }

  /** The Season/Volume/Book container unit ID for grouped sources. */
  containerUnitId(source: EventSource): number | null {
    return this.presenter.containerUnitId(source);
  }

  /** Whether the tracking dropdown should be rendered for this source. */
  showTracking(source: EventSource): boolean {
    return this.presenter.showTracking(source);
  }

  /** Select options: statuses, plus 'Remove From Library' once tracked. */
  trackingOptions(source: EventSource): readonly TrackSelectOption[] {
    return this.presenter.trackingOptions(source);
  }

  /** The currently selected tracking status, or `null` (shows "Track…"). */
  currentStatus(source: EventSource): TrackingStatus | null {
    return this.presenter.currentStatus(source);
  }

  ngOnInit(): void {
    this.presenter.prefetch(this.event().sources);
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
    return chip.values.every((value) => this.selectedSourceSet().has(value));
  }

  /**
   * Handles a tracking status change from one source's dropdown.
   */
  onTrackChange(changeEvent: Event, source: EventSource): void {
    this.presenter.onTrackChange(changeEvent, source);
  }
}
