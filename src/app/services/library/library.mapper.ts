/**
 * @fileoverview Pure mapping functions for library DTOs.
 *
 * Converts wire-format DTOs (with numeric enum codes) into domain-level
 * interfaces (with string-union enums). These functions are stateless and
 * easily testable in isolation.
 *
 * Includes defensive validation guards that protect against malformed or
 * partially missing DTO fields from unexpected API responses.
 *
 * @see {@link LibraryItemDto} for the input wire format.
 * @see {@link LibraryItem} for the output domain model.
 */

import { LibraryItem, LibraryUnit } from '../../models/library-item';
import { mediumFromApiCode } from '../../models/medium';
import { statusFromApiCode } from '../../models/tracking-status';
import { unitTypeFromApiCode } from '../../models/unit-type';
import { LibraryItemDto, LibraryUnitDto } from './library.dto';

// ─── Defensive validation guards ────────────────────────────────────────────

/**
 * Type guard that verifies a raw value has the required shape of a
 * {@link LibraryUnitDto}.
 *
 * Checks for the presence and correct type of every mandatory field.
 * `null`-able fields (`groupNumber`, `title`) are not validated beyond
 * type since `null` is a valid value for them.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `LibraryUnitDto` contract.
 */
export function isValidUnitDto(dto: unknown): dto is LibraryUnitDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    typeof d['id'] === 'string' && (d['id'] as string).length > 0 &&
    typeof d['unitType'] === 'number' &&
    typeof d['number'] === 'number' &&
    typeof d['isCompleted'] === 'boolean'
  );
}

/**
 * Type guard that verifies a raw value has the required shape of a
 * {@link LibraryItemDto}.
 *
 * Checks for the presence and correct type of every mandatory field.
 * The `units` array is checked for being an actual `Array`; individual
 * unit validation is deferred to {@link isValidUnitDto} during mapping.
 *
 * @param dto  The value to validate.
 * @returns `true` when the value satisfies the `LibraryItemDto` contract.
 */
export function isValidItemDto(dto: unknown): dto is LibraryItemDto {
  if (typeof dto !== 'object' || dto === null) {
    return false;
  }
  const d = dto as Record<string, unknown>;
  return (
    typeof d['sourceMaterialId'] === 'string' && (d['sourceMaterialId'] as string).length > 0 &&
    typeof d['title'] === 'string' &&
    typeof d['medium'] === 'number' &&
    typeof d['canonType'] === 'number' &&
    typeof d['status'] === 'number' &&
    typeof d['isFavorite'] === 'boolean' &&
    Array.isArray(d['units'])
  );
}

// ─── Mapping functions ──────────────────────────────────────────────────────

/**
 * Maps a single {@link LibraryUnitDto} to a domain-level {@link LibraryUnit}.
 *
 * Numeric `unitType` codes are converted to string unions. `null` fields for
 * `groupNumber` and `title` are mapped to `undefined`.
 *
 * @param dto  The raw unit DTO with numeric enum codes.
 * @returns The mapped unit with string-union `unitType`.
 */
export function mapLibraryUnit(dto: LibraryUnitDto): LibraryUnit {
  return {
    id: dto.id,
    unitType: unitTypeFromApiCode(dto.unitType),
    groupNumber: dto.groupNumber ?? undefined,
    number: dto.number,
    title: dto.title ?? undefined,
    isCompleted: dto.isCompleted,
    isTracked: dto.isTracked,
  };
}

/**
 * Maps a {@link LibraryItemDto} to a domain-level {@link LibraryItem}.
 *
 * Numeric enum codes for `medium` and `status` are converted to string unions.
 * The `units` array is filtered through {@link isValidUnitDto} before mapping
 * so that malformed unit entries are silently dropped rather than causing
 * runtime errors.
 *
 * @param dto  The raw DTO with numeric enum codes.
 * @returns The mapped library item with string-union enums and a readonly units array.
 */
export function mapLibraryItem(dto: LibraryItemDto): LibraryItem {
  return {
    id: dto.sourceMaterialId,
    title: dto.title,
    medium: mediumFromApiCode(dto.medium),
    status: statusFromApiCode(dto.status),
    favorite: dto.isFavorite,
    units: dto.units
      .filter(isValidUnitDto)
      .map(mapLibraryUnit) as readonly LibraryUnit[],
  };
}
