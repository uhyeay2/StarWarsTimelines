import { formatGalacticYear, formatGalacticYearRange } from './galactic-year';

describe('formatGalacticYear', () => {
  it('formats negative years as BBY', () => {
    expect(formatGalacticYear(-19)).toBe('19 BBY');
    expect(formatGalacticYear(-900)).toBe('900 BBY');
  });

  it('formats positive years as ABY', () => {
    expect(formatGalacticYear(5)).toBe('5 ABY');
    expect(formatGalacticYear(35)).toBe('35 ABY');
  });

  it('formats zero as ABY', () => {
    expect(formatGalacticYear(0)).toBe('0 ABY');
  });

  it('returns null for missing years', () => {
    expect(formatGalacticYear(null)).toBeNull();
    expect(formatGalacticYear(undefined)).toBeNull();
  });
});

describe('formatGalacticYearRange', () => {
  it('formats an exact year without a dash', () => {
    expect(formatGalacticYearRange(-41, -41)).toBe('41 BBY');
    expect(formatGalacticYearRange(4, 4)).toBe('4 ABY');
  });

  it('formats a BBY range oldest-to-newest', () => {
    expect(formatGalacticYearRange(-88, -84)).toBe('84\u201388 BBY');
    expect(formatGalacticYearRange(-900, -890)).toBe('890\u2013900 BBY');
  });

  it('formats an ABY range oldest-to-newest', () => {
    expect(formatGalacticYearRange(4, 35)).toBe('4\u201335 ABY');
  });

  it('orders endpoints chronologically regardless of input order', () => {
    expect(formatGalacticYearRange(-84, -88)).toBe('84\u201388 BBY');
    expect(formatGalacticYearRange(35, 4)).toBe('4\u201335 ABY');
  });

  it('formats an era-spanning range with separate endpoints', () => {
    expect(formatGalacticYearRange(-1, 1)).toBe('1 BBY \u2013 1 ABY');
  });

  it('returns null when either bound is missing', () => {
    expect(formatGalacticYearRange(null, 5)).toBeNull();
    expect(formatGalacticYearRange(-19, null)).toBeNull();
    expect(formatGalacticYearRange(null, null)).toBeNull();
  });
});
