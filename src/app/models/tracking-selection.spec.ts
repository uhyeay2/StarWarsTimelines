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

function unit(partial: Partial<LibraryUnit> & { id: string }): LibraryUnit {
  return {
    unitType: 'Episode',
    number: 1,
    status: null,
    ...partial,
  };
}

const baseItem: LibraryItem = {
  id: 'mat-1',
  title: 'A Show',
  medium: 'Animated Show',
  status: null,
  favorite: false,
};

describe('findTrackedItem', () => {
  it('finds the item matching the material id', () => {
    const items = [baseItem, { ...baseItem, id: 'mat-2' }];

    expect(findTrackedItem(items, 'mat-2')?.id).toBe('mat-2');
  });

  it('returns null when the material is untracked', () => {
    expect(findTrackedItem([baseItem], 'other')).toBeNull();
    expect(findTrackedItem([], 'mat-1')).toBeNull();
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
        unit({ id: 'season-1', unitType: 'Season', number: 1, status: 'In progress' }),
        unit({ id: 'ep-1', parentUnitId: 'season-1' }),
      ],
    };

    expect(groupUnitIsTracked(item, 'season-1')).toBe(true);
  });

  it('is true when a child unit is tracked via parentUnitId', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 'season-1', unitType: 'Season', number: 1 }),
        unit({ id: 'ep-1', parentUnitId: 'season-1', status: 'Completed' }),
      ],
    };

    expect(groupUnitIsTracked(item, 'season-1')).toBe(true);
  });

  it('is false when neither the container nor its children are tracked', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 'season-1', unitType: 'Season', number: 1 }),
        unit({ id: 'ep-1', parentUnitId: 'season-1' }),
        unit({ id: 'ep-2', parentUnitId: 'season-2', status: 'Completed' }),
      ],
    };

    expect(groupUnitIsTracked(item, 'season-1')).toBe(false);
  });

  it('is false without an item or a units array', () => {
    expect(groupUnitIsTracked(null, 'season-1')).toBe(false);
    expect(groupUnitIsTracked(baseItem, 'season-1')).toBe(false);
  });
});

describe('groupTrackingStatus', () => {
  it('returns null when untracked or the container is missing', () => {
    expect(groupTrackingStatus(null, 'season-1')).toBeNull();
    expect(groupTrackingStatus(baseItem, 'season-1')).toBeNull();
  });

  it('derives Completed/In progress from a directly tracked container', () => {
    const done = groupTrackingStatus(
      { ...baseItem, units: [unit({ id: 'v1', unitType: 'Volume', status: 'Completed' })] },
      'v1',
    );
    const wip = groupTrackingStatus(
      { ...baseItem, units: [unit({ id: 'v1', unitType: 'Volume', status: 'In progress' })] },
      'v1',
    );

    expect(done).toBe('Completed');
    expect(wip).toBe('In progress');
  });

  it('returns null when no child of the container is tracked', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', parentUnitId: 's1' }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBeNull();
  });

  it('reports Completed when every child is completed (parentUnitId matching)', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 'b1', unitType: 'Book', number: 1 }),
        unit({ id: 'c1', unitType: 'Chapter', number: 1, parentUnitId: 'b1', status: 'Completed' }),
        unit({ id: 'c2', unitType: 'Chapter', number: 2, parentUnitId: 'b1', status: 'Completed' }),
      ],
    };

    expect(groupTrackingStatus(item, 'b1')).toBe('Completed');
  });

  it('reports In progress when some but not all children are completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', parentUnitId: 's1', status: 'Completed' }),
        unit({ id: 'e2', parentUnitId: 's1', status: 'In progress' }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBe('In progress');
  });

  it('reports In progress when children are tracked but none completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', parentUnitId: 's1', status: 'In progress' }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBe('In progress');
  });

  it('falls back to group-number child matching without parentUnitId', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', groupNumber: 1, status: 'Completed' }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBe('Completed');
  });

  it('scopes child derivation to the selected container only', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 's2', unitType: 'Season', number: 2 }),
        unit({ id: 'e1', parentUnitId: 's2', status: 'Completed' }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBeNull();
    expect(groupTrackingStatus(item, 's2')).toBe('Completed');
  });

  it('ignores other containers when matching children by group number', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 'v2', unitType: 'Volume', number: 2 }),
        unit({ id: 'i5', groupNumber: 2, status: 'Completed' }),
      ],
    };

    expect(groupTrackingStatus(item, 'v2')).toBe('Completed');
  });
});

describe('buildTrackedScope', () => {
  it('marks material-level items as all-covering', () => {
    const scope = buildTrackedScope([{ ...baseItem, id: 'movie-1', status: 'Completed' }]);

    expect(scope.get('movie-1')).toBe('all');
  });

  it('collects tracked unit ids for container-based items', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 'season-1', unitType: 'Season', number: 1, status: 'Completed' }),
        unit({ id: 'ep-1', parentUnitId: 'season-1' }),
        unit({ id: 'ep-2', parentUnitId: 'season-1' }),
      ],
    };
    const scope = buildTrackedScope([item]);

    expect(scope.get('mat-1')).toEqual(new Set(['season-1', 'ep-1', 'ep-2']));
  });

  it('skips items excluded by the status selection', () => {
    const items: LibraryItem[] = [
      { ...baseItem, id: 'movie-1', status: 'Completed' },
      { ...baseItem, id: 'show-1', status: null },
      { ...baseItem, id: 'movie-2', status: 'Wish Listed' },
    ];

    const all = buildTrackedScope(items);
    expect(all.has('movie-1')).toBe(true);
    expect(all.has('show-1')).toBe(true);
    expect(all.has('movie-2')).toBe(true);

    const completedOnly = buildTrackedScope(items, ['Completed']);
    expect(completedOnly.has('movie-1')).toBe(true);
    expect(completedOnly.has('show-1')).toBe(false);
    expect(completedOnly.has('movie-2')).toBe(false);
  });
});

describe('depictionIsTracked', () => {
  const scope: TrackedScopeMap = new Map<string, 'all' | ReadonlySet<string>>([
    ['movie-1', 'all'],
    ['show-1', new Set(['season-1', 'ep-1'])],
  ]);

  it('is false for materials outside the scope', () => {
    expect(depictionIsTracked(scope, 'other', undefined)).toBe(false);
    expect(depictionIsTracked(scope, 'other', 'season-1')).toBe(false);
    expect(depictionIsTracked(scope, undefined, 'season-1')).toBe(false);
  });

  it('is true for every depiction of a material-level scope', () => {
    expect(depictionIsTracked(scope, 'movie-1', undefined)).toBe(true);
    expect(depictionIsTracked(scope, 'movie-1', 'chapter-9')).toBe(true);
  });

  it('is true for unpinned depictions of a unit-tracked material', () => {
    expect(depictionIsTracked(scope, 'show-1', undefined)).toBe(true);
  });

  it('is true only for pinned units inside a unit-tracked scope', () => {
    expect(depictionIsTracked(scope, 'show-1', 'season-1')).toBe(true);
    expect(depictionIsTracked(scope, 'show-1', 'ep-1')).toBe(true);
    expect(depictionIsTracked(scope, 'show-1', 'season-7')).toBe(false);
    expect(depictionIsTracked(scope, 'show-1', 'ep-99')).toBe(false);
  });
});
