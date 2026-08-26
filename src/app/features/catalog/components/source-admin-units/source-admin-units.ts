import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { UnitType } from '../../../../shared/models/unit-type';
import { UnitAddContext, UnitKey } from '../source-material-catalog/unit-crud-facade';
import { MaterialDisplayGroup } from '../source-material-catalog/catalog-display-facade';
import { UnitEditForm } from '../unit-edit-form/unit-edit-form';

/** Subset of the catalog host API used by the admin units view. */
export interface AdminUnitsHost {
  readonly unitsByMaterial: () => Record<number, readonly ApiSourceMaterialUnit[]>;
  readonly unitEditKey: () => UnitKey | null;
  readonly unitConfirmDeleteKey: () => UnitKey | null;
  readonly unitDeletingKey: () => UnitKey | null;
  readonly unitSavingKey: () => UnitKey | null;
  readonly displayStrategy: () => Record<number, string>;
  getDisplayGroups(materialId: number): readonly MaterialDisplayGroup[];
  isSeasonExpanded(materialId: number, expandKey: number | string | null): boolean;
  toggleSeason(materialId: number, expandKey: number | string | null): void;
  unitLabel(unit: ApiSourceMaterialUnit): string;
  nestedChildTypeFor(containerType: UnitType | null): UnitType;
  openAddUnitPopup(context: UnitAddContext): void;
  beginUnitEdit(materialId: number, unit: ApiSourceMaterialUnit): void;
  requestUnitDelete(materialId: number, unit: ApiSourceMaterialUnit): void;
  saveUnitEdit(): void;
  cancelUnitEdit(): void;
  confirmUnitDelete(): void;
  cancelUnitDelete(): void;
}

/**
 * Admin expanded units view for one source material.
 *
 * Renders the units either flat or grouped by the display strategy chosen
 * by {@link AdminUnitsHost.displayStrategy}, including per-row inline edit
 * and delete affordances via the shared `adminUnitItem` template.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-source-admin-units',
  imports: [FormsModule, NgTemplateOutlet, UnitEditForm],
  templateUrl: './source-admin-units.html',
  styleUrl: './source-admin-units.scss',
})
export class SourceAdminUnits {
  /** Catalog host API. */
  readonly host = input.required<AdminUnitsHost>();

  /** The source material id whose units are displayed. */
  readonly materialId = input.required<number>();

  /** Edited unit number, two-way bound to the host's signal. */
  readonly editNumber = model<number | null>(null);

  /** Edited unit title, two-way bound to the host's signal. */
  readonly editTitle = model('');
}
