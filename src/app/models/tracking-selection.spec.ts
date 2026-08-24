import { LibraryItem, LibraryUnit } from './library-item';
import {
  TrackedScopeMap,
  buildTrackedScope,
  depictionIsTracked,
  findTrackedItem,
  groupTrackingStatus,
  groupUnitIsTracked,
  isContainerUnit,
  materialTrackingStatus,
  trackSelectOptions,
} from './tracking-selection';

function unit(partial: Partial<LibraryUnit> & { id: number }): LibraryUnit {
  return {
    unitType: 'Episode',
    number: 1,
    status: null,
    ...partial,
  };
}

const baseItem: LibraryItem = {
  id: 11,
  title: 'A Show',
  medium: 'Animated Show',
  status: null,
  favorite: false,
};

describe('findTrackedItem', () => {
  it('finds the item matching the material id', () => {
    const items = [baseItem, { ...baseItem, id: 12 }];

    expect(findTrackedItem(items, 12)?.id).toBe(12);
  });

  it('returns null when the material is untracked', () => {
    expect(findTrackedItem([baseItem], 99)).toBeNull();
    expect(findTrackedItem([], 11)).toBeNull();
  });
});

describe('trackSelectOptions', () => {
  it('offers only statuses for untracked targets', () => {
    expect(trackSelectOptions(false)).toEqual(['In progress', 'Completed', 'Wish Listed']);
  });

  it('appends the remove option once tracked', () => {
    expect(trackSelectOptions(true)).toEqual([
      'In progress',
      'Completed',
      'Wish Listed',
      'remove',
    ]);
  });
});

describe('materialTrackingStatus', () => {
  it('returns the item status', () => {
    expect(materialTrackingStatus({ ...baseItem, status: 'In progress' })).toBe('In progress');
  });

  it('returns null for container-based materials and untracked items', () => {
    expect(materialTrackingStatus(baseItem)).toBeNull();
    expect(materialTrackingStatus(null)).toBeNull();
  });
});

describe('isContainerUnit', () => {
  it('recognizes season, volume, and book as containers', () => {
    expect(isContainerUnit('Season')).toBe(true);
    expect(isContainerUnit('Volume')).toBe(true);
    expect(isContainerUnit('Book')).toBe(true);
    expect(isContainerUnit('Episode')).toBe(false);
    expect(isContainerUnit('Chapter')).toBe(false);
    expect(isContainerUnit('Collection')).toBe(false);
  });
});

describe('groupUnitIsTracked', () => {
  it('is true when the container itself has a non-null status', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 101, unitType: 'Season', number: 1, status: 'In progress' }),
        unit({ id: 201, parentUnitId: 101 }),
      ],
    };

    expect(groupUnitIsTracked(item, 101)).toBe(true);
  });

  it('is true when a child unit is tracked via parentUnitId', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 101, unitType: 'Season', number: 1 }),
        unit({ id: 201, parentUnitId: 101, status: 'Completed' }),
      ],
    };

    expect(groupUnitIsTracked(item, 101)).toBe(true);
  });

  it('is false when neither the container nor its children are tracked', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 101, unitType: 'Season', number: 1 }),
        unit({ id: 201, parentUnitId: 101 }),
        unit({ id: 202, parentUnitId: 102, status: 'Completed' }),
      ],
    };

    expect(groupUnitIsTracked(item, 101)).toBe(false);
  });

  it('is false without an item or a units array', () => {
    expect(groupUnitIsTracked(null, 101)).toBe(false);
    expect(groupUnitIsTracked(baseItem, 101)).toBe(false);
  });
});

describe('groupTrackingStatus', () => {
  it('returns null when untracked or the container is missing', () => {
    expect(groupTrackingStatus(null, 101)).toBeNull();
    expect(groupTrackingStatus(baseItem, 101)).toBeNull();
  });

  it('derives Completed/In progress from a directly tracked container', () => {
    const done = groupTrackingStatus(
      { ...baseItem, units: [unit({ id: 301, unitType: 'Volume', status: 'Completed' })] },
      301,
    );
    const wip = groupTrackingStatus(
      { ...baseItem, units: [unit({ id: 301, unitType: 'Volume', status: 'In progress' })] },
      301,
    );

    expect(done).toBe('Completed');
    expect(wip).toBe('In progress');
  });

  it('returns null when no child of the container is tracked', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 311, unitType: 'Season', number: 1 }),
        unit({ id: 411, parentUnitId: 311 }),
      ],
    };

    expect(groupTrackingStatus(item, 311)).toBeNull();
  });

  it('reports Completed when every child is completed (parentUnitId matching)', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 501, unitType: 'Book', number: 1 }),
        unit({ id: 601, unitType: 'Chapter', number: 1, parentUnitId: 501, status: 'Completed' }),
        unit({ id: 602, unitType: 'Chapter', number: 2, parentUnitId: 501, status: 'Completed' }),
      ],
    };

    expect(groupTrackingStatus(item, 501)).toBe('Completed');
  });

  it('reports In progress when some but not all children are completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 311, unitType: 'Season', number: 1 }),
        unit({ id: 411, parentUnitId: 311, status: 'Completed' }),
        unit({ id: 412, parentUnitId: 311, status: 'In progress' }),
      ],
    };

    expect(groupTrackingStatus(item, 311)).toBe('In progress');
  });

  it('reports In progress when children are tracked but none completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 311, unitType: 'Season', number: 1 }),
        unit({ id: 411, parentUnitId: 311, status: 'In progress' }),
      ],
    };

    expect(groupTrackingStatus(item, 311)).toBe('In progress');
  });

  it('scopes child derivation to the selected container only', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 311, unitType: 'Season', number: 1 }),
        unit({ id: 312, unitType: 'Season', number: 2 }),
        unit({ id: 413, parentUnitId: 312, status: 'Completed' }),
      ],
    };

    expect(groupTrackingStatus(item, 311)).toBeNull();
    expect(groupTrackingStatus(item, 312)).toBe('Completed');
  });
});

describe('buildTrackedScope', () => {
  it('marks material-level items as all-covering', () => {
    const scope = buildTrackedScope([{ ...baseItem, id: 21, status: 'Completed' }]);

    expect(scope.get(21)).toBe('all');
  });

  it('collects tracked unit ids for container-based items', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 101, unitType: 'Season', number: 1, status: 'Completed' }),
        unit({ id: 201, parentUnitId: 101 }),
        unit({ id: 202, parentUnitId: 101 }),
      ],
    };
    const scope = buildTrackedScope([item]);

    expect(scope.get(11)).toEqual(new Set([101, 201, 202]));
  });

  it('skips items excluded by the status selection', () => {
    const items: LibraryItem[] = [
      { ...baseItem, id: 21, status: 'Completed' },
      { ...baseItem, id: 31, status: null },
      { ...baseItem, id: 22, status: 'Wish Listed' },
    ];

    const all = buildTrackedScope(items);
    expect(all.has(21)).toBe(true);
    expect(all.has(31)).toBe(true);
    expect(all.has(22)).toBe(true);

    const completedOnly = buildTrackedScope(items, ['Completed']);
    expect(completedOnly.has(21)).toBe(true);
    expect(completedOnly.has(31)).toBe(false);
    expect(completedOnly.has(22)).toBe(false);
  });
});

describe('depictionIsTracked', () => {
  const scope: TrackedScopeMap = new Map<number, 'all' | ReadonlySet<number>>([
    [21, 'all'],
    [31, new Set([101, 201])],
  ]);

  it('is false for materials outside the scope', () => {
    expect(depictionIsTracked(scope, 99, undefined)).toBe(false);
    expect(depictionIsTracked(scope, 99, 101)).toBe(false);
    expect(depictionIsTracked(scope, undefined, 101)).toBe(false);
  });

  it('is true for every depiction of a material-level scope', () => {
    expect(depictionIsTracked(scope, 21, undefined)).toBe(true);
    expect(depictionIsTracked(scope, 21, 909)).toBe(true);
  });

  it('is true for unpinned depictions of a unit-tracked material', () => {
    expect(depictionIsTracked(scope, 31, undefined)).toBe(true);
  });

  it('is true only for pinned units inside a unit-tracked scope', () => {
    expect(depictionIsTracked(scope, 31, 101)).toBe(true);
    expect(depictionIsTracked(scope, 31, 201)).toBe(true);
    expect(depictionIsTracked(scope, 31, 107)).toBe(false);
    expect(depictionIsTracked(scope, 31, 299)).toBe(false);
  });
});
