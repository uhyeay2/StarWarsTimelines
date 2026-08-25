import { addedTo, removedFrom, removedWithPrefix, toggledIn } from './set-operations';

describe('addedTo', () => {
  it('returns a new set containing the added value', () => {
    const source = new Set(['a']);
    const next = addedTo(source, 'b');

    expect(next).toEqual(new Set(['a', 'b']));
    expect(next).not.toBe(source);
  });

  it('leaves the original set untouched', () => {
    const source = new Set(['a']);
    addedTo(source, 'b');

    expect(source).toEqual(new Set(['a']));
  });
});

describe('removedFrom', () => {
  it('returns a new set without the removed value', () => {
    const next = removedFrom(new Set(['a', 'b']), 'a');

    expect(next).toEqual(new Set(['b']));
  });

  it('is a no-op when the value is absent', () => {
    const source = new Set(['a']);
    const next = removedFrom(source, 'missing');

    expect(next).toEqual(new Set(['a']));
  });
});

describe('toggledIn', () => {
  it('removes a present value', () => {
    const next = toggledIn(new Set(['a', 'b']), 'a');

    expect(next).toEqual(new Set(['b']));
  });

  it('adds an absent value', () => {
    const next = toggledIn(new Set(['a']), 'b');

    expect(next).toEqual(new Set(['a', 'b']));
  });
});

describe('removedWithPrefix', () => {
  it('removes only keys matching the prefix', () => {
    const updater = removedWithPrefix('mat-1:');
    const next = updater(new Set(['mat-1:1', 'mat-1:2', 'mat-2:1']));

    expect(next).toEqual(new Set(['mat-2:1']));
  });

  it('does not match partial prefixes across the separator', () => {
    const updater = removedWithPrefix('mat-1:');
    const next = updater(new Set(['mat-11:1', 'mat-1:1']));

    expect(next).toEqual(new Set(['mat-11:1']));
  });

  it('handles empty sets', () => {
    expect(removedWithPrefix('x:')(new Set())).toEqual(new Set());
  });
});
