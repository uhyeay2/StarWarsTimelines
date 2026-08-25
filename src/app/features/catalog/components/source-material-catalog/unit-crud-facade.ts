import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { CreateSourceMaterialUnitInput } from '../../models/create-source-material-unit-input';
import { UnitType } from '../../../../shared/models/unit-type';
import { SourceMaterialService } from '../../services/source-material.service';
import { runOperation } from '../../../../shared/utils/async-operation';

/** Key identifying a specific unit for edit/delete operations. */
export interface UnitKey {
  readonly materialId: number;
  readonly unitId: number;
}

/** Context describing which unit the add-unit popup creates. */
export interface UnitAddContext {
  readonly materialId: number;
  readonly parentUnitId: number | null;
  readonly childType: UnitType;
}

type UnitsByMaterial = Readonly<Record<number, readonly ApiSourceMaterialUnit[]>>;
type LoadUnitsFn = (materialId: number) => void;

/**
 * Encapsulates unit CRUD state and operations for source materials.
 *
 * Extracted from {@link SourceMaterialCatalog} to reduce the parent
 * component's size and isolate the add/edit/delete unit workflows.
 *
 * The facade owns all unit-related signals. Methods that need to query
 * the current unit cache accept `unitsByMaterial` as a parameter because
 * the component owns that signal (it is also read by display/expansion logic).
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped, provided by SourceMaterialCatalog
@Injectable()
export class UnitCrudFacade {
  private readonly sourceMaterialService = inject(SourceMaterialService);

  // ─── Add-unit popup state ──────────────────────────────────────────────

  readonly unitPopupContext = signal<UnitAddContext | null>(null);
  readonly popupNumber = signal<number | null>(null);
  readonly popupTitle = signal('');
  readonly addingUnitFor = signal<number | null>(null);
  readonly unitAddError = signal<string | null>(null);

  // ─── Edit-unit form state ─────────────────────────────────────────────

  readonly unitEditKey = signal<UnitKey | null>(null);
  readonly unitEditType = signal<UnitType>('Episode');
  readonly unitEditParent = signal<number | null>(null);
  readonly unitEditNumber = signal<number | null>(null);
  readonly unitEditTitle = signal('');
  readonly unitSavingKey = signal<UnitKey | null>(null);

  // ─── Delete-unit confirmation state ───────────────────────────────────

  readonly unitConfirmDeleteKey = signal<UnitKey | null>(null);
  readonly unitDeletingKey = signal<UnitKey | null>(null);

  // ─── Display helpers ──────────────────────────────────────────────────

  unitLabel(unit: ApiSourceMaterialUnit): string {
    const title = unit.title ? ` — ${unit.title}` : '';
    return `${unit.number}${title}`;
  }

  readonly groupUnitLabel = (unit: ApiSourceMaterialUnit): string => {
    return unit.title ?? `${unit.unitType} ${unit.number}`;
  };

  // ─── Unit queries ─────────────────────────────────────────────────────

  unitsFor(materialId: number, units: UnitsByMaterial): readonly ApiSourceMaterialUnit[] {
    return units[materialId] ?? [];
  }

  hasBookUnits(materialId: number, units: UnitsByMaterial): boolean {
    return this.unitsFor(materialId, units).some((u) => u.unitType === 'Book');
  }

  topLevelUnits(materialId: number, units: UnitsByMaterial): readonly ApiSourceMaterialUnit[] {
    return this.unitsFor(materialId, units).filter((u) => u.parentUnitId === null);
  }

  // ─── Popup helpers ────────────────────────────────────────────────────

  /** Next free number among sibling units under the same parent. */
  nextNumberFor(materialId: number, parentUnitId: number | null, units: UnitsByMaterial): number {
    const siblings = this.unitsFor(materialId, units).filter((u) => u.parentUnitId === parentUnitId);
    return siblings.length === 0 ? 1 : Math.max(...siblings.map((u) => u.number)) + 1;
  }

  /** Heading of the add-unit popup, naming the type and target container. */
  unitPopupHeading(context: UnitAddContext, units: UnitsByMaterial): string {
    if (context.parentUnitId === null) {
      return `Add ${context.childType.toLowerCase()}`;
    }
    const parent = this.unitsFor(context.materialId, units).find((u) => u.id === context.parentUnitId);
    const target = parent ? this.groupUnitLabel(parent) : 'collection';
    return `Add ${context.childType.toLowerCase()} to ${target}`;
  }

  // ─── Add unit ─────────────────────────────────────────────────────────

  openAddUnitPopup(context: UnitAddContext, units: UnitsByMaterial): void {
    this.unitPopupContext.set(context);
    this.popupNumber.set(this.nextNumberFor(context.materialId, context.parentUnitId, units));
    this.popupTitle.set('');
    this.unitAddError.set(null);
  }

  cancelAddUnit(): void {
    this.unitPopupContext.set(null);
    this.unitAddError.set(null);
  }

  submitAddUnit(loadUnits: LoadUnitsFn, _units: UnitsByMaterial): void {
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
      operation: this.sourceMaterialService.createSourceMaterialUnit(context.materialId, input),
      onSuccess: (created) => {
        if (created) {
          this.cancelAddUnit();
          loadUnits(context.materialId);
        }
      },
    });
  }

  // ─── Edit unit ────────────────────────────────────────────────────────

  beginUnitEdit(materialId: number, unit: ApiSourceMaterialUnit): void {
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

  saveUnitEdit(actionError: WritableSignal<string | null>, loadUnits: LoadUnitsFn): void {
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
      actionError.set('A unit number of at least one is required.');
      return;
    }

    actionError.set(null);
    runOperation({
      busy: this.unitSavingKey,
      busyValue: key,
      idleValue: null,
      error: actionError,
      operation: this.sourceMaterialService.updateSourceMaterialUnit(key.materialId, key.unitId, input),
      onSuccess: (updated) => {
        if (updated) {
          this.unitEditKey.set(null);
          this.unitEditTitle.set('');
          loadUnits(key.materialId);
        }
      },
    });
  }

  // ─── Delete unit ──────────────────────────────────────────────────────

  requestUnitDelete(materialId: number, unit: ApiSourceMaterialUnit): void {
    this.unitConfirmDeleteKey.set({ materialId, unitId: unit.id });
  }

  cancelUnitDelete(): void {
    this.unitConfirmDeleteKey.set(null);
  }

  confirmUnitDelete(actionError: WritableSignal<string | null>, loadUnits: LoadUnitsFn): void {
    const key = this.unitConfirmDeleteKey();
    if (!key || this.unitDeletingKey()) {
      return;
    }

    actionError.set(null);
    runOperation({
      busy: this.unitDeletingKey,
      busyValue: key,
      idleValue: null,
      error: actionError,
      operation: this.sourceMaterialService.deleteSourceMaterialUnit(key.materialId, key.unitId),
      onSuccess: () => {
        this.unitConfirmDeleteKey.set(null);
        loadUnits(key.materialId);
      },
    });
  }

  // ─── Shared helpers ───────────────────────────────────────────────────

  buildUnitInput(
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

  /** Closes all unit-related popups. */
  closeUnitPopups(): void {
    this.unitPopupContext.set(null);
    this.unitEditKey.set(null);
    this.unitConfirmDeleteKey.set(null);
  }
}
