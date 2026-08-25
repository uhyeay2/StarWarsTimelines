/**
 * One source material depicting a timeline event, optionally pinned to a
 * single sub-unit of that material. The API stores at most one association
 * per event + material pair, so a material appears at most once.
 */
export interface EventSourceLinkInput {
  /** Server-assigned identifier of the source material. */
  sourceMaterialId: number;
  /** Pinned unit of the material, or `null` for whole-material coverage. */
  sourceMaterialUnitId: number | null;
}

/** Payload for creating or replacing a timeline event. */
export interface CreateTimelineEventInput {
  title: string;
  description: string;
  /** Earliest in-universe year the event could have occurred (negative BBY). */
  yearStart: number;
  /** Latest in-universe year; equal to `yearStart` when known exactly. */
  yearEnd: number;
  /** Ordering value for events sharing the same year span. */
  sequence: number;
  /** Source materials depicting the event; at least one is required. */
  sourceMaterials: readonly EventSourceLinkInput[];
  /** Identifiers of the characters appearing in the event. */
  characterIds: readonly number[];
  /** Identifiers of the locations the event takes place in. */
  locationIds: readonly number[];
  /** Identifiers of the vehicles appearing in the event. */
  vehicleIds: readonly number[];
}
