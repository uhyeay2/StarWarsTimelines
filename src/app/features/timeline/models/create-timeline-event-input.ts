/**
 * @fileoverview Write-side payload for creating or replacing a timeline event.
 */
import { LocationReference } from '../../../shared/models/location-reference';

/** One source material depicting a timeline event, optionally pinned to a
 * single sub-unit of that material. The API stores at most one association
 * per event + material pair, so a material appears at most once.
 */
export interface EventSourceLinkInput {
  /** Server-assigned identifier of the source material. */
  readonly sourceMaterialId: number;
  /** Pinned unit of the material, or `null` for whole-material coverage. */
  readonly sourceMaterialUnitId: number | null;
}

/** Payload for creating or replacing a timeline event. */
export interface CreateTimelineEventInput {
  readonly title: string;
  readonly description: string;
  /** Earliest in-universe year the event could have occurred (negative BBY). */
  readonly yearStart: number;
  /** Latest in-universe year; equal to `yearStart` when known exactly. */
  readonly yearEnd: number;
  /** Ordering value for events sharing the same year span. */
  readonly sequence: number;
  /** Source materials depicting the event; at least one is required. */
  readonly sourceMaterials: readonly EventSourceLinkInput[];
  /** Identifiers of the characters appearing in the event. */
  readonly characterIds: readonly number[];
  /** Places where the event takes place, at any galaxy-hierarchy level. */
  readonly locations: readonly LocationReference[];
  /** Identifiers of the vehicles appearing in the event. */
  readonly vehicleIds: readonly number[];
}
