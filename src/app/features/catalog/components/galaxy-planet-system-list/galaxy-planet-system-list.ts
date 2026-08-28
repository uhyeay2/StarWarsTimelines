import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  GalaxyCatalogHost,
  GalaxySystemNode,
} from '../../../../features/catalog/models/galaxy-catalog-models';
import { GalaxyPlanetList } from '../galaxy-planet-list/galaxy-planet-list';

/**
 * Planet system rows: one row per entry, optionally showing the "Inside"
 * subregion chips, expanding into the system's planets. Used both as the root
 * of the Planet systems view and nested under each subregion; in the nested
 * form its trailing add row lets a new system be attached to that subregion.
 *
 * Purely presentational — every interaction is forwarded to the catalog host.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-planet-system-list',
  imports: [GalaxyPlanetList],
  templateUrl: './galaxy-planet-system-list.html',
  styleUrl: './galaxy-planet-system-list.scss',
})
export class GalaxyPlanetSystemList {
  /** Catalog host API. */
  readonly host = input.required<GalaxyCatalogHost>();

  /** The planet systems to render, pre-filtered by the host's search term. */
  readonly nodes = input.required<readonly GalaxySystemNode[]>();

  /** Whether the subregion links render as chips (top-level view only). */
  readonly showChips = input(false);

  /** Whether the trailing "+ Add planet system" row renders (nested lists only). */
  readonly showAdd = input(false);

  /** The subregion a new system is attached to, used by the trailing add row. */
  readonly addParentId = input<number | null>(null);
}
