import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import { User } from '../../../../shared/models/user';
import { TrackSelect } from '../../../library/components/track-select/track-select';
import { MaterialDisplayGroup } from '../source-material-catalog/catalog-display-facade';

/** Subset of the catalog host API used by the non-admin units view. */
export interface NonAdminUnitsHost {
  readonly unitsByMaterial: () => Record<number, readonly ApiSourceMaterialUnit[]>;
  readonly currentUser: () => User | null;
  getDisplayGroups(materialId: number): readonly MaterialDisplayGroup[];
  isSeasonExpanded(materialId: number, expandKey: number | string | null): boolean;
  toggleSeason(materialId: number, expandKey: number | string | null): void;
  unitLabel(unit: ApiSourceMaterialUnit): string;
  materialTracksViaContainers(materialId: number): boolean;
  getGroupTrackingOptions(materialId: number, containerId: number): readonly string[];
  getGroupCurrentStatus(materialId: number, containerId: number): TrackingStatus | null;
  onTrackGroupUnit(materialId: number, containerId: number, status: string): void;
}

/**
 * Non-admin expanded units view for one source material.
 *
 * Movies render nothing; Comics/Shows/Book-collections render season /
 * volume / book groups with group-level tracking; Books and Video Games
 * render their units flat.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-source-nonadmin-units',
  imports: [TrackSelect],
  templateUrl: './source-nonadmin-units.html',
  styleUrl: './source-nonadmin-units.scss',
})
export class SourceNonAdminUnits {
  /** Catalog host API. */
  readonly host = input.required<NonAdminUnitsHost>();

  /** The source material id whose units are displayed. */
  readonly materialId = input.required<number>();

  /** The source material's medium label. */
  readonly medium = input.required<string>();
}
