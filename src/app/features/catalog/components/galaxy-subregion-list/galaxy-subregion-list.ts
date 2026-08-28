import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  GalaxyCatalogHost,
  GalaxySubregionNode,
} from '../../../../features/catalog/models/galaxy-catalog-models';
import { GalaxyPlanetSystemList } from '../galaxy-planet-system-list/galaxy-planet-system-list';

/**
 * Subregion rows: one row per entry, optionally showing the "Part of" region
 * chips, expanding into the linked planet systems. Used both as the root of
 * the Subregions view and nested under each region; in the nested form its
 * trailing add row lets a new subregion be attached to that region.
 *
 * Purely presentational — every interaction is forwarded to the catalog host.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-subregion-list',
  imports: [GalaxyPlanetSystemList],
  templateUrl: './galaxy-subregion-list.html',
  styleUrl: './galaxy-subregion-list.scss',
})
export class GalaxySubregionList {
  /** Catalog host API. */
  readonly host = input.required<GalaxyCatalogHost>();

  /** The subregions to render, pre-filtered by the host's search term. */
  readonly nodes = input.required<readonly GalaxySubregionNode[]>();

  /** Whether the region links render as chips (top-level view only). */
  readonly showChips = input(false);

  /** Whether the trailing "+ Add subregion" row renders (nested lists only). */
  readonly showAdd = input(false);

  /** The region a new subregion is attached to, used by the trailing add row. */
  readonly addParentId = input<number | null>(null);
}
