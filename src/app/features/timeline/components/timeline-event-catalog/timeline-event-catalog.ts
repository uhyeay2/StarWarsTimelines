import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterService } from '../../../catalog/services/character.service';
import { LocationService } from '../../../catalog/services/location.service';
import { VehicleService } from '../../../catalog/services/vehicle.service';
import { SourceMaterialService } from '../../../catalog/services/source-material.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { TimelineEvent, EventSource, formatGalacticYears } from '../../models/timeline-event';
import { sourceUnitPathLabel } from '../../../../shared/models/source-material';
import { TimelineEventAddDialog } from '../timeline-event-add-dialog/timeline-event-add-dialog';
import {
  EventCatalogDetails,
  EventCatalogDetailsModel,
} from '../event-catalog-details/event-catalog-details';
import { TimelineEventCatalogPresenter } from './timeline-event-catalog-presenter';

/** One catalog list row enriched with its precomputed details model. */
interface CatalogRow {
  readonly item: TimelineEvent;
  readonly details: EventCatalogDetailsModel;
}

/**
 * Admin catalog tab listing every timeline event with add / edit / delete.
 *
 * The list is read-only for non-admins. Editing reuses the add dialog,
 * prefilled from the stored event; source-material selections round-trip
 * through the same facet-key encodings the Timeline page's advanced filter
 * uses.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-timeline-event-catalog',
  imports: [FormsModule, TimelineEventAddDialog, EventCatalogDetails],
  templateUrl: './timeline-event-catalog.html',
  styleUrl: './timeline-event-catalog.scss',
  providers: [TimelineEventCatalogPresenter],
})
export class TimelineEventCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly characterService = inject(CharacterService);
  private readonly locationService = inject(LocationService);
  private readonly vehicleService = inject(VehicleService);
  private readonly sourceMaterialService = inject(SourceMaterialService);
  private readonly eventsService = inject(TimelineEventsService);
  private readonly presenter = inject(TimelineEventCatalogPresenter);

  readonly searchTerm = signal('');

  readonly items = computed(() => this.eventsService.events() ?? []);
  readonly loading = computed(() => this.eventsService.loading());
  readonly loadError = computed(() => this.eventsService.error());

  // ─── Delegated presenter signals ──────────────────────────────────────

  readonly dialogOpen = this.presenter.dialogOpen;
  readonly editingId = this.presenter.editingId;
  readonly title = this.presenter.title;
  readonly description = this.presenter.description;
  readonly yearStart = this.presenter.yearStart;
  readonly yearEnd = this.presenter.yearEnd;
  readonly sequence = this.presenter.sequence;
  readonly sourceSelection = this.presenter.sourceSelection;
  readonly characterSelection = this.presenter.characterSelection;
  readonly locationSelection = this.presenter.locationSelection;
  readonly vehicleSelection = this.presenter.vehicleSelection;
  readonly saving = this.presenter.saving;
  readonly formError = this.presenter.formError;
  readonly actionError = this.presenter.actionError;
  readonly confirmDeleteId = this.presenter.confirmDeleteId;
  readonly dialogHeading = this.presenter.dialogHeading;
  readonly dialogSubmitLabel = this.presenter.dialogSubmitLabel;
  readonly deletingId = this.presenter.deletingId;
  readonly sortedCharacters = this.presenter.sortedCharacters;
  readonly sortedLocations = this.presenter.sortedLocations;
  readonly sortedVehicles = this.presenter.sortedVehicles;
  readonly sourceContext = this.presenter.sourceContext;

  /** Events ordered chronologically: year span first, then sequence, title. */
  readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const matched = term
      ? this.items().filter(
          (item) =>
            item.title.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term),
        )
      : [...this.items()];
    return matched.sort(
      (a, b) =>
        a.yearStart - b.yearStart || a.sequence - b.sequence || a.title.localeCompare(b.title),
    );
  });

  /** Catalog rows enriched with precomputed details for the expandable grid. */
  readonly rows = computed<readonly CatalogRow[]>(() =>
    this.filteredItems().map((item) => ({
      item,
      details: {
        description: item.description ?? '',
        sources: item.sources.map((source) => ({
          medium: source.medium,
          label: this.sourceLabel(source),
        })),
        entities: [
          { label: 'Characters', text: item.characters.join(', ') },
          { label: 'Locations', text: item.locations.join(', ') },
          { label: 'Vehicles', text: item.vehicles.join(', ') },
        ].filter((entity) => entity.text.length > 0),
      },
    })),
  );

  /** Combined footer message: action error takes precedence over empty search results. */
  readonly footerStatus = computed<{ text: string; css: string; role: string } | null>(() => {
    if (this.actionError()) {
      return { text: this.actionError()!, css: 'form-error', role: 'alert' };
    }
    if (this.searchTerm() && this.filteredItems().length === 0 && this.items().length > 0) {
      return { text: 'No events match your search.', css: 'form-status', role: 'status' };
    }
    return null;
  });

  ngOnInit(): void {
    this.eventsService.getEvents();
    this.characterService.fetchCharacters();
    this.locationService.fetchLocations();
    this.vehicleService.fetchVehicles();
    this.sourceMaterialService.fetchSourceMaterials();
  }

  /** Formats an event's galactic-year label, e.g. `"32 BBY"`. */
  years(item: TimelineEvent): string {
    return formatGalacticYears(item.yearStart, item.yearEnd);
  }
  /** IDs of the events whose details blocks are currently expanded. */
  readonly expandedIds = signal<ReadonlySet<number>>(new Set());

  /**
   * Toggles the inline details block of one catalog row. Rows expand
   * independently — any number can be open at once.
   *
   * Also warms the unit caches for the row's source materials so pinned
   * units render their full container path (e.g. `"Volume 2 - Issue 1"`)
   * as soon as the fetches land.
   */
  toggleDetails(item: TimelineEvent): void {
    for (const source of item.sources) {
      if (source.sourceId !== undefined) {
        this.sourceMaterialService.getUnitCache(source.sourceId).fetch();
      }
    }
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }

  /**
   * Formats one linked source for the details list — the material title,
   * suffixed with the pinned unit's full container path when the link
   * targets a sub-unit (falling back to the flat unit label while the
   * material's unit list is still loading). Redundant container titles
   * (a collection named after its material) are trimmed.
   */
  sourceLabel(source: EventSource): string {
    const unit = source.unit;
    if (!unit) {
      return source.title;
    }
    const units =
      source.sourceId !== undefined
        ? this.sourceMaterialService.getUnitCache(source.sourceId).data()
        : undefined;
    return `${source.title} — ${sourceUnitPathLabel(
      unit,
      (parentId) => units?.find((u) => u.id === parentId),
      { materialTitle: source.title },
    )}`;
  }

  /** Opens the add dialog with a blank form. */
  openAdd(): void {
    this.presenter.openAdd();
  }

  /** Opens the edit dialog prefilled from the stored event. */
  beginEdit(item: TimelineEvent): void {
    this.presenter.beginEdit(item);
  }

  cancelDialog(): void {
    this.presenter.cancelDialog();
  }

  submitDialog(): void {
    this.presenter.submitDialog();
  }

  requestDelete(item: TimelineEvent): void {
    this.presenter.requestDelete(item);
  }

  cancelDelete(): void {
    this.presenter.cancelDelete();
  }

  confirmDelete(): void {
    this.presenter.confirmDelete();
  }
}
