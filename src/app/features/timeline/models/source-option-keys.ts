import { EventSource } from './timeline-event';

/** Extracts the material id from an encoded leaf value, or `null`. */
export function materialIdOf(value: string): number | null {
  const id = Number(value.split(':')[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Extracts a trailing `u{unitId}` standalone-unit token, or `null`. */
export function standaloneUnitIdOf(value: string): number | null {
  const parts = value.split(':');
  if (parts.length === 2 && parts[1]!.startsWith('u')) {
    const id = Number(parts[1]!.slice(1));
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

/**
 * Extracts the unit id referenced by any scoped leaf value — either the
 * standalone `u{unitId}` token or the trailing id of a nested value — or
 * `null` for whole-material values.
 */
export function parsedUnitId(value: string): number | null {
  return standaloneUnitIdOf(value) ?? nestedUnitIdOf(value);
}

/** Extracts the unit id from `{materialId}:{parentUnitId}:{unitId}`, or `null`. */
export function nestedUnitIdOf(value: string): number | null {
  const parts = value.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const id = Number(parts[2]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Encodes one of an event's stored sources back into the exact dialog tree
 * leaf value that represents it, so editing round-trips without losing
 * granularity.
 *
 * Unlike the Timeline page's filter keys (which deliberately broaden episode
 * pins to their season so season filters match), this mirrors
 * {@link buildSourceOptions}' encodings precisely:
 * - Whole material: `"{materialId}"`
 * - Top-level unit: `"{materialId}:u{unitId}"`
 * - Nested unit: `"{materialId}:{parentUnitId}:{unitId}"`
 *
 * @param source  One of the event's source materials.
 * @returns The tree value, or `null` when the source has no server id.
 */
export function editSourceSelectionKey(source: EventSource): string | null {
  if (source.sourceId === undefined) {
    return null;
  }
  const unit = source.unit;
  if (unit === undefined || unit.id === undefined) {
    return String(source.sourceId);
  }
  if (unit.parentUnitId === undefined || unit.parentUnitId === null) {
    return `${source.sourceId}:u${unit.id}`;
  }
  return `${source.sourceId}:${unit.parentUnitId}:${unit.id}`;
}

/**
 * Encodes every stored source of an event into dialog tree values for edit
 * prefill, skipping sources without server ids.
 *
 * @param sources  The event's sources.
 * @returns Exact tree values preserving each pinned unit.
 */
export function editSourceSelectionKeys(sources: readonly EventSource[]): readonly string[] {
  return sources.map(editSourceSelectionKey).filter((value): value is string => value !== null);
}
