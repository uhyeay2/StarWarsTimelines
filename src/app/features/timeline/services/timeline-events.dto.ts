/**
 * @fileoverview Internal wire-type DTOs for the timeline events API.
 *
 * These interfaces represent the raw JSON shapes returned by the ASP.NET Core
 * backend. They use numeric enum codes rather than the domain-level string
 * unions used throughout the Angular application.
 *
 * @see {@link TimelineEventsService} for the service that consumes these DTOs.
 */

/**
 * A named entity reference (character, location, or vehicle) as returned by
 * the API.
 */
export interface NamedEntityDto {
  /** Server-assigned unique identifier. */
  readonly id: number;
  /** Display name of the entity. */
  readonly name: string;
}

/**
 * Source material reference embedded in a timeline event response.
 *
 * The `medium` and `canonType` fields are numeric indices into the server-side
 * enums.
 */
export interface EventSourceMaterialDto {
  /** Server-assigned unique identifier. */
  readonly id: number;
  /** Title of the source material. */
  readonly title: string;
  /** Numeric index into the server-side `Medium` enum. */
  readonly medium: number;
  /** Numeric index into the server-side `CanonType` enum. */
  readonly canonType: number;
}

/**
 * Source material unit reference embedded in a timeline event response.
 *
 * The `unitType` field is a numeric index into the server-side enum.
 */
export interface EventSourceMaterialUnitDto {
  /** Server-assigned unique identifier. */
  readonly id: number;
  /** Numeric index into the server-side `UnitType` enum. */
  readonly unitType: number;
  /** Sequential number within its parent scope (e.g. episode or issue number). */
  readonly number: number;
  /** Optional title of the unit (e.g. episode title). */
  readonly title: string | null;
  /** Container unit this unit nests inside, or `null` for top-level units. */
  readonly parentUnitId: number | null;
}

/**
 * Association between a timeline event and one source material depicting it,
 * with an optional pinned sub-unit of that material.
 */
export interface EventSourceMaterialLinkDto {
  /** The source material that depicts the event. */
  readonly sourceMaterial: EventSourceMaterialDto;
  /** The specific unit depicting the event, or `null` for whole-material coverage. */
  readonly sourceMaterialUnit: EventSourceMaterialUnitDto | null;
}

/**
 * A galaxy-hierarchy place reference embedded in a timeline event response.
 *
 * Places may sit at any level of the galaxy hierarchy (region, subregion,
 * planet system, planet, or planet location). The `locationHierarchyType`
 * field is a numeric index into the server-side enum, and `name` is the
 * resolved display name — `null` when the referenced entry no longer exists.
 */
export interface TimelineEventLocationDto {
  /** Numeric index into the server-side `LocationHierarchyType` enum. */
  readonly locationHierarchyType: number;
  /** Identifier of the place inside that hierarchy level's table. */
  readonly locationId: number;
  /** Display name of the referenced place, or `null` when it no longer exists. */
  readonly name: string | null;
}

/** A galaxy placeholder reference used when persisting a timeline event. */
export interface EventLocationReference {
  /** Numeric index into the server-side `LocationHierarchyType` enum. */
  readonly locationHierarchyType: number;
  /** Identifier of the place inside that hierarchy level's table. */
  readonly locationId: number;
}

/**
 * Raw timeline event response body from the API.
 *
 * All enum-typed fields (`medium`, `unitType`, `canonType`,
 * `locationHierarchyType`) are numeric indices that must be mapped to domain
 * string unions before use. Canon coverage is per source material; an event
 * has no canon of its own.
 */
export interface TimelineEventDto {
  /** Server-assigned unique identifier. */
  readonly id: number;
  /** Display title of the event. */
  readonly title: string;
  /** Narrative description of the event. */
  readonly description: string;
  /** Earliest in-universe year the event could have occurred (negative BBY). */
  readonly yearStart: number;
  /** Latest in-universe year; equal to `yearStart` when known exactly. */
  readonly yearEnd: number;
  /** Ordering value for events sharing the same year span. */
  readonly sequence: number;
  /** Every source material (with optional pinned unit) depicting the event. */
  readonly sourceMaterials: readonly EventSourceMaterialLinkDto[];
  /** Characters involved in this event. */
  readonly characters: readonly NamedEntityDto[];
  /** Places where this event takes place (any galaxy-hierarchy level). */
  readonly locations: readonly TimelineEventLocationDto[];
  /** Vehicles featured in this event. */
  readonly vehicles: readonly NamedEntityDto[];
}

/**
 * Request body for creating or updating a timeline event.
 *
 * Mirrors the wire format expected by the ASP.NET Core backend.
 */
export interface CreateTimelineEventRequest {
  readonly title: string;
  readonly description: string;
  readonly yearStart: number;
  readonly yearEnd: number;
  readonly sequence: number;
  readonly sourceMaterials: readonly {
    readonly sourceMaterialId: number;
    readonly sourceMaterialUnitId: number | null;
  }[];
  readonly characterIds: readonly number[];
  readonly locations: readonly EventLocationReference[];
  readonly vehicleIds: readonly number[];
}
