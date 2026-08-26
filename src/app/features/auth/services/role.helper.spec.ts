import { mapRole } from './role.helper';

describe('mapRole', () => {
  it('maps 0 to Standard', () => {
    expect(mapRole(0)).toBe('Standard');
  });

  it('maps 1 to Admin', () => {
    expect(mapRole(1)).toBe('Admin');
  });

  it('falls back to Standard for unknown codes', () => {
    expect(mapRole(99)).toBe('Standard');
    expect(mapRole(-1)).toBe('Standard');
  });
});
