import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  GalaxyCatalogHost,
  GalaxyRegionNode,
} from '../../../../features/catalog/models/galaxy-catalog-models';
import { GalaxySubregionList } from '../galaxy-subregion-list/galaxy-subregion-list';

/**
 * Regions browsing view: one region row per entry, each expanding into its
 * linked subregions rendered by {@link GalaxySubregionList}.
 *
 * Purely presentational — reads expansion, admin, edit, and delete state from
 * the catalog host and forwards every interaction to it.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-region-list',
  imports: [GalaxySubregionList],
  templateUrl: './galaxy-region-list.html',
  styleUrl: './galaxy-region-list.scss',
})
export class GalaxyRegionList {
  /** Catalog host API. */
  readonly host = input.required<GalaxyCatalogHost>();

  /** The regions to render, pre-filtered by the host's search term. */
  readonly nodes = input.required<readonly GalaxyRegionNode[]>();
}
