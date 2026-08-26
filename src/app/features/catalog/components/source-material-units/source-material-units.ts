import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AdminUnitsHost, SourceAdminUnits } from '../source-admin-units/source-admin-units';
import {
  NonAdminUnitsHost,
  SourceNonAdminUnits,
} from '../source-nonadmin-units/source-nonadmin-units';

/** Subset of the catalog host API used by the units section wrapper. */
export interface SourceUnitsHost extends NonAdminUnitsHost, AdminUnitsHost {
  readonly isAdmin: () => boolean;
  readonly unitsLoading: () => boolean;
  readonly unitsError: () => string | null;
  showsUnitsFor(materialId: number): boolean;
}

/**
 * Expanded units section for one source material row.
 *
 * Owns the loading / error states and routes to the admin or non-admin
 * units view based on the viewer's role.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-source-material-units',
  imports: [SourceAdminUnits, SourceNonAdminUnits],
  templateUrl: './source-material-units.html',
  styleUrl: './source-material-units.scss',
})
export class SourceMaterialUnits {
  /** Catalog host API. */
  readonly host = input.required<SourceUnitsHost>();

  /** The source material id whose units are displayed. */
  readonly materialId = input.required<number>();

  /** The source material's medium label. */
  readonly medium = input.required<string>();
}
