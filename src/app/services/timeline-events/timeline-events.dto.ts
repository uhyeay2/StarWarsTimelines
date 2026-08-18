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
  readonly id: string;
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
  readonly id: string;
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
  readonly id: string;
  /** Numeric index into the server-side `UnitType` enum. */
  readonly unitType: number;
  /** Group number (e.g. season or volume), or `null` if not applicable. */
  readonly groupNumber: number | null;
  /** Sequential number within the group (e.g. episode or issue number). */
  readonly number: number;
  /** Optional title of the unit (e.g. episode title). */
  readonly title: string | null;
}

/**
 * Raw timeline event response body from the API.
 *
 * All enum-typed fields (`canonType`, `medium`, `unitType`) are numeric
 * indices that must be mapped to domain string unions before use.
 */
export interface TimelineEventDto {
  /** Server-assigned unique identifier. */
  readonly id: string;
  /** Display title of the event. */
  readonly title: string;
  /** Narrative description of the event. */
  readonly description: string;
  /** Numeric index into the server-side `CanonType` enum. */
  readonly canonType: number;
  /** In-universe year (negative for BBY). */
  readonly year: number;
  /** Human-readable display date (e.g. "32 BBY"). */
  readonly displayDate: string;
  /** Optional end display date for multi-day/era events. */
  readonly displayDateEnd: string | null;
  /** The source material this event is derived from. */
  readonly sourceMaterial: EventSourceMaterialDto;
  /** Optional source material unit (episode, chapter, etc.). */
  readonly sourceMaterialUnit: EventSourceMaterialUnitDto | null;
  /** Characters involved in this event. */
  readonly characters: readonly NamedEntityDto[];
  /** Locations where this event takes place. */
  readonly locations: readonly NamedEntityDto[];
  /** Vehicles featured in this event. */
  readonly vehicles: readonly NamedEntityDto[];
}
