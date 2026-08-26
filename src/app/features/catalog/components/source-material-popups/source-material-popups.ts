import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CanonType } from '../../../../shared/models/canon-type';
import { UnitAddContext } from '../source-material-catalog/unit-crud-facade';
import { StartCollectionPayload } from '../start-collection-dialog/start-collection-dialog';
import { MaterialAddDialog } from '../material-add-dialog/material-add-dialog';
import { BookChoiceDialog } from '../book-choice-dialog/book-choice-dialog';
import { UnitAddDialog } from '../unit-add-dialog/unit-add-dialog';
import { ConvertCollectionDialog } from '../convert-collection-dialog/convert-collection-dialog';
import { StartCollectionDialog } from '../start-collection-dialog/start-collection-dialog';

/** Subset of the catalog host API used by the admin popup cluster. */
export interface SourcePopupsHost {
  readonly isAdmin: () => boolean;
  readonly addMaterialMedium: () => string | null;
  readonly addError: () => string | null;
  readonly adding: () => boolean;
  submitAddMaterial(): void;
  cancelAddMaterial(): void;
  readonly bookChoiceMaterialId: () => number | null;
  chooseBookChapter(materialId: number): void;
  requestStartCollection(materialId: number): void;
  cancelBookChoice(): void;
  readonly unitPopupContext: () => UnitAddContext | null;
  unitPopupHeading(context: UnitAddContext): string;
  readonly unitAddError: () => string | null;
  readonly addingUnitFor: () => number | null;
  submitAddUnit(): void;
  cancelAddUnit(): void;
  readonly convertPopupMaterialId: () => number | null;
  readonly convertingId: () => number | null;
  submitConvert(): void;
  cancelConvert(): void;
  readonly startCollectionMaterialId: () => number | null;
  readonly startingCollectionFor: () => number | null;
  submitStartCollection(payload: StartCollectionPayload): void;
  cancelStartCollection(): void;
}

/**
 * Admin dialog cluster for the source-material catalog.
 *
 * Renders at most one of the five admin dialogs at a time, driven by the
 * host's popup state. Editable dialog fields are two-way bound through
 * this component's models, which the catalog host bridges to its own
 * signals.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-source-material-popups',
  imports: [
    MaterialAddDialog,
    BookChoiceDialog,
    UnitAddDialog,
    ConvertCollectionDialog,
    StartCollectionDialog,
  ],
  templateUrl: './source-material-popups.html',
})
export class SourceMaterialPopups {
  /** Catalog host API. */
  readonly host = input.required<SourcePopupsHost>();

  /** Title for the material-add dialog. */
  readonly addTitle = model('');

  /** Canon type for the material-add dialog. */
  readonly addCanonType = model<CanonType>('Canon');

  /** Unit number for the unit-add dialog. */
  readonly unitNumber = model<number | null>(null);

  /** Unit title for the unit-add dialog. */
  readonly unitTitle = model('');

  /** Collection name for the convert dialog. */
  readonly convertTitle = model('');

  /** Collection name for the start-collection dialog. */
  readonly collectionName = model('');
}
