import { UnitType } from '../../../../shared/models/unit-type';
import { Medium } from '../../../../shared/models/medium';

/** The unit type created at a material's top level, inferred from the medium. */
export function topLevelChildType(medium: Medium): UnitType {
  switch (medium) {
    case 'Animated Show':
    case 'Live Action Show':
      return 'Season';
    case 'Comic':
      return 'Volume';
    case 'Video Game':
      return 'Level';
    default:
      return 'Chapter';
  }
}

/** The child type nested inside a container unit, inferred from its type. */
export function nestedChildType(containerType: UnitType): UnitType {
  switch (containerType) {
    case 'Season':
      return 'Episode';
    case 'Volume':
      return 'Issue';
    default:
      return 'Chapter';
  }
}

/** Child type for a display group's container (chapters when ungrouped). */
export function nestedChildTypeFor(containerType: UnitType | null): UnitType {
  return containerType === null ? 'Chapter' : nestedChildType(containerType);
}
