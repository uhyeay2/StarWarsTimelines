import { Canon } from '../../../shared/models/canon';
import { Medium } from '../../../shared/models/medium';
import { SourceMaterialUnit } from '../../../shared/models/source-material';

/**
 * A single source material that depicts a timeline event, optionally pinned
 * to a specific sub-unit (episode, issue, chapter, level) of the material.
 */
export interface EventSource {
  /** Title of the source material. */
  readonly title: string;
  /** Medium of the source material. */
  readonly medium: Medium;
  /** Continuity coverage of the source material. */
  readonly canon: readonly Canon[];
  /** Server-assigned identifier of the source material. */
  readonly sourceId?: number;
  /** The specific unit depicting the event, when the event is tied to one. */
  readonly unit?: SourceMaterialUnit;
}

export interface TimelineEvent {
  readonly id: number;
  /**
   * Union of the continuity coverage across every source material that
   * depicts this event (e.g. an event covered by both a Canon movie and a
   * Legends comic yields `['Canon', 'Legends']`).
   */
  readonly canon: readonly Canon[];
  readonly title: string;
  readonly description: string;
  /** Every source material (with optional pinned unit) depicting this event. */
  readonly sources: readonly EventSource[];
  readonly locations: readonly string[];
  readonly characters: readonly string[];
  readonly vehicles: readonly string[];
  /** Earliest in-universe year the event could have occurred (negative BBY). */
  readonly yearStart: number;
  /** Latest in-universe year; equal to `yearStart` when known exactly. */
  readonly yearEnd: number;
  /** Ordering value for events sharing the same year span. */
  readonly sequence: number;
}

/** Formats a single galactic-timeline year (negative = BBY, positive = ABY). */
function formatYear(year: number): string {
  return year <= 0 ? `${-year} BBY` : `${year} ABY`;
}

/**
 * Formats a galactic-timeline date or date range for display.
 *
 * - Exact years collapse to a single label (`"32 BBY"`, `"5 ABY"`).
 * - Ranges within one era use an en dash (`"36–32 BBY"`, `"4–5 ABY"`).
 * - Ranges crossing the Battle of Yavin anchor show both eras
 *   (`"1 BBY – 5 ABY"`).
 *
 * @param yearStart  Earliest in-universe year (negative = BBY).
 * @param yearEnd    Latest in-universe year.
 * @returns A human-readable date label.
 */
export function formatGalacticYears(yearStart: number, yearEnd: number): string {
  if (yearStart === yearEnd) {
    return formatYear(yearStart);
  }
  if (yearStart >= 0) {
    return `${yearStart}–${yearEnd} ABY`;
  }
  if (yearEnd <= 0) {
    return `${-yearStart}–${-yearEnd} BBY`;
  }
  return `${formatYear(yearStart)} – ${formatYear(yearEnd)}`;
}
