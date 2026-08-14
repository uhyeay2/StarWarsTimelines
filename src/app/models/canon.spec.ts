import { matchesCanonView } from './canon';

describe('matchesCanonView', () => {
  it('includes events that belong to the selected timeline', () => {
    expect(matchesCanonView(['Canon'], 'Canon')).toBe(true);
    expect(matchesCanonView(['Legends'], 'Legends')).toBe(true);
  });

  it('excludes events that do not belong to the selected timeline', () => {
    expect(matchesCanonView(['Legends'], 'Canon')).toBe(false);
    expect(matchesCanonView(['Canon'], 'Legends')).toBe(false);
  });

  it('includes events that belong to both timelines in single-timeline views', () => {
    expect(matchesCanonView(['Canon', 'Legends'], 'Canon')).toBe(true);
    expect(matchesCanonView(['Canon', 'Legends'], 'Legends')).toBe(true);
  });

  it('only matches events that apply to both timelines in the combined view', () => {
    expect(matchesCanonView(['Canon', 'Legends'], 'Canon & Legends')).toBe(true);
    expect(matchesCanonView(['Canon'], 'Canon & Legends')).toBe(false);
    expect(matchesCanonView(['Legends'], 'Canon & Legends')).toBe(false);
  });
});
