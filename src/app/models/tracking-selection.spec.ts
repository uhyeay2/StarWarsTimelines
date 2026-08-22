import { LibraryItem, LibraryUnit } from './library-item';
import {
  findTrackedItem,
  groupTrackingStatus,
  groupUnitIsTracked,
  materialTrackingStatus,
  trackSelectOptions,
} from './tracking-selection';

function unit(partial: Partial<LibraryUnit> & { id: string }): LibraryUnit {
  return {
    unitType: 'Episode',
    number: 1,
    isCompleted: false,
    ...partial,
  };
}

const baseItem: LibraryItem = {
  id: 'mat-1',
  title: 'A Show',
  medium: 'Animated Show',
  status: 'In progress',
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
    expect(materialTrackingStatus(baseItem)).toBe('In progress');
  });

  it('returns null when untracked', () => {
    expect(materialTrackingStatus(null)).toBeNull();
  });
});

describe('groupUnitIsTracked', () => {
  const item: LibraryItem = {
    ...baseItem,
    units: [
      unit({ id: 'season-1', unitType: 'Season', number: 1 }),
      unit({ id: 'ep-1', groupNumber: 1 }),
    ],
  };

  it('is true only when that exact container is tracked', () => {
    const tracked: LibraryItem = {
      ...item,
      units: item.units!.map((u) =>
        u.id === 'season-1' ? { ...u, isTracked: true } : u,
      ),
    };

    expect(groupUnitIsTracked(tracked, 'season-1')).toBe(true);
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
      { ...baseItem, units: [unit({ id: 'v1', unitType: 'Volume', isTracked: true, isCompleted: true })] },
      'v1',
    );
    const wip = groupTrackingStatus(
      { ...baseItem, units: [unit({ id: 'v1', unitType: 'Volume', isTracked: true })] },
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
        unit({ id: 'e1', groupNumber: 1, isTracked: false }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBeNull();
  });

  it('reports Completed when every child is completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', groupNumber: 1, isTracked: true, isCompleted: true }),
        unit({ id: 'e2', groupNumber: 1, isTracked: true, isCompleted: true }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBe('Completed');
  });

  it('reports In progress when some children are completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', groupNumber: 1, isTracked: true, isCompleted: true }),
        unit({ id: 'e2', groupNumber: 1, isTracked: true, isCompleted: false }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBe('In progress');
  });

  it('reports Wish Listed when children are tracked but none completed', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 'e1', groupNumber: 1, isTracked: true }),
      ],
    };

    expect(groupTrackingStatus(item, 's1')).toBe('Wish Listed');
  });

  it('scopes child derivation to the selected container only', () => {
    const item: LibraryItem = {
      ...baseItem,
      units: [
        unit({ id: 's1', unitType: 'Season', number: 1 }),
        unit({ id: 's2', unitType: 'Season', number: 2 }),
        unit({ id: 'e1', groupNumber: 2, isTracked: true, isCompleted: true }),
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
        unit({ id: 'i5', groupNumber: 2, isTracked: true, isCompleted: true }),
      ],
    };

    expect(groupTrackingStatus(item, 'v2')).toBe('Completed');
  });
});
