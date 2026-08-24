import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
import { CANON_TYPES, CanonType } from '../../models/canon-type';
import { CreateSourceMaterialUnitInput } from '../../models/catalog/create-source-material-unit-input';
import { MEDIA, Medium } from '../../models/medium';
import { UNIT_TYPES, UnitType, isContainerOrCollectionUnit } from '../../models/unit-type';
import { TrackingStatus } from '../../models/tracking-status';
import {
  findTrackedItem,
  groupTrackingStatus,
  groupUnitIsTracked,
  materialTrackingStatus,
  trackSelectOptions,
} from '../../models/tracking-selection';
import { AuthService } from '../../services/auth/auth.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';
import { LibraryItem } from '../../models/library-item';
import { TrackSelect } from '../track-select/track-select';
import { UnitEditForm, ParentUnitOption } from '../unit-edit-form/unit-edit-form';
import { runOperation } from '../../utils/async-operation';
import { addedTo, removedFrom, removedWithPrefix, toggledIn } from '../../utils/set-operations';

interface UnitKey {
  materialId: number;
  unitId: number;
}

/** Returns true for container unit types that act as group headers. */
function isContainerType(unitType: UnitType): boolean {
  return unitType === 'Season' || unitType === 'Volume' || unitType === 'Book';
}

/** A season/volume/book group rendered in the expanded views. */
interface MaterialDisplayGroup {
  /** Stable key used for expand/collapse state. */
  expandKey: string;
  /** The Season/Volume/Book container unit id, or null for ungrouped leftovers. */
  containerId: number | null;
  /** Header label for the group. */
  label: string;
  /** Child units (episodes/issues/chapters) belonging to the group. */
  units: readonly ApiSourceMaterialUnit[];
}

@Component({
  selector: 'app-source-material-catalog',
  imports: [FormsModule, TrackSelect, UnitEditForm],
  templateUrl: './source-material-catalog.html',
  styleUrl: './source-material-catalog.scss',
})
export class SourceMaterialCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly catalogService = inject(CatalogService);
  private readonly libraryService = inject(LibraryService);
  private readonly authService = inject(AuthService);

  readonly media = MEDIA;
  readonly canonTypes = CANON_TYPES;
  readonly unitTypes = UNIT_TYPES;

  readonly searchTerm = signal('');

  readonly materials = computed(() => this.catalogService.sourceMaterials() ?? []);
  readonly loading = computed(() => this.catalogService.sourceMaterialsLoading());
  readonly loadError = computed(() => this.catalogService.sourceMaterialsError());

  readonly filteredMaterials = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.materials();
    }
    return this.materials().filter((m) => m.title.toLowerCase().includes(term));
  });

  readonly expandedMedia = signal(new Set<Medium>([...MEDIA]));

  readonly mediumGroups = computed(() => {
    const materials = this.filteredMaterials();
    const map = new Map<Medium, ApiSourceMaterial[]>();
    for (const m of materials) {
      let list = map.get(m.medium);
      if (!list) {
        list = [];
        map.set(m.medium, list);
      }
      list.push(m);
    }
    return MEDIA
      .filter((medium) => map.has(medium))
      .map((medium) => ({ medium, materials: map.get(medium)! }));
  });

  readonly newTitle = signal('');
  readonly newMedium = signal<Medium>('Movie');
  readonly newCanonType = signal<CanonType>('Canon');
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  readonly editId = signal<number | null>(null);
  readonly editTitle = signal('');
  readonly editMedium = signal<Medium>('Movie');
  readonly editCanonType = signal<CanonType>('Canon');
  readonly savingId = signal<number | null>(null);

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly expandedMaterialId = signal<number | null>(null);
  /** Materials the user manually collapsed while they would otherwise be auto-expanded. */
  readonly userCollapsedIds = signal(new Set<number>());
  readonly unitsByMaterial = signal<Readonly<Record<number, readonly ApiSourceMaterialUnit[]>>>({});
  readonly unitsLoading = signal(false);
  readonly unitsError = signal<string | null>(null);

  readonly expandedSeasonKeys = signal(new Set<string>());

  readonly materialsWithUnits = signal(new Set<number>());

  readonly hasUnits = computed(() => {
    const known = this.materialsWithUnits();
    const result: Record<number, boolean> = {};
    for (const material of this.materials()) {
      result[material.id] = known.has(material.id);
    }
    return result;
  });

  readonly displayStrategy = computed(() => {
    const result: Record<number, 'grouped-season' | 'grouped-volume' | 'flat'> = {};
    for (const material of this.materials()) {
      result[material.id] = this.getDisplayStrategy(material.medium);
    }
    return result;
  });

  // ─── Tracking state (non-admin view) ──────────────────────────────────────

  readonly currentUser = this.authService.currentUser;

  readonly trackedItems = computed(() => this.libraryService.items());

  readonly trackedItemIds = computed(() =>
    new Set(this.trackedItems().map((item) => item.id)),
  );

  /** Returns the tracked item for a material ID, or null if not tracked. */
  getTrackedItem(materialId: number): LibraryItem | null {
    return findTrackedItem(this.trackedItems(), materialId);
  }

  /**
   * Determines the tracking status options for a material.
   * Includes 'Remove From Library' when the material is already tracked.
   */
  getTrackingOptions(materialId: number): readonly string[] {
    return trackSelectOptions(this.getTrackedItem(materialId) !== null);
  }

  /**
   * Determines the tracking status options for a specific group (season/volume) unit.
   * Includes 'Remove From Library' when that specific unit is already tracked.
   */
  getGroupTrackingOptions(materialId: number, unitId: number): readonly string[] {
    return trackSelectOptions(groupUnitIsTracked(this.getTrackedItem(materialId), unitId));
  }

  /**
   * Returns the currently tracked status for a material, or null when untracked.
   * Used to preselect the material-level tracking dropdown.
   */
  getMaterialCurrentStatus(materialId: number): TrackingStatus | null {
    return materialTrackingStatus(this.getTrackedItem(materialId));
  }

  /**
   * Returns the currently tracked status for a group (season/volume) unit,
   * or null when neither the unit nor any of its child units is tracked
   * (showing the "Track..." placeholder). Derivation is scoped to this
   * container's children only so sibling seasons never influence the result.
   */
  getGroupCurrentStatus(materialId: number, unitId: number): TrackingStatus | null {
    return groupTrackingStatus(this.getTrackedItem(materialId), unitId);
  }

  readonly newUnitType = signal<UnitType>('Episode');
  readonly newUnitParent = signal<number | null>(null);
  readonly newUnitNumber = signal<number | null>(null);
  readonly newUnitTitle = signal('');
  readonly addingUnitFor = signal<number | null>(null);
  readonly unitAddError = signal<string | null>(null);

  readonly unitEditKey = signal<UnitKey | null>(null);
  readonly unitEditType = signal<UnitType>('Episode');
  readonly unitEditParent = signal<number | null>(null);
  readonly unitEditNumber = signal<number | null>(null);
  readonly unitEditTitle = signal('');
  readonly unitSavingKey = signal<UnitKey | null>(null);

  readonly unitConfirmDeleteKey = signal<UnitKey | null>(null);
  readonly unitDeletingKey = signal<UnitKey | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly probeLoading = signal(true);

  constructor() {
    this.catalogService.fetchSourceMaterials();
    this.autoProbe();
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.libraryService.getTracked(user.id).subscribe();
    }
  }

  /** Initiates the unit probe. Call after materials are loaded. */
  probeUnitPresence(): void {
    this.probeLoading.set(true);
    this.catalogService.probeUnitPresence();
  }

  /** Synchronously completes the probe after HTTP requests are flushed. */
  completeProbe(): void {
    const withUnits = this.catalogService.checkProbeResults();
    if (withUnits !== null) {
      this.materialsWithUnits.set(new Set(withUnits));
      this.probeLoading.set(false);
    }
  }

  private autoProbe(): void {
    const poll = setInterval(() => {
      if (this.catalogService.sourceMaterialsLoading()) {
        return;
      }
      const materials = this.catalogService.sourceMaterials();
      if (!materials || materials.length === 0) {
        clearInterval(poll);
        this.probeLoading.set(false);
        return;
      }
      clearInterval(poll);
      this.probeUnitPresence();
      for (const m of materials) {
        this.pollMaterialProbe(m.id);
      }
    }, 50);
  }

  private pollMaterialProbe(materialId: number): void {
    const probePoll = setInterval(() => {
      const cache = this.catalogService.getUnitCache(materialId);
      if (cache.loading()) {
        return;
      }
    clearInterval(probePoll);
    const units = cache.data();
    if (units && units.length > 0) {
      this.materialsWithUnits.update((set) => addedTo(set, materialId));
      this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
    }
      if (!this.catalogService.sourceMaterialsLoading()) {
        const allProbed = this.materials().every(
          (m) => this.catalogService.getUnitCache(m.id).loading() === false,
        );
        if (allProbed) {
          this.probeLoading.set(false);
        }
      }
    }, 50);
  }

  add(): void {
    if (this.adding()) {
      return;
    }
    const title = this.newTitle().trim();
    if (!title) {
      this.addError.set('A title is required.');
      return;
    }

    this.addError.set(null);
    runOperation({
      busy: this.adding,
      busyValue: true,
      idleValue: false,
      error: this.addError,
      operation: this.catalogService.createSourceMaterial({
        title,
        medium: this.newMedium(),
        canonType: this.newCanonType(),
      }),
      onSuccess: (created) => {
        if (created) {
          this.newTitle.set('');
        }
      },
    });
  }

  beginEdit(material: ApiSourceMaterial): void {
    this.actionError.set(null);
    this.editId.set(material.id);
    this.editTitle.set(material.title);
    this.editMedium.set(material.medium);
    this.editCanonType.set(material.canonType);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editTitle.set('');
  }

  saveEdit(): void {
    const id = this.editId();
    if (!id || this.savingId()) {
      return;
    }
    const title = this.editTitle().trim();
    if (!title) {
      this.actionError.set('A title is required.');
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.savingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.catalogService.updateSourceMaterial(id, {
        title,
        medium: this.editMedium(),
        canonType: this.editCanonType(),
      }),
      onSuccess: (updated) => {
        if (updated) {
          this.editId.set(null);
          this.editTitle.set('');
        }
      },
    });
  }

  requestDelete(material: ApiSourceMaterial): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(material.id);
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
      operation: this.catalogService.deleteSourceMaterial(id),
      onSuccess: () => {
        this.confirmDeleteId.set(null);
        this.expandedMaterialId.set(null);
        this.userCollapsedIds.set(new Set());
        this.expandedSeasonKeys.set(new Set());
        this.unitsByMaterial.set({});
      },
    });
  }

  toggleUnits(materialId: number): void {
    if (this.shouldShowUnits(materialId)) {
      if (this.expandedMaterialId() === materialId) {
        this.expandedMaterialId.set(null);
      } else {
        // Auto-expanded material: remember the user collapsed it.
        this.userCollapsedIds.update((set) => new Set(set).add(materialId));
      }
      this.clearSeasonKeys(materialId);
      return;
    }
    this.userCollapsedIds.update((set) => removedFrom(set, materialId));
    this.expandedMaterialId.set(materialId);
    this.loadUnits(materialId);
  }

  /** Returns true if the material's unit section is currently visible. */
  isMaterialExpanded(materialId: number): boolean {
    return this.shouldShowUnits(materialId);
  }

  private clearSeasonKeys(materialId: number): void {
    this.expandedSeasonKeys.update(removedWithPrefix(`${materialId}:`));
  }

  addUnit(materialId: number): void {
    if (this.addingUnitFor()) {
      return;
    }
    const input = this.buildUnitInput(
      this.newUnitType(),
      this.newUnitParent(),
      this.newUnitNumber(),
      this.newUnitTitle(),
    );
    if (!input) {
      this.unitAddError.set('A unit number of at least one is required.');
      return;
    }

    this.unitAddError.set(null);
    runOperation({
      busy: this.addingUnitFor,
      busyValue: materialId,
      idleValue: null,
      error: this.unitAddError,
      operation: this.catalogService.createSourceMaterialUnit(materialId, input),
      onSuccess: (created) => {
        if (created) {
          this.newUnitType.set('Episode');
          this.newUnitParent.set(null);
          this.newUnitNumber.set(null);
          this.newUnitTitle.set('');
          this.materialsWithUnits.update((set) => addedTo(set, materialId));
          this.loadUnits(materialId);
        }
      },
    });
  }

  beginUnitEdit(materialId: number, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitEditKey.set({ materialId, unitId: unit.id });
    this.unitEditType.set(unit.unitType);
    this.unitEditParent.set(unit.parentUnitId);
    this.unitEditNumber.set(unit.number);
    this.unitEditTitle.set(unit.title ?? '');
  }

  cancelUnitEdit(): void {
    this.unitEditKey.set(null);
    this.unitEditTitle.set('');
  }

  saveUnitEdit(): void {
    const key = this.unitEditKey();
    if (!key || this.unitSavingKey()) {
      return;
    }
    const input = this.buildUnitInput(
      this.unitEditType(),
      this.unitEditParent(),
      this.unitEditNumber(),
      this.unitEditTitle(),
    );
    if (!input) {
      this.actionError.set('A unit number of at least one is required.');
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.unitSavingKey,
      busyValue: key,
      idleValue: null,
      error: this.actionError,
      operation: this.catalogService.updateSourceMaterialUnit(key.materialId, key.unitId, input),
      onSuccess: (updated) => {
        if (updated) {
          this.unitEditKey.set(null);
          this.unitEditTitle.set('');
          this.loadUnits(key.materialId);
        }
      },
    });
  }

  requestUnitDelete(materialId: number, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitConfirmDeleteKey.set({ materialId, unitId: unit.id });
  }

  cancelUnitDelete(): void {
    this.unitConfirmDeleteKey.set(null);
  }

  confirmUnitDelete(): void {
    const key = this.unitConfirmDeleteKey();
    if (!key || this.unitDeletingKey()) {
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.unitDeletingKey,
      busyValue: key,
      idleValue: null,
      error: this.actionError,
      operation: this.catalogService.deleteSourceMaterialUnit(key.materialId, key.unitId),
      onSuccess: () => {
        this.unitConfirmDeleteKey.set(null);
        this.loadUnits(key.materialId);
      },
    });
  }

  unitLabel(unit: ApiSourceMaterialUnit): string {
    const title = unit.title ? ` — ${unit.title}` : '';
    return `${unit.number}${title}`;
  }

  readonly groupUnitLabel = (unit: ApiSourceMaterialUnit): string => {
    return unit.title ?? `${unit.unitType} ${unit.number}`;
  };

  /**
   * Candidate container units (seasons/volumes/books/collections) a unit of
   * the given material can nest inside, for the parent dropdowns.
   */
  parentOptionsFor(materialId: number): readonly ParentUnitOption[] {
    const units = this.unitsByMaterial()[materialId] ?? [];
    return units
      .filter((u) => isContainerOrCollectionUnit(u.unitType))
      .map((u) => ({ id: u.id, label: this.groupUnitLabel(u) }));
  }

  /**
   * Builds the season/volume/book groups shown in the expanded views.
   *
   * Uses explicit container units (Season/Volume/Book) as group headers,
   * matching child units by `parentUnitId`. Units whose parent link is
   * missing or dangling are collected into a trailing "ungrouped" group.
   * Materials without any container units show their units flat.
   */
  getDisplayGroups(materialId: number): readonly MaterialDisplayGroup[] {
    const units = this.unitsByMaterial()[materialId] ?? [];
    const containers = units.filter((u) => isContainerType(u.unitType));
    const details = units.filter(
      (u) => !isContainerType(u.unitType) && u.unitType !== 'Collection',
    );

    if (containers.length === 0) {
      if (details.length === 0) {
        return [];
      }
      const noun = details.some((u) => u.unitType === 'Issue')
        ? 'Volume'
        : details.some((u) => u.unitType === 'Episode')
          ? 'Season'
          : undefined;
      return [
        {
          expandKey: 'ungrouped',
          containerId: null,
          label: noun === undefined ? 'All units' : `All ${noun}s`,
          units: [...units].sort((a, b) => a.number - b.number),
        },
      ];
    }

    const containerIds = new Set(containers.map((c) => c.id));
    const groups: MaterialDisplayGroup[] = containers
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((container) => ({
        expandKey: String(container.id),
        containerId: container.id,
        label: this.groupUnitLabel(container),
        units: details.filter((u) => u.parentUnitId === container.id),
      }));

    const orphans = details.filter(
      (u) => u.parentUnitId === null || u.parentUnitId === undefined ||
        !containerIds.has(u.parentUnitId),
    );
    if (orphans.length > 0) {
      groups.push({ expandKey: 'ungrouped', containerId: null, label: 'Ungrouped', units: orphans });
    }
    return groups;
  }

  /** Returns true if the material should show units in expanded view. */
  shouldShowUnits(materialId: number): boolean {
    if (this.userCollapsedIds().has(materialId)) {
      return false;
    }
    return this.expandedMaterialId() === materialId || this.isAutoExpanded(materialId);
  }

  /**
   * For non-admins, auto-expand shows/comics so season/volume groups and their
   * tracking dropdowns are visible without an extra click.
   */
  readonly autoExpandedMaterialIds = computed(() => {
    if (this.isAdmin()) return new Set<number>();
    const ids = new Set<number>();
    for (const [mid, unitList] of Object.entries(this.unitsByMaterial())) {
      if (this.hasDisplayGroups(unitList)) {
        ids.add(Number(mid));
      }
    }
    return ids;
  });

  /** Returns true if the material's units render as season/volume/book groups. */
  private hasDisplayGroups(units: readonly ApiSourceMaterialUnit[]): boolean {
    return units.some((u) => isContainerType(u.unitType));
  }

  private isGroupedMedium(materialId: number): boolean {
    const material = this.materials().find((m) => m.id === materialId);
    return (
      material?.medium === 'Comic' ||
      material?.medium === 'Live Action Show' ||
      material?.medium === 'Animated Show'
    );
  }

  /**
   * Returns true when the material's units nest inside container units
   * (e.g. chapters inside books), meaning tracking happens per container
   * rather than at the title level.
   */
  materialTracksViaContainers(materialId: number): boolean {
    const units = this.catalogService.getUnitCache(materialId).data() ?? [];
    if (units.length === 0) {
      return false;
    }
    const ids = new Set(units.map((u) => u.id));
    return units.some((u) => u.parentUnitId != null && ids.has(u.parentUnitId));
  }

  isAutoExpanded(materialId: number): boolean {
    return this.autoExpandedMaterialIds().has(materialId);
  }

  /**
   * Handles a tracking status change for a material (non-unit level).
   * If status is 'remove', removes the item from the library;
   * otherwise, adds or updates the tracked item with the given status.
   */
  onTrackMaterial(materialId: number, status: string): void {
    this.doTrackMaterial(materialId, status);
  }

  /**
   * Handles a tracking status change for a Season/Volume unit within a material.
   * If status is 'remove', removes the unit's progress;
   * otherwise, sets the unit's status.
   */
  onTrackGroupUnit(materialId: number, unitId: number, status: string): void {
    this.doTrackGroupUnit(materialId, unitId, status);
  }

  private doTrackMaterial(materialId: number, status: string): void {
    const userId = this.currentUser()?.id;
    if (!userId) return;

    if (status === 'remove' || status === '') {
      this.libraryService
        .removeTracked(userId, materialId)
        .subscribe();
      return;
    }

    const material = this.materials().find((m) => m.id === materialId);
    if (!material) return;

    if (this.getTrackedItem(materialId)) {
      this.libraryService
        .setStatus(userId, materialId, status as TrackingStatus)
        .subscribe();
      return;
    }

    this.libraryService
      .addTracked(userId, { id: material.id, title: material.title, medium: material.medium }, status as TrackingStatus)
      .subscribe();
  }

  private doTrackGroupUnit(materialId: number, unitId: number, status: string): void {
    const userId = this.currentUser()?.id;
    if (!userId) return;

    if (status === 'remove' || status === '') {
      // Clearing a season/volume removes only that unit's progress (and its
      // children); the backend drops the whole library entry if nothing else
      // in the material is still tracked.
      this.libraryService
        .clearUnitProgress(userId, materialId, unitId)
        .subscribe();
      return;
    }

    // Tracking a season/volume on a show that is not in the library yet:
    // create the library entry first, then record the group-unit progress.
    const trackedItem = this.getTrackedItem(materialId);
    if (!trackedItem) {
      const material = this.materials().find((m) => m.id === materialId);
      if (material) {
        this.libraryService
          .addTracked(userId, { id: material.id, title: material.title, medium: material.medium }, status as TrackingStatus)
          .pipe(switchMap(() => this.libraryService.setStatus(userId, materialId, status as TrackingStatus, unitId)))
          .subscribe();
        return;
      }
    }

    this.libraryService
      .setStatus(userId, materialId, status as TrackingStatus, unitId)
      .subscribe();
  }

  seasonKey(materialId: number, groupKey: number | string | null): string {
    return `${materialId}:${groupKey}`;
  }

  isSeasonExpanded(materialId: number, groupKey: number | string | null): boolean {
    return this.expandedSeasonKeys().has(this.seasonKey(materialId, groupKey));
  }

  toggleSeason(materialId: number, groupKey: number | string | null): void {
    const key = this.seasonKey(materialId, groupKey);
    this.expandedSeasonKeys.update((set) => toggledIn(set, key));
  }

  isMediumExpanded(medium: Medium): boolean {
    return this.expandedMedia().has(medium);
  }

  toggleMedium(medium: Medium): void {
    this.expandedMedia.update((set) => toggledIn(set, medium));
  }

  private getDisplayStrategy(medium: Medium): 'grouped-season' | 'grouped-volume' | 'flat' {
    switch (medium) {
      case 'Live Action Show':
      case 'Animated Show':
        return 'grouped-season';
      case 'Comic':
        return 'grouped-volume';
      default:
        return 'flat';
    }
  }

  private buildUnitInput(
    unitType: UnitType,
    parentUnitId: number | null,
    number: number | null,
    title: string,
  ): CreateSourceMaterialUnitInput | null {
    if (number === null || number < 1) {
      return null;
    }
    const trimmedTitle = title.trim();
    return {
      unitType,
      parentUnitId,
      number,
      title: trimmedTitle || null,
    };
  }

  private loadUnits(materialId: number): void {
    this.unitsLoading.set(true);
    this.unitsError.set(null);
    const cache = this.catalogService.getUnitCache(materialId);
    cache.fetch();
    // If data is already cached (e.g. from the probe), sync immediately.
    if (!cache.loading() && cache.data() !== null) {
      this.unitsLoading.set(false);
      const units = cache.data() ?? [];
      this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
      if (units.length > 0) {
        this.materialsWithUnits.update((set) => addedTo(set, materialId));
      }
      if (units.length === 0) {
        this.materialsWithUnits.update((set) => removedFrom(set, materialId));
        this.collapseMaterial(materialId);
      }
      return;
    }
    // Poll until the fetch completes, then sync the result into the local map.
    const poll = setInterval(() => {
      if (!cache.loading()) {
        clearInterval(poll);
        this.unitsLoading.set(false);
        if (cache.error()) {
          this.unitsError.set(cache.error());
        } else {
          const units = cache.data() ?? [];
          this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
          if (units.length > 0) {
            this.materialsWithUnits.update((set) => addedTo(set, materialId));
          }
          if (units.length === 0) {
            this.materialsWithUnits.update((set) => removedFrom(set, materialId));
            this.collapseMaterial(materialId);
          }
        }
      }
    }, 50);
  }

  private collapseMaterial(materialId: number): void {
    this.userCollapsedIds.update((set) => removedFrom(set, materialId));
    if (this.expandedMaterialId() === materialId) {
      this.expandedMaterialId.set(null);
      this.clearSeasonKeys(materialId);
    }
  }
}
