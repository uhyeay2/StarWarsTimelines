import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concat, Observable, switchMap } from 'rxjs';
import { last } from 'rxjs/operators';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
import { CANON_TYPES, CanonType } from '../../models/canon-type';
import { CreateSourceMaterialUnitInput } from '../../models/catalog/create-source-material-unit-input';
import { MEDIA, Medium } from '../../models/medium';
import { UnitType } from '../../models/unit-type';
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
import { UnitEditForm } from '../unit-edit-form/unit-edit-form';
import { MaterialAddDialog } from '../material-add-dialog/material-add-dialog';
import { UnitAddDialog } from '../unit-add-dialog/unit-add-dialog';
import { BookChoiceDialog } from '../book-choice-dialog/book-choice-dialog';
import { ConvertCollectionDialog } from '../convert-collection-dialog/convert-collection-dialog';
import {
  StartCollectionDialog,
  StartCollectionPayload,
} from '../start-collection-dialog/start-collection-dialog';
import { runOperation } from '../../utils/async-operation';
import { addedTo, removedFrom, removedWithPrefix, toggledIn } from '../../utils/set-operations';

interface UnitKey {
  materialId: number;
  unitId: number;
}

/** Context describing which unit the add-unit popup creates. */
interface UnitAddContext {
  /** The material the unit belongs to. */
  materialId: number;
  /** The container unit to nest inside, or null for a top-level unit. */
  parentUnitId: number | null;
  /** The inferred unit type; the user never picks it manually. */
  childType: UnitType;
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
  /** The container's unit type, or null for ungrouped leftovers. */
  containerType: UnitType | null;
  /** Header label for the group. */
  label: string;
  /** Child units (episodes/issues/chapters) belonging to the group. */
  units: readonly ApiSourceMaterialUnit[];
}

@Component({
  selector: 'app-source-material-catalog',
  imports: [
    FormsModule,
    TrackSelect,
    UnitEditForm,
    MaterialAddDialog,
    UnitAddDialog,
    BookChoiceDialog,
    ConvertCollectionDialog,
    StartCollectionDialog,
  ],
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

  /** Medium of the add-material popup, or null when the popup is closed. */
  readonly addMaterialMedium = signal<Medium | null>(null);
  readonly newTitle = signal('');
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
    const result: Record<number, 'grouped-season' | 'grouped-volume' | 'grouped-book' | 'flat'> = {};
    for (const material of this.materials()) {
      result[material.id] = this.getDisplayStrategy(material);
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

  /** Context of the add-unit popup, or null when the popup is closed. */
  readonly unitPopupContext = signal<UnitAddContext | null>(null);
  readonly popupNumber = signal<number | null>(null);
  readonly popupTitle = signal('');
  readonly addingUnitFor = signal<number | null>(null);
  readonly unitAddError = signal<string | null>(null);

  /** Material whose empty-book choice popup is open, or null when closed. */
  readonly bookChoiceMaterialId = signal<number | null>(null);

  /** Material whose convert-to-collection popup is open, or null when closed. */
  readonly convertPopupMaterialId = signal<number | null>(null);
  readonly convertTitle = signal('');
  readonly convertingId = signal<number | null>(null);

  /** Material whose start-collection popup is open, or null when closed. */
  readonly startCollectionMaterialId = signal<number | null>(null);
  readonly startCollectionName = signal('');
  readonly startingCollectionFor = signal<number | null>(null);

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

  /** Closes every admin popup so at most one is visible at a time. */
  private closeAllPopups(): void {
    this.addMaterialMedium.set(null);
    this.unitPopupContext.set(null);
    this.bookChoiceMaterialId.set(null);
    this.convertPopupMaterialId.set(null);
    this.startCollectionMaterialId.set(null);
  }

  openAddMaterial(medium: Medium): void {
    this.actionError.set(null);
    this.closeAllPopups();
    this.addMaterialMedium.set(medium);
    this.newTitle.set('');
    this.newCanonType.set('Canon');
    this.addError.set(null);
  }

  cancelAddMaterial(): void {
    this.addMaterialMedium.set(null);
    this.addError.set(null);
  }

  submitAddMaterial(): void {
    const medium = this.addMaterialMedium();
    if (!medium || this.adding()) {
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
        medium,
        canonType: this.newCanonType(),
      }),
      onSuccess: (created) => {
        if (created) {
          this.newTitle.set('');
          this.cancelAddMaterial();
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

  // ─── Admin add-unit popups ────────────────────────────────────────────────

  /** Units known for a material (empty when not loaded or empty). */
  unitsFor(materialId: number): readonly ApiSourceMaterialUnit[] {
    return this.unitsByMaterial()[materialId] ?? [];
  }

  /** Returns true when any Book container unit exists for the material. */
  hasBookUnits(materialId: number): boolean {
    return this.unitsFor(materialId).some((u) => u.unitType === 'Book');
  }

  /** Returns the top-level units of a material. */
  topLevelUnits(materialId: number): readonly ApiSourceMaterialUnit[] {
    return this.unitsFor(materialId).filter((u) => u.parentUnitId === null);
  }

  /**
   * A standalone book is a Book material whose units are loaded, that has at
   * least one top-level chapter, and no Book containers yet — the shape the
   * convert-to-collection action applies to.
   */
  isConvertibleStandaloneBook(material: ApiSourceMaterial): boolean {
    return (
      material.medium === 'Book' &&
      this.materialsWithUnits().has(material.id) &&
      !this.hasBookUnits(material.id) &&
      this.topLevelUnits(material.id).length > 0
    );
  }

  /**
   * Whether the material row shows a unit Add button: every medium except
   * movies and short films carries sub-units to add. (New materials of any
   * medium are created via the medium-header Add button instead.)
   */
  hasMaterialAdd(medium: Medium): boolean {
    return medium !== 'Movie' && medium !== 'Short Film';
  }

  /** The unit type created at a material's top level, inferred from the medium. */
  private topLevelChildType(medium: Medium): UnitType {
    switch (medium) {
      case 'Animated Show':
      case 'Live Action Show':
        return 'Season';
      case 'Comic':
        return 'Volume';
      case 'Video Game':
        return 'Level';
      default:
        return 'Chapter';
    }
  }

  /** The child type nested inside a container unit, inferred from its type. */
  private nestedChildType(containerType: UnitType): UnitType {
    switch (containerType) {
      case 'Season':
        return 'Episode';
      case 'Volume':
        return 'Issue';
      default:
        return 'Chapter';
    }
  }

  /** Template helper: child type for a display group's container (chapters when ungrouped). */
  nestedChildTypeFor(containerType: UnitType | null): UnitType {
    return containerType === null ? 'Chapter' : this.nestedChildType(containerType);
  }

  /** Routes a material-row Add click based on medium and current unit shape. */
  onMaterialAddClick(medium: Medium, material: ApiSourceMaterial): void {
    if (medium === 'Book') {
      const known = this.materialsWithUnits().has(material.id);
      if (!known || this.unitsFor(material.id).length === 0) {
        this.openBookChoice(material.id);
        return;
      }
      if (this.hasBookUnits(material.id)) {
        this.openAddUnitPopup({ materialId: material.id, parentUnitId: null, childType: 'Book' });
        return;
      }
      this.openAddUnitPopup({ materialId: material.id, parentUnitId: null, childType: 'Chapter' });
      return;
    }

    this.openAddUnitPopup({
      materialId: material.id,
      parentUnitId: null,
      childType: this.topLevelChildType(medium),
    });
  }

  openBookChoice(materialId: number): void {
    this.actionError.set(null);
    this.closeAllPopups();
    this.bookChoiceMaterialId.set(materialId);
  }

  cancelBookChoice(): void {
    this.bookChoiceMaterialId.set(null);
  }

  chooseBookChapter(materialId: number): void {
    this.cancelBookChoice();
    this.openAddUnitPopup({ materialId, parentUnitId: null, childType: 'Chapter' });
  }

  /** Opens the start-collection popup, prefilled with the material's title. */
  requestStartCollection(materialId: number): void {
    this.actionError.set(null);
    this.closeAllPopups();
    const material = this.materials().find((m) => m.id === materialId);
    if (!material) {
      return;
    }
    this.startCollectionMaterialId.set(materialId);
    this.startCollectionName.set(material.title);
  }

  cancelStartCollection(): void {
    this.startCollectionMaterialId.set(null);
  }

  /**
   * Creates the collection from the start-collection popup: renames the
   * source material to the collection name (when changed) and creates each
   * listed book in order — list positions become the book numbers.
   */
  submitStartCollection(payload: StartCollectionPayload): void {
    const id = this.startCollectionMaterialId();
    if (!id || this.startingCollectionFor()) {
      return;
    }
    const material = this.materials().find((m) => m.id === id);
    if (!material) {
      return;
    }
    const collectionName = payload.collectionName.trim();
    const bookTitles = payload.bookTitles.map((title) => title.trim());
    if (!collectionName) {
      this.actionError.set('A collection name is required.');
      return;
    }
    if (bookTitles.length === 0 || bookTitles.some((title) => !title)) {
      this.actionError.set('Every book needs a title.');
      return;
    }

    this.actionError.set(null);
    const operations: Observable<unknown>[] = bookTitles.map((title, index) =>
      this.catalogService.createSourceMaterialUnit(id, {
        unitType: 'Book',
        parentUnitId: null,
        number: index + 1,
        title,
      }),
    );
    if (collectionName !== material.title) {
      operations.unshift(
        this.catalogService.updateSourceMaterial(id, {
          title: collectionName,
          medium: material.medium,
          canonType: material.canonType,
        }),
      );
    }
    runOperation({
      busy: this.startingCollectionFor,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: concat(...operations).pipe(last()),
      onSuccess: () => {
        this.closeAllPopups();
        this.materialsWithUnits.update((set) => addedTo(set, id));
        this.loadUnits(id);
      },
    });
  }

  openAddUnitPopup(context: UnitAddContext): void {
    this.actionError.set(null);
    this.closeAllPopups();
    this.unitPopupContext.set(context);
    this.popupNumber.set(this.nextNumberFor(context.materialId, context.parentUnitId));
    this.popupTitle.set('');
    this.unitAddError.set(null);
  }

  cancelAddUnit(): void {
    this.unitPopupContext.set(null);
    this.unitAddError.set(null);
  }

  /** Next free number among sibling units under the same parent. */
  private nextNumberFor(materialId: number, parentUnitId: number | null): number {
    const siblings = this.unitsFor(materialId).filter((u) => u.parentUnitId === parentUnitId);
    return siblings.length === 0 ? 1 : Math.max(...siblings.map((u) => u.number)) + 1;
  }

  /** Heading of the add-unit popup, naming the type and target container. */
  unitPopupHeading(context: UnitAddContext): string {
    if (context.parentUnitId === null) {
      return `Add ${context.childType.toLowerCase()}`;
    }
    const parent = this.unitsFor(context.materialId).find((u) => u.id === context.parentUnitId);
    const target = parent ? this.groupUnitLabel(parent) : 'collection';
    return `Add ${context.childType.toLowerCase()} to ${target}`;
  }

  submitAddUnit(): void {
    const context = this.unitPopupContext();
    if (!context || this.addingUnitFor()) {
      return;
    }
    const input = this.buildUnitInput(
      context.childType,
      context.parentUnitId,
      this.popupNumber(),
      this.popupTitle(),
    );
    if (!input) {
      this.unitAddError.set('A unit number of at least one is required.');
      return;
    }

    this.unitAddError.set(null);
    runOperation({
      busy: this.addingUnitFor,
      busyValue: context.materialId,
      idleValue: null,
      error: this.unitAddError,
      operation: this.catalogService.createSourceMaterialUnit(context.materialId, input),
      onSuccess: (created) => {
        if (created) {
          this.cancelAddUnit();
          this.materialsWithUnits.update((set) => addedTo(set, context.materialId));
          this.loadUnits(context.materialId);
        }
      },
    });
  }

  // ─── Convert standalone book to collection ────────────────────────────────

  requestConvert(material: ApiSourceMaterial): void {
    this.actionError.set(null);
    this.closeAllPopups();
    this.convertPopupMaterialId.set(material.id);
    this.convertTitle.set(material.title);
  }

  cancelConvert(): void {
    this.convertPopupMaterialId.set(null);
  }

  submitConvert(): void {
    const id = this.convertPopupMaterialId();
    if (!id || this.convertingId()) {
      return;
    }
    const title = this.convertTitle().trim();
    if (!title) {
      this.actionError.set('A collection title is required.');
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.convertingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.catalogService.convertStandaloneBookToCollection(id, title),
      onSuccess: (converted) => {
        if (converted) {
          this.convertPopupMaterialId.set(null);
          this.loadUnits(id);
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
          containerType: null,
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
        containerType: container.unitType,
        label: this.groupUnitLabel(container),
        units: details.filter((u) => u.parentUnitId === container.id),
      }));

    const orphans = details.filter(
      (u) => u.parentUnitId === null || u.parentUnitId === undefined ||
        !containerIds.has(u.parentUnitId),
    );
    if (orphans.length > 0) {
      groups.push({
        expandKey: 'ungrouped',
        containerId: null,
        containerType: null,
        label: 'Ungrouped',
        units: orphans,
      });
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

  private getDisplayStrategy(
    material: ApiSourceMaterial,
  ): 'grouped-season' | 'grouped-volume' | 'grouped-book' | 'flat' {
    switch (material.medium) {
      case 'Live Action Show':
      case 'Animated Show':
        return 'grouped-season';
      case 'Comic':
        return 'grouped-volume';
      case 'Book':
        return this.hasBookUnits(material.id) ? 'grouped-book' : 'flat';
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
