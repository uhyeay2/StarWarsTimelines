import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
import { CANON_TYPES, CanonType } from '../../models/canon-type';
import { CreateSourceMaterialUnitInput } from '../../models/catalog/create-source-material-unit-input';
import { MEDIA, Medium } from '../../models/medium';
import { UNIT_TYPES, UnitType } from '../../models/unit-type';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';
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

interface UnitKey {
  materialId: string;
  unitId: string;
}

/** A season/volume group rendered in the non-admin expanded view. */
interface MaterialDisplayGroup {
  /** Stable key used for expand/collapse state. */
  expandKey: string;
  /** The Season/Volume container unit id, or null when synthesized from group numbers. */
  containerId: string | null;
  /** Header label for the group. */
  label: string;
  /** Child units (episodes/issues) belonging to the group. */
  units: readonly ApiSourceMaterialUnit[];
}

@Component({
  selector: 'app-source-material-admin',
  imports: [FormsModule],
  templateUrl: './source-material-admin.html',
  styleUrl: './source-material-admin.scss',
})
export class SourceMaterialAdmin implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly catalogService = inject(CatalogService);
  private readonly libraryService = inject(LibraryService);
  private readonly authService = inject(AuthService);

  readonly media = MEDIA;
  readonly canonTypes = CANON_TYPES;
  readonly unitTypes = UNIT_TYPES;
  readonly trackingStatuses = TRACKING_STATUSES;

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

  readonly editId = signal<string | null>(null);
  readonly editTitle = signal('');
  readonly editMedium = signal<Medium>('Movie');
  readonly editCanonType = signal<CanonType>('Canon');
  readonly savingId = signal<string | null>(null);

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);

  readonly expandedMaterialId = signal<string | null>(null);
  /** Materials the user manually collapsed while they would otherwise be auto-expanded. */
  readonly userCollapsedIds = signal(new Set<string>());
  readonly unitsByMaterial = signal<Readonly<Record<string, readonly ApiSourceMaterialUnit[]>>>({});
  readonly unitsLoading = signal(false);
  readonly unitsError = signal<string | null>(null);

  readonly expandedSeasonKeys = signal(new Set<string>());

  readonly materialsWithUnits = signal(new Set<string>());

  readonly hasUnits = computed(() => {
    const known = this.materialsWithUnits();
    const result: Record<string, boolean> = {};
    for (const material of this.materials()) {
      result[material.id] = known.has(material.id);
    }
    return result;
  });

  readonly seasonGroups = computed(() => {
    const result: Record<string, { groupNumber: number | null; groupTitle: string | null; units: readonly ApiSourceMaterialUnit[] }[]> = {};
    for (const [materialId, units] of Object.entries(this.unitsByMaterial())) {
      const grouped = new Map<number | null, { groupTitle: string | null; units: ApiSourceMaterialUnit[] }>();
      for (const unit of units) {
        const key = unit.groupNumber ?? null;
        let entry = grouped.get(key);
        if (!entry) {
          entry = { groupTitle: null, units: [] };
          grouped.set(key, entry);
        }
        entry.units.push(unit);
      }
      result[materialId] = [...grouped.entries()]
        .map(([groupNumber, entry]) => ({ groupNumber, groupTitle: entry.groupTitle, units: entry.units }))
        .sort((a, b) => {
          const aKey = a.groupNumber ?? -1;
          const bKey = b.groupNumber ?? -1;
          return aKey - bKey;
        });
    }
    return result;
  });

  readonly displayStrategy = computed(() => {
    const result: Record<string, 'grouped-season' | 'grouped-volume' | 'flat'> = {};
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
  getTrackedItem(materialId: string): LibraryItem | null {
    return findTrackedItem(this.trackedItems(), materialId);
  }

  /**
   * Determines the tracking status options for a material.
   * Includes 'Remove From Library' when the material is already tracked.
   */
  getTrackingOptions(materialId: string): readonly string[] {
    return trackSelectOptions(this.getTrackedItem(materialId) !== null);
  }

  /**
   * Determines the tracking status options for a specific group (season/volume) unit.
   * Includes 'Remove From Library' when that specific unit is already tracked.
   */
  getGroupTrackingOptions(materialId: string, unitId: string): readonly string[] {
    return trackSelectOptions(groupUnitIsTracked(this.getTrackedItem(materialId), unitId));
  }

  /**
   * Returns the currently tracked status for a material, or null when untracked.
   * Used to preselect the material-level tracking dropdown.
   */
  getMaterialCurrentStatus(materialId: string): TrackingStatus | null {
    return materialTrackingStatus(this.getTrackedItem(materialId));
  }

  /**
   * Returns the currently tracked status for a group (season/volume) unit,
   * or null when neither the unit nor any of its child units is tracked
   * (showing the "Track..." placeholder). Derivation is scoped to this
   * container's children only so sibling seasons never influence the result.
   */
  getGroupCurrentStatus(materialId: string, unitId: string): TrackingStatus | null {
    return groupTrackingStatus(this.getTrackedItem(materialId), unitId);
  }

  readonly newUnitType = signal<UnitType>('Episode');
  readonly newUnitGroup = signal<number | null>(null);
  readonly newUnitNumber = signal<number | null>(null);
  readonly newUnitTitle = signal('');
  readonly addingUnitFor = signal<string | null>(null);
  readonly unitAddError = signal<string | null>(null);

  readonly unitEditKey = signal<UnitKey | null>(null);
  readonly unitEditType = signal<UnitType>('Episode');
  readonly unitEditGroup = signal<number | null>(null);
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

  private pollMaterialProbe(materialId: string): void {
    const probePoll = setInterval(() => {
      const cache = this.catalogService.getUnitCache(materialId);
      if (cache.loading()) {
        return;
      }
    clearInterval(probePoll);
    const units = cache.data();
    if (units && units.length > 0) {
      this.materialsWithUnits.update((set) => new Set([...set, materialId]));
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
    this.adding.set(true);
    this.catalogService
      .createSourceMaterial({
        title,
        medium: this.newMedium(),
        canonType: this.newCanonType(),
      })
      .pipe(
        catchError((err: Error) => {
          this.addError.set(err.message);
          return of(null);
        }),
        finalize(() => this.adding.set(false)),
      )
      .subscribe((created) => {
        if (created) {
          this.newTitle.set('');
        }
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
    this.savingId.set(id);
    this.catalogService
      .updateSourceMaterial(id, {
        title,
        medium: this.editMedium(),
        canonType: this.editCanonType(),
      })
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(null);
        }),
        finalize(() => this.savingId.set(null)),
      )
      .subscribe((updated) => {
        if (updated) {
          this.editId.set(null);
          this.editTitle.set('');
        }
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
    this.deletingId.set(id);
    this.catalogService
      .deleteSourceMaterial(id)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(undefined);
        }),
        finalize(() => this.deletingId.set(null)),
      )
      .subscribe(() => {
        if (this.actionError() === null) {
          this.confirmDeleteId.set(null);
          this.expandedMaterialId.set(null);
          this.userCollapsedIds.set(new Set());
          this.expandedSeasonKeys.set(new Set());
          this.unitsByMaterial.set({});
        }
      });
  }

  toggleUnits(materialId: string): void {
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
    this.userCollapsedIds.update((set) => {
      const next = new Set(set);
      next.delete(materialId);
      return next;
    });
    this.expandedMaterialId.set(materialId);
    this.loadUnits(materialId);
  }

  /** Returns true if the material's unit section is currently visible. */
  isMaterialExpanded(materialId: string): boolean {
    return this.shouldShowUnits(materialId);
  }

  private clearSeasonKeys(materialId: string): void {
    this.expandedSeasonKeys.update((set) => {
      const next = new Set(set);
      for (const key of next) {
        if (key.startsWith(`${materialId}:`)) {
          next.delete(key);
        }
      }
      return next;
    });
  }

  addUnit(materialId: string): void {
    if (this.addingUnitFor()) {
      return;
    }
    const input = this.buildUnitInput(
      this.newUnitType(),
      this.newUnitGroup(),
      this.newUnitNumber(),
      this.newUnitTitle(),
    );
    if (!input) {
      this.unitAddError.set('A unit number of at least one is required.');
      return;
    }

    this.unitAddError.set(null);
    this.addingUnitFor.set(materialId);
    this.catalogService
      .createSourceMaterialUnit(materialId, input)
      .pipe(
        catchError((err: Error) => {
          this.unitAddError.set(err.message);
          return of(null);
        }),
        finalize(() => this.addingUnitFor.set(null)),
      )
      .subscribe((created) => {
        if (created) {
          this.newUnitType.set('Episode');
          this.newUnitGroup.set(null);
          this.newUnitNumber.set(null);
          this.newUnitTitle.set('');
          this.materialsWithUnits.update((set) => new Set([...set, materialId]));
          this.loadUnits(materialId);
        }
      });
  }

  beginUnitEdit(materialId: string, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitEditKey.set({ materialId, unitId: unit.id });
    this.unitEditType.set(unit.unitType);
    this.unitEditGroup.set(unit.groupNumber);
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
      this.unitEditGroup(),
      this.unitEditNumber(),
      this.unitEditTitle(),
    );
    if (!input) {
      this.actionError.set('A unit number of at least one is required.');
      return;
    }

    this.actionError.set(null);
    this.unitSavingKey.set(key);
    this.catalogService
      .updateSourceMaterialUnit(key.materialId, key.unitId, input)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(null);
        }),
        finalize(() => this.unitSavingKey.set(null)),
      )
      .subscribe((updated) => {
        if (updated) {
          this.unitEditKey.set(null);
          this.unitEditTitle.set('');
          this.loadUnits(key.materialId);
        }
      });
  }

  requestUnitDelete(materialId: string, unit: ApiSourceMaterialUnit): void {
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
    this.unitDeletingKey.set(key);
    this.catalogService
      .deleteSourceMaterialUnit(key.materialId, key.unitId)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(undefined);
        }),
        finalize(() => this.unitDeletingKey.set(null)),
      )
      .subscribe(() => {
        if (this.actionError() === null) {
          this.unitConfirmDeleteKey.set(null);
          this.loadUnits(key.materialId);
        }
      });
  }

  unitLabel(unit: ApiSourceMaterialUnit): string {
    const title = unit.title ? ` — ${unit.title}` : '';
    return `${unit.number}${title}`;
  }

  readonly groupUnitLabel = (unit: ApiSourceMaterialUnit): string => {
    if (unit.unitType === 'Season') {
      return unit.title ?? `Season ${unit.number}`;
    }
    if (unit.unitType === 'Volume') {
      return unit.title ?? `Volume ${unit.number}`;
    }
    return `${unit.unitType} ${unit.number}`;
  };

  /**
   * Builds the season/volume groups shown in the non-admin expanded view.
   *
   * Uses explicit Season/Volume units as group headers when present, matching
   * child units by the container's number or group number. Otherwise,
   * synthesizes groups from the child units' own group numbers (e.g. episodes
   * tagged with a season number but no explicit Season unit).
   */
  getDisplayGroups(materialId: string): readonly MaterialDisplayGroup[] {
    const units = this.unitsByMaterial()[materialId] ?? [];
    const containers = units.filter((u) => u.unitType === 'Season' || u.unitType === 'Volume');
    const details = units.filter((u) => u.unitType !== 'Season' && u.unitType !== 'Volume');

    if (containers.length > 0) {
      return containers.map((container) => ({
        expandKey: container.id,
        containerId: container.id,
        label: this.groupUnitLabel(container),
        units: details.filter(
          (u) =>
            (container.number !== null && u.groupNumber === container.number) ||
            (container.groupNumber !== null && u.groupNumber === container.groupNumber),
        ),
      }));
    }

    const noun = details.some((u) => u.unitType === 'Issue') ? 'Volume' : 'Season';
    const byGroup = new Map<number | null, ApiSourceMaterialUnit[]>();
    for (const unit of details) {
      const key = unit.groupNumber ?? null;
      const list = byGroup.get(key);
      if (list) {
        list.push(unit);
      } else {
        byGroup.set(key, [unit]);
      }
    }
    return [...byGroup.entries()]
      .sort((a, b) => (a[0] ?? -1) - (b[0] ?? -1))
      .map(([groupNumber, groupUnits]) => ({
        expandKey: groupNumber === null ? 'ungrouped' : String(groupNumber),
        containerId: null,
        label: groupNumber === null ? `All ${noun}s` : `${noun} ${groupNumber}`,
        units: groupUnits,
      }));
  }

  /** Returns true if the material should show units in expanded view. */
  shouldShowUnits(materialId: string): boolean {
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
    if (this.isAdmin()) return new Set<string>();
    const ids = new Set<string>();
    for (const [mid, unitList] of Object.entries(this.unitsByMaterial())) {
      if (this.hasDisplayGroups(mid, unitList)) {
        ids.add(mid);
      }
    }
    return ids;
  });

  /** Returns true if the material's units render as season/volume groups. */
  private hasDisplayGroups(materialId: string, units: readonly ApiSourceMaterialUnit[]): boolean {
    if (units.some((u) => u.unitType === 'Season' || u.unitType === 'Volume')) {
      return true;
    }
    if (!this.isGroupedMedium(materialId)) {
      return false;
    }
    const groupNumbers = new Set(
      units
        .filter((u) => u.unitType !== 'Season' && u.unitType !== 'Volume')
        .map((u) => u.groupNumber)
        .filter((g): g is number => g !== null),
    );
    return groupNumbers.size > 0;
  }

  private isGroupedMedium(materialId: string): boolean {
    const material = this.materials().find((m) => m.id === materialId);
    return (
      material?.medium === 'Comic' ||
      material?.medium === 'Live Action Show' ||
      material?.medium === 'Animated Show'
    );
  }

  isAutoExpanded(materialId: string): boolean {
    return this.autoExpandedMaterialIds().has(materialId);
  }

  /**
   * Handles a tracking status change for a material (non-unit level).
   * If status is 'remove', removes the item from the library;
   * otherwise, adds or updates the tracked item with the given status.
   */
  onTrackMaterial(materialId: string, event: Event): void {
    const status = (event.target as HTMLSelectElement).value;
    this.doTrackMaterial(materialId, status);
  }

  /**
   * Handles a tracking status change for a Season/Volume unit within a material.
   * If status is 'remove', removes the unit's progress;
   * otherwise, sets the unit's status.
   */
  onTrackGroupUnit(materialId: string, unitId: string, event: Event): void {
    const status = (event.target as HTMLSelectElement).value;
    this.doTrackGroupUnit(materialId, unitId, status);
  }

  private doTrackMaterial(materialId: string, status: string): void {
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

  private doTrackGroupUnit(materialId: string, unitId: string, status: string): void {
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

  groupLabel(groupNumber: number | null, groupTitle: string | null, strategy: string): string {
    if (strategy === 'grouped-volume') {
      const title = groupTitle ? `: ${groupTitle}` : '';
      return `Volume ${groupNumber ?? ''}${title}`;
    }
    return groupNumber !== null ? `Season ${groupNumber}` : 'Ungrouped';
  }

  seasonKey(materialId: string, groupKey: number | string | null): string {
    return `${materialId}:${groupKey}`;
  }

  isSeasonExpanded(materialId: string, groupKey: number | string | null): boolean {
    return this.expandedSeasonKeys().has(this.seasonKey(materialId, groupKey));
  }

  toggleSeason(materialId: string, groupKey: number | string | null): void {
    const key = this.seasonKey(materialId, groupKey);
    this.expandedSeasonKeys.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isMediumExpanded(medium: Medium): boolean {
    return this.expandedMedia().has(medium);
  }

  toggleMedium(medium: Medium): void {
    this.expandedMedia.update((set) => {
      const next = new Set(set);
      if (next.has(medium)) {
        next.delete(medium);
      } else {
        next.add(medium);
      }
      return next;
    });
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
    groupNumber: number | null,
    number: number | null,
    title: string,
  ): CreateSourceMaterialUnitInput | null {
    if (number === null || number < 1) {
      return null;
    }
    const trimmedTitle = title.trim();
    return {
      unitType,
      groupNumber,
      number,
      title: trimmedTitle || null,
    };
  }

  private loadUnits(materialId: string): void {
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
        this.materialsWithUnits.update((set) => new Set([...set, materialId]));
      }
      if (units.length === 0) {
        this.materialsWithUnits.update((set) => {
          const next = new Set(set);
          next.delete(materialId);
          return next;
        });
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
            this.materialsWithUnits.update((set) => new Set([...set, materialId]));
          }
          if (units.length === 0) {
            this.materialsWithUnits.update((set) => {
              const next = new Set(set);
              next.delete(materialId);
              return next;
            });
            this.collapseMaterial(materialId);
          }
        }
      }
    }, 50);
  }

  private collapseMaterial(materialId: string): void {
    this.userCollapsedIds.update((set) => {
      const next = new Set(set);
      next.delete(materialId);
      return next;
    });
    if (this.expandedMaterialId() === materialId) {
      this.expandedMaterialId.set(null);
      this.clearSeasonKeys(materialId);
    }
  }
}
