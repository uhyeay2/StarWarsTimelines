import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { concat, Observable } from 'rxjs';
import { last } from 'rxjs/operators';
import { ApiSourceMaterial } from '../../../../shared/models/api-source-material';
import { Medium } from '../../../../shared/models/medium';
import { SourceMaterialService } from '../../services/source-material.service';
import { runOperation } from '../../../../shared/utils/async-operation';
import { addedTo } from '../../../../shared/utils/set-operations';
import { UnitCrudFacade } from './unit-crud-facade';
import { UnitDataFacade } from './unit-data-facade';
import { topLevelChildType } from './unit-type-utils';
import { StartCollectionPayload } from '../start-collection-dialog/start-collection-dialog';

type CloseAllPopupsFn = () => void;
type MaterialsFn = () => readonly ApiSourceMaterial[];
type OpenAddUnitPopupFn = (context: import('./unit-crud-facade').UnitAddContext) => void;

/**
 * Encapsulates the conversion/collection workflows: book choice routing,
 * convert standalone book to collection, and start collection creation.
 *
 * Extracted from {@link SourceMaterialCatalog} to isolate these multi-step
 * material transformation workflows as a single responsibility.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped, provided by SourceMaterialCatalog
@Injectable()
export class ConversionWorkflowFacade {
  private readonly sourceMaterialService = inject(SourceMaterialService);
  private readonly unitCrud = inject(UnitCrudFacade);
  private readonly unitData = inject(UnitDataFacade);

  // ─── Book choice popup state ──────────────────────────────────────────

  readonly bookChoiceMaterialId = signal<number | null>(null);

  // ─── Convert-to-collection popup state ────────────────────────────────

  readonly convertPopupMaterialId = signal<number | null>(null);
  readonly convertTitle = signal('');
  readonly convertingId = signal<number | null>(null);

  // ─── Start-collection popup state ─────────────────────────────────────

  readonly startCollectionMaterialId = signal<number | null>(null);
  readonly startCollectionName = signal('');
  readonly startingCollectionFor = signal<number | null>(null);

  // ─── Material-row Add click routing ───────────────────────────────────

  /**
   * Routes a material-row Add click based on medium and current unit shape.
   * For books, opens either the book-choice dialog or the add-unit popup.
   * For other media, opens the add-unit popup with the appropriate child type.
   */
  onMaterialAddClick(
    medium: Medium,
    material: ApiSourceMaterial,
    openAddUnitPopup: OpenAddUnitPopupFn,
    actionError: WritableSignal<string | null>,
    closeAllPopups: CloseAllPopupsFn,
  ): void {
    const units = this.unitData.unitsByMaterial();
    if (medium === 'Book') {
      const known = this.unitData.materialsWithUnits().has(material.id);
      if (!known || this.unitCrud.unitsFor(material.id, units).length === 0) {
        this.openBookChoice(material.id, actionError, closeAllPopups);
        return;
      }
      if (this.unitCrud.hasBookUnits(material.id, units)) {
        openAddUnitPopup({ materialId: material.id, parentUnitId: null, childType: 'Book' });
        return;
      }
      openAddUnitPopup({ materialId: material.id, parentUnitId: null, childType: 'Chapter' });
      return;
    }

    openAddUnitPopup({
      materialId: material.id,
      parentUnitId: null,
      childType: topLevelChildType(medium),
    });
  }

  /**
   * A standalone book is a Book material whose units are loaded, that has at
   * least one top-level chapter, and no Book containers yet — the shape the
   * convert-to-collection action applies to.
   */
  isConvertibleStandaloneBook(material: ApiSourceMaterial): boolean {
    return (
      material.medium === 'Book' &&
      this.unitData.materialsWithUnits().has(material.id) &&
      !this.unitCrud.hasBookUnits(material.id, this.unitData.unitsByMaterial()) &&
      this.unitCrud.topLevelUnits(material.id, this.unitData.unitsByMaterial()).length > 0
    );
  }

  // ─── Book choice ──────────────────────────────────────────────────────

  openBookChoice(
    materialId: number,
    actionError: WritableSignal<string | null>,
    closeAllPopups: CloseAllPopupsFn,
  ): void {
    actionError.set(null);
    closeAllPopups();
    this.bookChoiceMaterialId.set(materialId);
  }

  cancelBookChoice(): void {
    this.bookChoiceMaterialId.set(null);
  }

  chooseBookChapter(materialId: number, openAddUnitPopup: OpenAddUnitPopupFn): void {
    this.cancelBookChoice();
    openAddUnitPopup({ materialId, parentUnitId: null, childType: 'Chapter' });
  }

  // ─── Start collection ─────────────────────────────────────────────────

  requestStartCollection(
    materialId: number,
    actionError: WritableSignal<string | null>,
    materials: MaterialsFn,
    closeAllPopups: CloseAllPopupsFn,
  ): void {
    actionError.set(null);
    closeAllPopups();
    const material = materials().find((m) => m.id === materialId);
    if (!material) {
      return;
    }
    this.startCollectionMaterialId.set(materialId);
    this.startCollectionName.set(material.title);
  }

  cancelStartCollection(): void {
    this.startCollectionMaterialId.set(null);
  }

  submitStartCollection(
    payload: StartCollectionPayload,
    actionError: WritableSignal<string | null>,
    materials: MaterialsFn,
    closeAllPopups: CloseAllPopupsFn,
  ): void {
    const id = this.startCollectionMaterialId();
    if (!id || this.startingCollectionFor()) {
      return;
    }
    const material = materials().find((m) => m.id === id);
    if (!material) {
      return;
    }
    const collectionName = payload.collectionName.trim();
    const bookTitles = payload.bookTitles.map((title) => title.trim());
    if (!collectionName) {
      actionError.set('A collection name is required.');
      return;
    }
    if (bookTitles.length === 0 || bookTitles.some((title) => !title)) {
      actionError.set('Every book needs a title.');
      return;
    }

    actionError.set(null);
    const operations: Observable<unknown>[] = bookTitles.map((title, index) =>
      this.sourceMaterialService.createSourceMaterialUnit(id, {
        unitType: 'Book',
        parentUnitId: null,
        number: index + 1,
        title,
      }),
    );
    if (collectionName !== material.title) {
      operations.unshift(
        this.sourceMaterialService.updateSourceMaterial(id, {
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
      error: actionError,
      operation: concat(...operations).pipe(last()),
      onSuccess: () => {
        closeAllPopups();
        this.unitData.materialsWithUnits.update((set) => addedTo(set, id));
        this.unitData.loadUnits(id);
      },
    });
  }

  // ─── Convert standalone book ──────────────────────────────────────────

  requestConvert(
    material: ApiSourceMaterial,
    actionError: WritableSignal<string | null>,
    closeAllPopups: CloseAllPopupsFn,
  ): void {
    actionError.set(null);
    closeAllPopups();
    this.convertPopupMaterialId.set(material.id);
    this.convertTitle.set(material.title);
  }

  cancelConvert(): void {
    this.convertPopupMaterialId.set(null);
  }

  submitConvert(actionError: WritableSignal<string | null>): void {
    const id = this.convertPopupMaterialId();
    if (!id || this.convertingId()) {
      return;
    }
    const title = this.convertTitle().trim();
    if (!title) {
      actionError.set('A collection title is required.');
      return;
    }

    actionError.set(null);
    runOperation({
      busy: this.convertingId,
      busyValue: id,
      idleValue: null,
      error: actionError,
      operation: this.sourceMaterialService.convertStandaloneBookToCollection(id, title),
      onSuccess: (converted) => {
        if (converted) {
          this.convertPopupMaterialId.set(null);
          this.unitData.loadUnits(id);
        }
      },
    });
  }

  /** Closes all conversion/collection popups. */
  closePopups(): void {
    this.bookChoiceMaterialId.set(null);
    this.convertPopupMaterialId.set(null);
    this.startCollectionMaterialId.set(null);
  }
}
