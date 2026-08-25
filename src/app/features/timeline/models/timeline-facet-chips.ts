import { isContainerOrCollectionUnit } from '../../../shared/models/unit-type';
import { EventSource, TimelineEvent } from './timeline-event';
import {
  FilterTreeNode,
  SourceFilterChip,
  collectTreeLeaves,
  sourceFacetKey,
} from './timeline-filters-types';

/**
 * Builds the source filter chips for a single source material of an event:
 * the material chip plus optional scope chips (season, volume, chapter, or
 * a book nested within a collection). Medium-level chips are handled once
 * per distinct medium by {@link sourceChipsForEvent}.
 *
 * @param source   The event source to build chips for.
 * @param sources  The source filter tree nodes.
 * @returns An array of source filter chips for this material.
 */
function materialChipsForSource(
  source: EventSource,
  sources: readonly FilterTreeNode[],
): readonly SourceFilterChip[] {
  const mediumNode = sources.find((node) => node.label === source.medium);
  const materialValue = source.sourceId !== undefined ? String(source.sourceId) : source.title;
  const materialNode = mediumNode?.children?.find((node) => node.value === materialValue);
  if (mediumNode === undefined || materialNode === undefined) {
    return [{ label: source.title, values: [sourceFacetKey(source)] }];
  }

  const chips: SourceFilterChip[] = [
    { label: materialNode.label, values: collectTreeLeaves(materialNode) },
  ];

  const unit = source.unit;
  if (unit !== undefined && source.sourceId !== undefined) {
    if (
      unit.parentUnitId !== undefined &&
      unit.parentUnitId !== null &&
      !isContainerOrCollectionUnit(unit.unitType)
    ) {
      const groupValue = `${source.sourceId}:${unit.parentUnitId}`;
      const groupNode = materialNode.children?.find((node) => node.value === groupValue);
      if (groupNode !== undefined) {
        chips.push({ label: groupNode.label, values: collectTreeLeaves(groupNode) });
      }
    } else if (unit.id !== undefined) {
      const unitValue = `${source.sourceId}:u${unit.id}`;
      const unitNode = materialNode.children?.find((node) => node.value === unitValue);
      if (unitNode !== undefined) {
        chips.push({ label: unitNode.label, values: [unitValue] });
      }
    }
  }

  return chips;
}

/**
 * Builds the source filter chips for a single timeline event.
 *
 * Constructs a hierarchy of chips across every source depicting the event:
 * one chip per distinct medium, then per material, and optional scope chips
 * (season, volume, chapter, nested book). Duplicate chips (same label and
 * values) are collapsed so two sources sharing a medium produce one medium
 * chip.
 *
 * @param event    The timeline event to build chips for.
 * @param sources  The source filter tree nodes.
 * @returns An array of source filter chips.
 */
export function sourceChipsForEvent(
  event: TimelineEvent,
  sources: readonly FilterTreeNode[],
): readonly SourceFilterChip[] {
  const chips: SourceFilterChip[] = [];
  const seen = new Set<string>();
  const push = (chip: SourceFilterChip): void => {
    const key = `${chip.medium === true ? 'm' : 's'}:${chip.label}:${chip.values.join('|')}`;
    if (!seen.has(key)) {
      seen.add(key);
      chips.push(chip);
    }
  };

  for (const medium of new Set(event.sources.map((source) => source.medium))) {
    const mediumNode = sources.find((node) => node.label === medium);
    if (mediumNode !== undefined) {
      push({
        label: mediumNode.label,
        values: collectTreeLeaves(mediumNode),
        medium: true,
      });
    }
  }

  for (const source of event.sources) {
    for (const chip of materialChipsForSource(source, sources)) {
      push(chip);
    }
  }

  return chips;
}
