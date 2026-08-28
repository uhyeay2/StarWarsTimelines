import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  GalaxyCatalogHost,
  GalaxyPlanetNode,
} from '../../../../features/catalog/models/galaxy-catalog-models';
import { GalaxyLocationList } from '../galaxy-location-list/galaxy-location-list';

/**
 * Planet rows nested under a planet system. Expanding a planet renders its
 * surface locations and a trailing "+ Add planet" row scoped to this system.
 *
 * Purely presentational — every interaction is forwarded to the catalog host.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-planet-list',
  imports: [GalaxyLocationList],
  templateUrl: './galaxy-planet-list.html',
  styleUrl: './galaxy-planet-list.scss',
})
export class GalaxyPlanetList {
  /** Catalog host API. */
  readonly host = input.required<GalaxyCatalogHost>();

  /** The planets to render. */
  readonly nodes = input.required<readonly GalaxyPlanetNode[]>();

  /** The owning planet system id used by the trailing add row. */
  readonly addParentId = input.required<number>();
}
