import { Canon } from '../../../shared/models/canon';
import { Medium } from '../../../shared/models/medium';
import { SourceMaterialUnit } from '../../../shared/models/source-material';
import { formatGalacticYear, formatGalacticYearRange } from '../../../shared/utils/galactic-year';

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

/**
 * Formats a galactic-timeline date or date range for display.
 *
 * Delegates to the shared galactic-year utilities for consistent formatting.
 *
 * @param yearStart  Earliest in-universe year (negative = BBY).
 * @param yearEnd    Latest in-universe year.
 * @returns A human-readable date label.
 */
export function formatGalacticYears(yearStart: number, yearEnd: number): string {
  return formatGalacticYearRange(yearStart, yearEnd) ?? formatGalacticYear(yearStart) ?? '';
}
