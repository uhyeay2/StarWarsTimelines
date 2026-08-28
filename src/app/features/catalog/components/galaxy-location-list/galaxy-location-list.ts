import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  GalaxyCatalogHost,
  GalaxyLocationNode,
} from '../../../../features/catalog/models/galaxy-catalog-models';

/**
 * Leaf rows for a planet's surface locations, plus the trailing "+ Add
 * location" row scoped to that planet.
 *
 * Purely presentational — every interaction is forwarded to the catalog host.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-location-list',
  templateUrl: './galaxy-location-list.html',
  styleUrl: './galaxy-location-list.scss',
})
export class GalaxyLocationList {
  /** Catalog host API. */
  readonly host = input.required<GalaxyCatalogHost>();

  /** The locations to render. */
  readonly nodes = input.required<readonly GalaxyLocationNode[]>();

  /** The owning planet id used by edit rows and the trailing add row. */
  readonly addParentId = input.required<number>();
}
