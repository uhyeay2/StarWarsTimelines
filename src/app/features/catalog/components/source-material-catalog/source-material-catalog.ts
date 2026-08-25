import { ChangeDetectionStrategy, Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ApiSourceMaterial } from '../../../../shared/models/api-source-material';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { Medium } from '../../../../shared/models/medium';
import { UnitType } from '../../../../shared/models/unit-type';
import { SourceMaterialService } from '../../services/source-material.service';
import { TrackingFacade } from './tracking-facade';
import { UnitCrudFacade, UnitAddContext } from './unit-crud-facade';
import { UnitDataFacade } from './unit-data-facade';
import { MaterialCrudFacade } from './material-crud-facade';
import { ConversionWorkflowFacade } from './conversion-workflow-facade';
import { CatalogDisplayFacade, MaterialDisplayGroup } from './catalog-display-facade';
import { TrackSelect } from '../../../library/components/track-select/track-select';
import { UnitEditForm } from '../unit-edit-form/unit-edit-form';
import { MaterialAddDialog } from '../material-add-dialog/material-add-dialog';
import { UnitAddDialog } from '../unit-add-dialog/unit-add-dialog';
import { BookChoiceDialog } from '../book-choice-dialog/book-choice-dialog';
import { ConvertCollectionDialog } from '../convert-collection-dialog/convert-collection-dialog';
import {
  StartCollectionDialog,
  StartCollectionPayload,
} from '../start-collection-dialog/start-collection-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-source-material-catalog',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    TrackSelect,
    UnitEditForm,
    MaterialAddDialog,
    UnitAddDialog,
    BookChoiceDialog,
    ConvertCollectionDialog,
    StartCollectionDialog,
  ],
  providers: [
    TrackingFacade,
    UnitCrudFacade,
    UnitDataFacade,
    MaterialCrudFacade,
    ConversionWorkflowFacade,
    CatalogDisplayFacade,
  ],
  templateUrl: './source-material-catalog.html',
  styleUrl: './source-material-catalog.scss',
})
export class SourceMaterialCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly sourceMaterialService = inject(SourceMaterialService);
  private readonly tracking = inject(TrackingFacade);
  private readonly unitCrud = inject(UnitCrudFacade);
  private readonly unitData = inject(UnitDataFacade);
  private readonly materialCrud = inject(MaterialCrudFacade);
  private readonly conversion = inject(ConversionWorkflowFacade);
  private readonly display = inject(CatalogDisplayFacade);

  // ─── Data signals (search + material list) ────────────────────────────

  readonly searchTerm = signal('');
  readonly materials = computed(() => this.sourceMaterialService.sourceMaterials() ?? []);
  readonly loading = computed(() => this.sourceMaterialService.sourceMaterialsLoading());
  readonly loadError = computed(() => this.sourceMaterialService.sourceMaterialsError());

  readonly filteredMaterials = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.materials();
    }
    return this.materials().filter((m) => m.title.toLowerCase().includes(term));
  });

  // ─── Shared error signal ──────────────────────────────────────────────

  readonly actionError = signal<string | null>(null);

  // ─── Material CRUD proxies ────────────────────────────────────────────

  readonly media = this.materialCrud.media;
  readonly canonTypes = this.materialCrud.canonTypes;
  readonly addMaterialMedium = this.materialCrud.addMaterialMedium;
  readonly newTitle = this.materialCrud.newTitle;
  readonly newCanonType = this.materialCrud.newCanonType;
  readonly adding = this.materialCrud.adding;
  readonly addError = this.materialCrud.addError;
  readonly editId = this.materialCrud.editId;
  readonly editTitle = this.materialCrud.editTitle;
  readonly editMedium = this.materialCrud.editMedium;
  readonly editCanonType = this.materialCrud.editCanonType;
  readonly savingId = this.materialCrud.savingId;
  readonly confirmDeleteId = this.materialCrud.confirmDeleteId;
  readonly deletingId = this.materialCrud.deletingId;

  // ─── Unit CRUD proxies ────────────────────────────────────────────────

  readonly unitPopupContext = this.unitCrud.unitPopupContext;
  readonly popupNumber = this.unitCrud.popupNumber;
  readonly popupTitle = this.unitCrud.popupTitle;
  readonly addingUnitFor = this.unitCrud.addingUnitFor;
  readonly unitAddError = this.unitCrud.unitAddError;
  readonly unitEditKey = this.unitCrud.unitEditKey;
  readonly unitEditNumber = this.unitCrud.unitEditNumber;
  readonly unitEditTitle = this.unitCrud.unitEditTitle;
  readonly unitSavingKey = this.unitCrud.unitSavingKey;
  readonly unitConfirmDeleteKey = this.unitCrud.unitConfirmDeleteKey;
  readonly unitDeletingKey = this.unitCrud.unitDeletingKey;

  // ─── Unit data proxies ────────────────────────────────────────────────

  readonly probeLoading = this.unitData.probeLoading;
  readonly unitsByMaterial = this.unitData.unitsByMaterial;
  readonly unitsLoading = this.unitData.unitsLoading;
  readonly unitsError = this.unitData.unitsError;
  readonly hasUnits = this.unitData.hasUnits;
  readonly materialsWithUnits = this.unitData.materialsWithUnits;

  // ─── Conversion proxies ───────────────────────────────────────────────

  readonly bookChoiceMaterialId = this.conversion.bookChoiceMaterialId;
  readonly convertPopupMaterialId = this.conversion.convertPopupMaterialId;
  readonly convertTitle = this.conversion.convertTitle;
  readonly convertingId = this.conversion.convertingId;
  readonly startCollectionMaterialId = this.conversion.startCollectionMaterialId;
  readonly startCollectionName = this.conversion.startCollectionName;
  readonly startingCollectionFor = this.conversion.startingCollectionFor;

  // ─── Display proxies ──────────────────────────────────────────────────

  readonly expandedMedia = this.display.expandedMedia;
  readonly expandedMaterialId = this.display.expandedMaterialId;
  readonly mediumGroups = computed(() => this.display.mediumGroups(this.filteredMaterials()));
  readonly displayStrategy = this.display.displayStrategy;
  readonly autoExpandedMaterialIds = this.display.autoExpandedMaterialIds;
  readonly expandedSeasonKeys = this.display.expandedSeasonKeys;

  // ─── Tracking proxies ─────────────────────────────────────────────────

  readonly currentUser = this.tracking.currentUser;
  readonly trackedItems = this.tracking.trackedItems;
  readonly trackedItemIds = this.tracking.trackedItemIds;

  constructor() {
    this.sourceMaterialService.fetchSourceMaterials();
    this.unitData.autoProbe();
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.tracking.loadTracked(user.id);
    }
  }

  // ─── Popup coordination ───────────────────────────────────────────────

  private closeAllPopups(): void {
    this.materialCrud.closePopups();
    this.unitCrud.closeUnitPopups();
    this.conversion.closePopups();
  }

  // ─── Unit data loading (orchestrator) ─────────────────────────────────

  private loadUnits(materialId: number): void {
    this.unitData.loadUnits(materialId, (id) => this.display.collapseMaterial(id));
  }

  // ─── Material CRUD delegations ────────────────────────────────────────

  openAddMaterial(medium: Medium): void {
    this.materialCrud.openAddMaterial(medium, this.actionError, () => this.closeAllPopups());
  }

  cancelAddMaterial(): void {
    this.materialCrud.cancelAddMaterial();
  }

  submitAddMaterial(): void {
    this.materialCrud.submitAddMaterial();
  }

  beginEdit(material: ApiSourceMaterial): void {
    this.materialCrud.beginEdit(material, this.actionError);
  }

  cancelEdit(): void {
    this.materialCrud.cancelEdit();
  }

  saveEdit(): void {
    this.materialCrud.saveEdit(this.actionError);
  }

  requestDelete(material: ApiSourceMaterial): void {
    this.materialCrud.requestDelete(material, this.actionError);
  }

  cancelDelete(): void {
    this.materialCrud.cancelDelete();
  }

  confirmDelete(): void {
    this.materialCrud.confirmDelete(this.actionError, () => {
      this.display.resetExpansionState();
      this.unitData.unitsByMaterial.set({});
    });
  }

  // ─── Unit CRUD delegations ────────────────────────────────────────────

  openAddUnitPopup(context: UnitAddContext): void {
    this.actionError.set(null);
    this.closeAllPopups();
    this.unitCrud.openAddUnitPopup(context, this.unitsByMaterial());
  }

  cancelAddUnit(): void {
    this.unitCrud.cancelAddUnit();
  }

  unitPopupHeading(context: UnitAddContext): string {
    return this.unitCrud.unitPopupHeading(context, this.unitsByMaterial());
  }

  submitAddUnit(): void {
    this.unitCrud.submitAddUnit((id) => this.loadUnits(id), this.unitsByMaterial());
  }

  beginUnitEdit(materialId: number, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitCrud.beginUnitEdit(materialId, unit);
  }

  cancelUnitEdit(): void {
    this.unitCrud.cancelUnitEdit();
  }

  saveUnitEdit(): void {
    this.unitCrud.saveUnitEdit(this.actionError, (id) => this.loadUnits(id));
  }

  requestUnitDelete(materialId: number, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitCrud.requestUnitDelete(materialId, unit);
  }

  cancelUnitDelete(): void {
    this.unitCrud.cancelUnitDelete();
  }

  confirmUnitDelete(): void {
    this.unitCrud.confirmUnitDelete(this.actionError, (id) => this.loadUnits(id));
  }

  unitLabel(unit: ApiSourceMaterialUnit): string {
    return this.unitCrud.unitLabel(unit);
  }

  readonly groupUnitLabel = (unit: ApiSourceMaterialUnit): string => {
    return this.unitCrud.groupUnitLabel(unit);
  };

  // ─── Conversion delegations ───────────────────────────────────────────

  onMaterialAddClick(medium: Medium, material: ApiSourceMaterial): void {
    this.conversion.onMaterialAddClick(
      medium,
      material,
      (ctx) => this.openAddUnitPopup(ctx),
      this.actionError,
      () => this.closeAllPopups(),
    );
  }

  isConvertibleStandaloneBook(material: ApiSourceMaterial): boolean {
    return this.conversion.isConvertibleStandaloneBook(material);
  }

  openBookChoice(materialId: number): void {
    this.conversion.openBookChoice(materialId, this.actionError, () => this.closeAllPopups());
  }

  cancelBookChoice(): void {
    this.conversion.cancelBookChoice();
  }

  chooseBookChapter(materialId: number): void {
    this.conversion.chooseBookChapter(materialId, (ctx) => this.openAddUnitPopup(ctx));
  }

  requestStartCollection(materialId: number): void {
    this.conversion.requestStartCollection(materialId, this.actionError, () => this.materials(), () => this.closeAllPopups());
  }

  cancelStartCollection(): void {
    this.conversion.cancelStartCollection();
  }

  submitStartCollection(payload: StartCollectionPayload): void {
    this.conversion.submitStartCollection(payload, this.actionError, () => this.materials(), () => this.closeAllPopups());
  }

  requestConvert(material: ApiSourceMaterial): void {
    this.conversion.requestConvert(material, this.actionError, () => this.closeAllPopups());
  }

  cancelConvert(): void {
    this.conversion.cancelConvert();
  }

  submitConvert(): void {
    this.conversion.submitConvert(this.actionError);
  }

  // ─── Display delegations ──────────────────────────────────────────────

  toggleUnits(materialId: number): void {
    this.display.toggleUnits(materialId, (id) => this.loadUnits(id));
  }

  isMaterialExpanded(materialId: number): boolean {
    return this.display.isMaterialExpanded(materialId);
  }

  shouldShowUnits(materialId: number): boolean {
    return this.display.shouldShowUnits(materialId);
  }

  isAutoExpanded(materialId: number): boolean {
    return this.display.isAutoExpanded(materialId);
  }

  isMediumExpanded(medium: Medium): boolean {
    return this.display.isMediumExpanded(medium);
  }

  toggleMedium(medium: Medium): void {
    this.display.toggleMedium(medium);
  }

  isSeasonExpanded(materialId: number, groupKey: number | string | null): boolean {
    return this.display.isSeasonExpanded(materialId, groupKey);
  }

  toggleSeason(materialId: number, groupKey: number | string | null): void {
    this.display.toggleSeason(materialId, groupKey);
  }

  getDisplayGroups(materialId: number): readonly MaterialDisplayGroup[] {
    return this.display.getDisplayGroups(materialId);
  }

  hasMaterialAdd(medium: Medium): boolean {
    return this.display.hasMaterialAdd(medium);
  }

  nestedChildTypeFor(containerType: UnitType | null): UnitType {
    return this.display.nestedChildTypeFor(containerType);
  }

  materialTracksViaContainers(materialId: number): boolean {
    return this.display.materialTracksViaContainers(materialId);
  }

  // ─── Tracking delegations ─────────────────────────────────────────────

  getTrackedItem(materialId: number): import('../../../../shared/models/library-item').LibraryItem | null {
    return this.tracking.getTrackedItem(materialId);
  }

  getTrackingOptions(materialId: number): readonly string[] {
    return this.tracking.getTrackingOptions(materialId);
  }

  getGroupTrackingOptions(materialId: number, unitId: number): readonly string[] {
    return this.tracking.getGroupTrackingOptions(materialId, unitId);
  }

  getMaterialCurrentStatus(materialId: number): import('../../../../shared/models/tracking-status').TrackingStatus | null {
    return this.tracking.getMaterialCurrentStatus(materialId);
  }

  getGroupCurrentStatus(materialId: number, unitId: number): import('../../../../shared/models/tracking-status').TrackingStatus | null {
    return this.tracking.getGroupCurrentStatus(materialId, unitId);
  }

  onTrackMaterial(materialId: number, status: string): void {
    const material = this.materials().find((m) => m.id === materialId);
    this.tracking.onTrackMaterial(materialId, status, material);
  }

  onTrackGroupUnit(materialId: number, unitId: number, status: string): void {
    const material = this.materials().find((m) => m.id === materialId);
    this.tracking.onTrackGroupUnit(materialId, unitId, status, material);
  }

  // ─── Probe delegations ────────────────────────────────────────────────

  probeUnitPresence(): void {
    this.unitData.probeUnitPresence();
  }

  completeProbe(): void {
    this.unitData.completeProbe();
  }

  autoProbe(): void {
    this.unitData.autoProbe();
  }

  // ─── Unit query helpers ───────────────────────────────────────────────

  unitsFor(materialId: number): readonly ApiSourceMaterialUnit[] {
    return this.unitCrud.unitsFor(materialId, this.unitsByMaterial());
  }

  topLevelUnits(materialId: number): readonly ApiSourceMaterialUnit[] {
    return this.unitCrud.topLevelUnits(materialId, this.unitsByMaterial());
  }
}
