import { LocationHierarchyType } from './location-hierarchy-type';

/**
 * A polymorphic place reference: the identifier of a galaxy hierarchy row
 * paired with the level that owns it. Used when associating a timeline event
 * with a place at any level (region, subregion, planet system, planet, or
 * planet location).
 */
export interface LocationReference {
  /** The galaxy hierarchy level the place belongs to. */
  readonly locationHierarchyType: LocationHierarchyType;
  /** The identifier of the place inside that level's table. */
  readonly locationId: number;
}
