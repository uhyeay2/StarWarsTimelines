import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../services/catalog/catalog.service';
import { TimelineEventsService } from '../../services/timeline-events/timeline-events.service';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
import { CreateTimelineEventInput } from '../../models/catalog/create-timeline-event-input';
import {
  SourceOptionContext,
  editSourceSelectionKeys,
  resolveSourceLinks,
} from '../../models/catalog/event-source-options';
import { TimelineEvent, EventSource, formatGalacticYears } from '../../models/timeline-event';
import { sourceUnitPathLabel } from '../../models/source-material';
import { runOperation } from '../../utils/async-operation';
import { TimelineEventAddDialog } from '../timeline-event-add-dialog/timeline-event-add-dialog';

/**
 * Admin catalog tab listing every timeline event with add / edit / delete.
 *
 * The list is read-only for non-admins. Editing reuses the add dialog,
 * prefilled from the stored event; source-material selections round-trip
 * through the same facet-key encodings the Timeline page's advanced filter
 * uses.
 */
@Component({
  selector: 'app-timeline-event-catalog',
  imports: [FormsModule, TimelineEventAddDialog],
  templateUrl: './timeline-event-catalog.html',
  styleUrl: './timeline-event-catalog.scss',
})
export class TimelineEventCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly catalogService = inject(CatalogService);
  private readonly eventsService = inject(TimelineEventsService);

  readonly searchTerm = signal('');

  readonly items = computed(() => this.eventsService.events() ?? []);
  readonly loading = computed(() => this.eventsService.loading());
  readonly loadError = computed(() => this.eventsService.error());

  /** Lookup options sorted by name so the dropdowns are easy to scan. */
  readonly sortedCharacters = computed(() =>
    [...(this.catalogService.characters() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly sortedLocations = computed(() =>
    [...(this.catalogService.locations() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly sortedVehicles = computed(() =>
    [...(this.catalogService.vehicles() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );

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

  // ─── Source option tree ────────────────────────────────────────────────

  /**
   * Unit lists per material, mirrored out of the catalog's per-material
   * caches into one plain record so the dialog's computed tree stays
   * reactive as unit fetches land.
   */
  private readonly unitsByMaterial = signal<
    Readonly<Record<number, readonly ApiSourceMaterialUnit[]>>
  >({});

  /** Catalog data backing the dialog's nested source-material dropdown. */
  readonly sourceContext = computed<SourceOptionContext>(() => ({
    materials: this.catalogService.sourceMaterials() ?? [],
    unitsByMaterial: this.unitsByMaterial(),
  }));

  constructor() {
    // While the dialog is open, fetch every material's units and mirror the
    // per-material caches into `unitsByMaterial`. `getUnitCache` creates the
    // cache on first access; `.fetch()` starts the load (reading `.data()`
    // alone never triggers one), and reading `.data()` inside the effect
    // tracks it, so late-arriving responses re-run the mirror.
    effect(() => {
      if (!this.dialogOpen()) {
        return;
      }
      const record: Record<number, readonly ApiSourceMaterialUnit[]> = {};
      for (const material of this.catalogService.sourceMaterials() ?? []) {
        const cache = this.catalogService.getUnitCache(material.id);
        cache.fetch();
        record[material.id] = cache.data() ?? [];
      }
      this.unitsByMaterial.set(record);
    });
  }

  ngOnInit(): void {
    this.eventsService.getEvents();
    this.catalogService.fetchCharacters();
    this.catalogService.fetchLocations();
    this.catalogService.fetchVehicles();
    this.catalogService.fetchSourceMaterials();
  }

  // ─── Dialog state ──────────────────────────────────────────────────────

  /** Whether the add/edit dialog is open. */
  readonly dialogOpen = signal(false);

  /** ID of the event being edited, or `null` while adding. */
  readonly editingId = signal<number | null>(null);

  readonly title = signal('');
  readonly description = signal('');
  readonly yearStart = signal<number | null>(null);
  readonly yearEnd = signal<number | null>(null);
  readonly sequence = signal<number | null>(null);
  readonly sourceSelection = signal<readonly string[]>([]);
  readonly characterSelection = signal<readonly string[]>([]);
  readonly locationSelection = signal<readonly string[]>([]);
  readonly vehicleSelection = signal<readonly string[]>([]);

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly dialogHeading = computed(() => (this.editingId() === null ? 'Add event' : 'Edit event'));
  readonly dialogSubmitLabel = computed(() => (this.editingId() === null ? 'Add' : 'Save'));

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
        this.catalogService.getUnitCache(source.sourceId).fetch();
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
        ? this.catalogService.getUnitCache(source.sourceId).data()
        : undefined;
    return `${source.title} — ${sourceUnitPathLabel(
      unit,
      (parentId) => units?.find((u) => u.id === parentId),
      { materialTitle: source.title },
    )}`;
  }
  /** Opens the add dialog with a blank form. */
  openAdd(): void {
    this.actionError.set(null);
    this.resetForm();
    this.editingId.set(null);
    this.dialogOpen.set(true);
  }

  /** Opens the edit dialog prefilled from the stored event. */
  beginEdit(item: TimelineEvent): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.title.set(item.title);
    this.description.set(item.description);
    this.yearStart.set(item.yearStart);
    this.yearEnd.set(item.yearEnd);
    this.sequence.set(item.sequence);
    // Exact tree values (not the Timeline page's broader filter keys) so a
    // pinned episode stays pinned to that episode across edit/save cycles.
    this.sourceSelection.set(editSourceSelectionKeys(item.sources));
    this.characterSelection.set(this.idsForNames(item.characters, this.sortedCharacters()));
    this.locationSelection.set(this.idsForNames(item.locations, this.sortedLocations()));
    this.vehicleSelection.set(this.idsForNames(item.vehicles, this.sortedVehicles()));
    this.editingId.set(item.id);
    this.dialogOpen.set(true);
  }

  cancelDialog(): void {
    this.dialogOpen.set(false);
    this.editingId.set(null);
  }

  submitDialog(): void {
    if (this.saving()) {
      return;
    }
    const title = this.title().trim();
    if (!title) {
      this.formError.set('A title is required.');
      return;
    }
    const links = resolveSourceLinks(this.sourceContext(), this.sourceSelection());
    if (links.length === 0) {
      this.formError.set('Link at least one source material.');
      return;
    }
    const yearStartValue = this.yearStart();
    if (yearStartValue === null) {
      this.formError.set('A year start is required.');
      return;
    }

    const input: CreateTimelineEventInput = {
      title,
      description: this.description(),
      yearStart: yearStartValue,
      yearEnd: this.yearEnd() ?? yearStartValue,
      sequence: this.sequence() ?? 0,
      sourceMaterials: links,
      characterIds: this.selectionToIds(this.characterSelection()),
      locationIds: this.selectionToIds(this.locationSelection()),
      vehicleIds: this.selectionToIds(this.vehicleSelection()),
    };

    const editing = this.editingId();
    if (editing !== null) {
      this.saveUpdate(editing, input);
    } else {
      this.saveCreate(input);
    }
  }

  requestDelete(item: TimelineEvent): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(item.id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id || this.deletingId()) {
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.deletingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.eventsService.deleteEvent(id),
      onSuccess: () => this.confirmDeleteId.set(null),
    });
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private saveCreate(input: CreateTimelineEventInput): void {
    this.formError.set(null);
    runOperation({
      busy: this.saving,
      busyValue: true,
      idleValue: false,
      error: this.formError,
      operation: this.eventsService.createEvent(input),
      onSuccess: () => {
        this.resetForm();
        this.dialogOpen.set(false);
      },
    });
  }

  private saveUpdate(id: number, input: CreateTimelineEventInput): void {
    this.formError.set(null);
    runOperation({
      busy: this.saving,
      busyValue: true,
      idleValue: false,
      error: this.formError,
      operation: this.eventsService.updateEvent(id, input),
      onSuccess: () => {
        this.resetForm();
        this.dialogOpen.set(false);
        this.editingId.set(null);
      },
    });
  }

  private resetForm(): void {
    this.title.set('');
    this.description.set('');
    this.yearStart.set(null);
    this.yearEnd.set(null);
    this.sequence.set(null);
    this.sourceSelection.set([]);
    this.characterSelection.set([]);
    this.locationSelection.set([]);
    this.vehicleSelection.set([]);
    this.formError.set(null);
  }

  /** Maps selected filter-tree values (`"3"`) to numeric ids. */
  private selectionToIds(selection: readonly string[]): number[] {
    return selection.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }

  /**
   * Resolves display names to catalog ids for edit prefill — the domain
   * event model carries linked-entity names, not ids.
   */
  private idsForNames(
    names: readonly string[],
    options: readonly { id: number; name: string }[],
  ): string[] {
    const byName = new Map(options.map((o) => [o.name, o.id]));
    return names
      .map((name) => byName.get(name))
      .filter((id): id is number => id !== undefined)
      .map(String);
  }
}
