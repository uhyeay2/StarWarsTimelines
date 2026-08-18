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

import { Canon } from '../../models/canon';
import { mediumFromApiCode } from '../../models/medium';
import { TimelineEvent } from '../../models/timeline-event';
import { unitTypeFromApiCode } from '../../models/unit-type';
import {
  EventSourceMaterialDto,
  EventSourceMaterialUnitDto,
  NamedEntityDto,
  TimelineEventDto,
} from './timeline-events.dto';

// ─── Canon mapping ──────────────────────────────────────────────────────────

/** Canonical lookup table indexed by the numeric API canon code. */
const CANON_BY_CODE: readonly Canon[][] = [
  ['Canon'],
  ['Legends'],
  ['Canon', 'Legends'],
];

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
 * Type guard that verifies a raw value has the required shape of a
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
    typeof d['id'] === 'string' && (d['id'] as string).length > 0 &&
    typeof d['name'] === 'string' && (d['name'] as string).length > 0
  );
}

/**
 * Type guard that verifies a raw value has the required shape of a
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
    typeof d['id'] === 'string' && (d['id'] as string).length > 0 &&
    typeof d['title'] === 'string' &&
    typeof d['medium'] === 'number' &&
    typeof d['canonType'] === 'number'
  );
}

/**
 * Type guard that verifies a raw value has the required shape of a
 * {@link EventSourceMaterialUnitDto}.
 *
 * Checks for the presence and correct type of every mandatory field.
 * `null`-able fields (`groupNumber`, `title`) are not validated beyond
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
    typeof d['id'] === 'string' && (d['id'] as string).length > 0 &&
    typeof d['unitType'] === 'number' &&
    typeof d['number'] === 'number'
  );
}

/**
 * Type guard that verifies a raw value has the required shape of a
 * {@link TimelineEventDto}.
 *
 * Checks for the presence and correct type of every mandatory field.
 * The `sourceMaterial` nested object is validated via
 * {@link isValidSourceMaterialDto}. `sourceMaterialUnit` may be `null`.
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
    typeof d['id'] === 'string' && (d['id'] as string).length > 0 &&
    typeof d['title'] === 'string' &&
    typeof d['description'] === 'string' &&
    typeof d['canonType'] === 'number' &&
    typeof d['year'] === 'number' &&
    typeof d['displayDate'] === 'string' &&
    isValidSourceMaterialDto(d['sourceMaterial']) &&
    (d['sourceMaterialUnit'] === null || isValidSourceMaterialUnitDto(d['sourceMaterialUnit'])) &&
    Array.isArray(d['characters']) &&
    Array.isArray(d['locations']) &&
    Array.isArray(d['vehicles'])
  );
}

// ─── Mapping functions ──────────────────────────────────────────────────────

/**
 * Maps a single {@link TimelineEventDto} to a domain-level {@link TimelineEvent}.
 *
 * Numeric `canonType`, `medium`, and `unitType` codes are converted to string
 * unions. `null` fields are mapped to `undefined`. Entity arrays are filtered
 * through {@link isValidNamedEntityDto} to discard malformed entries.
 *
 * @param dto  The raw timeline event DTO from the API.
 * @returns A fully mapped domain-level timeline event.
 */
export function mapTimelineEvent(dto: TimelineEventDto): TimelineEvent {
  return {
    id: dto.id,
    canon: canonFromApiCode(dto.canonType),
    title: dto.title,
    description: dto.description,
    source: {
      title: dto.sourceMaterial.title,
      medium: mediumFromApiCode(dto.sourceMaterial.medium),
      sourceId: dto.sourceMaterial.id,
      unit: dto.sourceMaterialUnit
        ? {
            unitType: unitTypeFromApiCode(dto.sourceMaterialUnit.unitType),
            groupNumber: dto.sourceMaterialUnit.groupNumber ?? undefined,
            number: dto.sourceMaterialUnit.number,
            title: dto.sourceMaterialUnit.title ?? undefined,
          }
        : undefined,
    },
    locations: dto.locations
      .filter(isValidNamedEntityDto)
      .map((entity) => entity.name),
    characters: dto.characters
      .filter(isValidNamedEntityDto)
      .map((entity) => entity.name),
    vehicles: dto.vehicles
      .filter(isValidNamedEntityDto)
      .map((entity) => entity.name),
    year: dto.year,
    displayDate: dto.displayDate,
    displayDateEnd: dto.displayDateEnd ?? undefined,
  };
}
