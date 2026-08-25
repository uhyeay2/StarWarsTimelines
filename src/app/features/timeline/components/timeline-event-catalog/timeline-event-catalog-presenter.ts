import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { CharacterService } from '../../../catalog/services/character.service';
import { LocationService } from '../../../catalog/services/location.service';
import { VehicleService } from '../../../catalog/services/vehicle.service';
import { SourceMaterialService } from '../../../catalog/services/source-material.service';
import { TimelineEventsAdminService } from '../../services/timeline-events-admin.service';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { CreateTimelineEventInput } from '../../models/create-timeline-event-input';
import { SourceOptionContext, resolveSourceLinks } from '../../models/event-source-options';
import { editSourceSelectionKeys } from '../../models/source-option-keys';
import { TimelineEvent } from '../../models/timeline-event';
import { runOperation } from '../../../../shared/utils/async-operation';

// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped
@Injectable()
export class TimelineEventCatalogPresenter {
  private readonly characterService = inject(CharacterService);
  private readonly locationService = inject(LocationService);
  private readonly vehicleService = inject(VehicleService);
  private readonly sourceMaterialService = inject(SourceMaterialService);
  private readonly adminService = inject(TimelineEventsAdminService);

  readonly dialogOpen = signal(false);
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

  readonly sortedCharacters = computed(() =>
    [...(this.characterService.characters() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly sortedLocations = computed(() =>
    [...(this.locationService.locations() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly sortedVehicles = computed(() =>
    [...(this.vehicleService.vehicles() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );

  private readonly unitsByMaterial = signal<
    Readonly<Record<number, readonly ApiSourceMaterialUnit[]>>
  >({});

  readonly sourceContext = computed<SourceOptionContext>(() => ({
    materials: this.sourceMaterialService.sourceMaterials() ?? [],
    unitsByMaterial: this.unitsByMaterial(),
  }));

  readonly dialogHeading = computed(() => (this.editingId() === null ? 'Add event' : 'Edit event'));
  readonly dialogSubmitLabel = computed(() => (this.editingId() === null ? 'Add' : 'Save'));

  constructor() {
    effect(() => {
      if (!this.dialogOpen()) {
        return;
      }
      const record: Record<number, readonly ApiSourceMaterialUnit[]> = {};
      for (const material of this.sourceMaterialService.sourceMaterials() ?? []) {
        const cache = this.sourceMaterialService.getUnitCache(material.id);
        cache.fetch();
        record[material.id] = cache.data() ?? [];
      }
      this.unitsByMaterial.set(record);
    });
  }

  /** Opens the dialog in "add" mode with a blank form. */
  openAdd(): void {
    this.actionError.set(null);
    this.resetForm();
    this.editingId.set(null);
    this.dialogOpen.set(true);
  }

  /**
   * Opens the dialog pre-populated with the given event's data for editing.
   * @param item - Timeline event to edit.
   */
  beginEdit(item: TimelineEvent): void {
    this.actionError.set(null);
    this.formError.set(null);
    this.title.set(item.title);
    this.description.set(item.description);
    this.yearStart.set(item.yearStart);
    this.yearEnd.set(item.yearEnd);
    this.sequence.set(item.sequence);
    this.sourceSelection.set(editSourceSelectionKeys(item.sources));
    this.characterSelection.set(this.idsForNames(item.characters, this.sortedCharacters()));
    this.locationSelection.set(this.idsForNames(item.locations, this.sortedLocations()));
    this.vehicleSelection.set(this.idsForNames(item.vehicles, this.sortedVehicles()));
    this.editingId.set(item.id);
    this.dialogOpen.set(true);
  }

  /** Closes the add/edit dialog without saving. */
  cancelDialog(): void {
    this.dialogOpen.set(false);
    this.editingId.set(null);
  }

  /** Validates the form and creates or updates the event accordingly. */
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

  /**
   * Prompts the user to confirm deletion of the given event.
   * @param item - Timeline event to delete.
   */
  requestDelete(item: TimelineEvent): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(item.id);
  }

  /** Dismisses the delete-confirmation prompt. */
  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  /** Deletes the event currently awaiting confirmation. */
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
      operation: this.adminService.deleteEvent(id),
      onSuccess: () => this.confirmDeleteId.set(null),
    });
  }

  private saveCreate(input: CreateTimelineEventInput): void {
    this.formError.set(null);
    runOperation({
      busy: this.saving,
      busyValue: true,
      idleValue: false,
      error: this.formError,
      operation: this.adminService.createEvent(input),
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
      operation: this.adminService.updateEvent(id, input),
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

  private selectionToIds(selection: readonly string[]): number[] {
    return selection.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }

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
