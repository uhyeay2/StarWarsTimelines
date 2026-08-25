import { filterByName } from './text-search';

interface Named {
  name: string;
}

const items: Named[] = [
  { name: 'Tatooine' },
  { name: 'Coruscant' },
  { name: 'taul' },
];

describe('filterByName', () => {
  it('matches case-insensitively', () => {
    expect(filterByName(items, 'tatoo')).toEqual([{ name: 'Tatooine' }]);
    expect(filterByName(items, 'TAU')).toEqual([{ name: 'taul' }]);
  });

  it('returns the input array unchanged for an empty term', () => {
    expect(filterByName(items, '')).toBe(items);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterByName(items, 'naboo')).toEqual([]);
  });
});
