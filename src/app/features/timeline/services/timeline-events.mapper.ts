/**
 * @fileoverview Pure mapping and validation functions for timeline event DTOs.
 *
 * Converts wire-format DTOs (with numeric enum codes) into domain-level
 * interfaces (with string-union enums). These functions are stateless and
 * easily testable in isolation.
 *
 * Includes defensive validation guards that protect against malformed or
 * partially missing DTO fields from unexpected API responses.
 *
 * @see {@link TimelineEventDto} for the input wire format.
 * @see {@link TimelineEvent} for the output domain model.
 */

import { Canon, CANON_TIMELINES } from '../../../shared/models/canon';
import { mediumFromApiCode } from '../../../shared/models/medium';
import { EventSource, TimelineEvent } from '../models/timeline-event';
import { unitTypeFromApiCode } from '../../../shared/models/unit-type';
import {
  EventSourceMaterialDto,
  EventSourceMaterialLinkDto,
  EventSourceMaterialUnitDto,
  NamedEntityDto,
  TimelineEventDto,
} from './timeline-events.dto';

// ─── Canon mapping ──────────────────────────────────────────────────────────

/** Canonical lookup table indexed by the numeric API canon code. */
const CANON_BY_CODE: readonly Canon[][] = [['Canon'], ['Legends'], ['Canon', 'Legends']];

/**
 * Maps a numeric canon type code to its domain-level string array.
 *
 * @param code  Numeric index from the API response.
 * @returns The corresponding canon timeline labels.
 * @throws {Error} When the code does not map to a known canon type.
 */
export function canonFromApiCode(code: number): readonly Canon[] {
  const canon = CANON_BY_CODE[code];
  if (!canon) {
    throw new Error(`Unknown canon type code: ${code}`);
  }
  return canon;
}

// ─── Defensive validation guards ────────────────────────────────────────────

/**
 * Type guard that verifies a raw value has the required shape or a
 * {@link NamedEntityDto}.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `NamedEntityDto` contract.
 */
export function isValidNamedEntityDto(dto: unknown): dto is NamedEntityDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    typeof d['id'] === 'number' && typeof d['name'] === 'string' && (d['name'] as string).length > 0
  );
}

/**
 * Type guard that verifies a raw value has the required shape or a
 * {@link EventSourceMaterialDto}.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `EventSourceMaterialDto` contract.
 */
export function isValidSourceMaterialDto(dto: unknown): dto is EventSourceMaterialDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    typeof d['id'] === 'number' &&
    typeof d['title'] === 'string' &&
    typeof d['medium'] === 'number' &&
    typeof d['canonType'] === 'number'
  );
}

/**
 * Type guard that verifies a raw value has the required shape or a
 * {@link EventSourceMaterialUnitDto}.
 *
 * Checks for the presence and correct type of every mandatory field.
 * `null`-able fields (`title`, `parentUnitId`) are not validated beyond
 * type since `null` is a valid value for them.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `EventSourceMaterialUnitDto` contract.
 */
export function isValidSourceMaterialUnitDto(dto: unknown): dto is EventSourceMaterialUnitDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    typeof d['id'] === 'number' &&
    typeof d['unitType'] === 'number' &&
    typeof d['number'] === 'number'
  );
}

/**
 * Type guard that verifies a raw value has the required shape or an
 * {@link EventSourceMaterialLinkDto}.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `EventSourceMaterialLinkDto` contract.
 */
export function isValidSourceMaterialLinkDto(dto: unknown): dto is EventSourceMaterialLinkDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    isValidSourceMaterialDto(d['sourceMaterial']) &&
    (d['sourceMaterialUnit'] === null || isValidSourceMaterialUnitDto(d['sourceMaterialUnit']))
  );
}

/**
 * Type guard that verifies a raw value has the required shape or a
 * {@link TimelineEventDto}.
 *
 * Checks for the presence and correct type of every mandatory field.
 * The `sourceMaterials` array must be present; individual links are
 * validated via {@link isValidSourceMaterialLinkDto} during mapping.
 * Entity arrays are checked for being actual `Array`s; individual entity
 * validation is deferred to {@link isValidNamedEntityDto} during mapping.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `TimelineEventDto` contract.
 */
export function isValidTimelineEventDto(dto: unknown): dto is TimelineEventDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    typeof d['id'] === 'number' &&
    typeof d['title'] === 'string' &&
    typeof d['description'] === 'string' &&
    typeof d['yearStart'] === 'number' &&
    typeof d['yearEnd'] === 'number' &&
    typeof d['sequence'] === 'number' &&
    Array.isArray(d['sourceMaterials']) &&
    Array.isArray(d['characters']) &&
    Array.isArray(d['locations']) &&
    Array.isArray(d['vehicles'])
  );
}

// ─── Mapping functions ──────────────────────────────────────────────────────

/**
 * Maps a single {@link EventSourceMaterialLinkDto} to a domain-level
 * {@link EventSource}.
 *
 * Numeric `medium`, `unitType`, and `canonType` codes are converted to
 * string unions; `null` fields are mapped to `undefined`.
 *
 * @param link  The validated source material link DTO from the API.
 * @returns A fully mapped domain-level event source.
 */
export function mapEventSource(link: EventSourceMaterialLinkDto): EventSource {
  const material = link.sourceMaterial;
  const unit = link.sourceMaterialUnit;
  return {
    title: material.title,
    medium: mediumFromApiCode(material.medium),
    canon: canonFromApiCode(material.canonType),
    sourceId: material.id,
    ...(unit
      ? {
          unit: {
            id: unit.id,
            unitType: unitTypeFromApiCode(unit.unitType),
            number: unit.number,
            ...(unit.title !== null && { title: unit.title }),
            ...(unit.parentUnitId !== null && { parentUnitId: unit.parentUnitId }),
          },
        }
      : {}),
  };
}

/**
 * Unions the canon coverage across multiple event sources while keeping a
 * stable `Canon` before `Legends` order.
 *
 * @param sources  The mapped event sources.
 * @returns The distinct canon labels covered by any source.
 */
function unionCanon(sources: readonly EventSource[]): readonly Canon[] {
  const canon: Canon[] = [];
  for (const label of CANON_TIMELINES) {
    if (sources.some((source) => source.canon.includes(label))) {
      canon.push(label);
    }
  }
  return canon;
}

/**
 * Maps a single {@link TimelineEventDto} to a domain-level {@link TimelineEvent}.
 *
 * Numeric codes are converted to string unions. Source material links are
 * filtered through {@link isValidSourceMaterialLinkDto} to discard malformed
 * entries; entity arrays are filtered through {@link isValidNamedEntityDto}.
 *
 * @param dto  The raw timeline event DTO from the API.
 * @returns A fully mapped domain-level timeline event.
 */
export function mapTimelineEvent(dto: TimelineEventDto): TimelineEvent {
  const sources = dto.sourceMaterials.filter(isValidSourceMaterialLinkDto).map(mapEventSource);
  return {
    id: dto.id,
    canon: unionCanon(sources),
    title: dto.title,
    description: dto.description,
    sources,
    locations: dto.locations.filter(isValidNamedEntityDto).map((entity) => entity.name),
    characters: dto.characters.filter(isValidNamedEntityDto).map((entity) => entity.name),
    vehicles: dto.vehicles.filter(isValidNamedEntityDto).map((entity) => entity.name),
    yearStart: dto.yearStart,
    yearEnd: dto.yearEnd,
    sequence: dto.sequence,
  };
}
