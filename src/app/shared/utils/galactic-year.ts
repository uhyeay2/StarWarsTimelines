/**
 * @fileoverview Formatting helpers for galactic-timeline years.
 *
 * The API stores galactic years as signed integers: negative values count
 * backwards from the Battle of Yavin (BBY), positive and zero values count
 * forwards (ABY). A pair of values represents a range; an exact year is
 * stored as `earliest === latest`.
 */

/**
 * Formats one galactic year, e.g. `-19` → `"19 BBY"`, `5` → `"5 ABY"`.
 *
 * Returns `null` when the value is `null` or `undefined`.
 *
 * @param year  The signed galactic-timeline year.
 */
export function formatGalacticYear(year: number | null | undefined): string | null {
  if (year == null) {
    return null;
  }
  return year < 0 ? `${-year} BBY` : `${year} ABY`;
}

/**
 * Formats a galactic-year range as a single human-readable string.
 *
 * - Exact year (`earliest === latest`) → `"19 BBY"` (no dash).
 * - Range within one era → oldest-to-newest, e.g. `-88..-84` → `"84\u201388 BBY"`,
 *   `4..35` → `"4\u201335 ABY"`. Ranges are displayed in ascending order so
 *   the numbers read chronologically.
 * - Range spanning the Battle of Yavin → each endpoint formatted separately,
 *   e.g. `-1..1` → `"1 BBY \u2013 1 ABY"`.
 *
 * Returns `null` unless both bounds are present (the API stores ranges as
 * all-or-nothing pairs).
 *
 * @param earliest  The earliest year in the range (most negative).
 * @param latest    The latest year in the range.
 */
export function formatGalacticYearRange(
  earliest: number | null | undefined,
  latest: number | null | undefined,
): string | null {
  if (earliest == null || latest == null) {
    return null;
  }

  if (earliest === latest) {
    return formatGalacticYear(earliest);
  }

  if (earliest < 0 !== latest < 0) {
    // Era-spanning range: order endpoints chronologically instead of numerically.
    const [first, second] = earliest <= latest ? [earliest, latest] : [latest, earliest];
    return `${formatGalacticYear(first)} \u2013 ${formatGalacticYear(second)}`;
  }

  // Same-era range: one suffix, numbers ordered oldest-to-newest.
  const from = Math.min(Math.abs(earliest), Math.abs(latest));
  const to = Math.max(Math.abs(earliest), Math.abs(latest));
  return `${from}\u2013${to} ${earliest < 0 || latest < 0 ? 'BBY' : 'ABY'}`;
}
