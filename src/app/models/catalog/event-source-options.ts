/**
 * @fileoverview Builds the nested "Source materials" option tree used by the
 * timeline-event dialogs, mirroring the advanced filter on the Timeline page
 * (medium → material → scope), and resolves checked tree leaves back into
 * source-material link payloads for the API.
 *
 * Leaf values encode their association scope so they can be parsed back:
 * - Whole material: `"{materialId}"`
 * - Standalone top-level unit (season, volume, chapter, …): `"{materialId}:u{unitId}"`
 * - Unit nested in a container (episode, issue, book…): `"{materialId}:{parentUnitId}:{unitId}"`
 *
 * The backend keys associations by event + material + pinned unit, so
 * {@link resolveSourceLinks} emits one link per checked scope: a whole-material
 * check wins over any other selection of that material, fully covered
 * containers collapse upward, and every remaining pin becomes its own link.
 */

import { ApiSourceMaterial } from '../api-source-material';
import { ApiSourceMaterialUnit } from '../api-source-material-unit';
import { MEDIA, Medium } from '../medium';
import { sourceUnitDisplayLabel, sourceUnitPathLabel } from '../source-material';
import { UnitType } from '../unit-type';
import { EventSourceLinkInput } from './create-timeline-event-input';
import { FilterTreeNode } from '../timeline-filters';
import { EventSource } from '../timeline-event';

/** Catalog inputs the tree builder needs: materials plus their unit lists. */
export interface SourceOptionContext {
  /** Every catalog source material. */
  materials: readonly ApiSourceMaterial[];
  /** Units per source-material ID (empty when not loaded or none exist). */
  unitsByMaterial: Readonly<Record<number, readonly ApiSourceMaterialUnit[]>>;
}

/**
 * Returns whether the unit type acts as a group header for child units.
 *
 * @param unitType  The unit type to test.
 */
function isContainer(unitType: UnitType): boolean {
  return (
    unitType === 'Season' ||
    unitType === 'Volume' ||
    unitType === 'Book' ||
    unitType === 'Collection'
  );
}

/** Sorts sibling units by number, then id, for stable display order. */
function byNumberThenId(a: ApiSourceMaterialUnit, b: ApiSourceMaterialUnit): number {
  return a.number - b.number || a.id - b.id;
}

/** Label for a container unit, e.g. `"Season 2"` or the published title. */
function containerLabel(unit: ApiSourceMaterialUnit): string {
  return sourceUnitDisplayLabel(unit);
}

/** Label for a leaf unit, e.g. `"Episode 3: The Siege of Mandalore"`. */
function leafLabel(unit: ApiSourceMaterialUnit): string {
  return sourceUnitDisplayLabel(unit);
}

/**
 * Builds the option node for one unit, recursively nesting its children.
 *
 * @param materialId  The owning material's id.
 * @param unit        The unit to render.
 * @param units       All units of the material (for child lookups).
 * @returns A tree node covering the unit and its descendants.
 */
function unitNode(
  materialId: number,
  unit: ApiSourceMaterialUnit,
  units: readonly ApiSourceMaterialUnit[],
): FilterTreeNode {
  const kids = units.filter((u) => u.parentUnitId === unit.id).sort(byNumberThenId);
  const value =
    unit.parentUnitId === null
      ? `${materialId}:u${unit.id}`
      : `${materialId}:${unit.parentUnitId}:${unit.id}`;
  const label = isContainer(unit.unitType) ? containerLabel(unit) : leafLabel(unit);
  if (kids.length === 0) {
    return { value, label };
  }
  return {
    value,
    label,
    children: kids.map((kid) => unitNode(materialId, kid, units)),
  };
}

/**
 * Builds the tree children for one material: one node per top-level unit
 * (recursively nesting containers). There is deliberately no "Whole" entry —
 * users are expected to pick the most granular scope available; materials
 * without units (movies) are their own leaf via the material node itself.
 *
 * @param materialId  The material the nodes describe.
 * @param title       The material title (unused; kept for signature clarity).
 * @param units       The material's units (may be empty).
 * @returns The material's child nodes; empty when the material has no units
 *          (the material node itself is then the selectable leaf).
 */
function materialChildren(
  materialId: number,
  title: string,
  units: readonly ApiSourceMaterialUnit[],
): FilterTreeNode[] {
  if (units.length === 0) {
    return [];
  }
  const children: FilterTreeNode[] = [];
  const roots = units.filter((u) => u.parentUnitId === null);
  for (const root of [...roots].sort(byNumberThenId)) {
    children.push(unitNode(materialId, root, units));
  }
  return children;
}

/**
 * Builds the nested source-material option tree grouped by medium, matching
 * the Timeline page's advanced-filter hierarchy.
 *
 * Materials whose units have not been loaded appear as simple whole-material
 * leaves; once units are cached, their scope nodes appear automatically.
 *
 * @param ctx  Catalog materials plus per-material unit lists.
 * @returns Tree nodes ready for a filter-group style dropdown.
 */
export function buildSourceOptions(ctx: SourceOptionContext): readonly FilterTreeNode[] {
  const byMedium = new Map<Medium, ApiSourceMaterial[]>();
  for (const material of [...ctx.materials].sort((a, b) => a.title.localeCompare(b.title))) {
    let list = byMedium.get(material.medium);
    if (!list) {
      list = [];
      byMedium.set(material.medium, list);
    }
    list.push(material);
  }

  const nodes: FilterTreeNode[] = [];
  for (const medium of MEDIA) {
    const materials = byMedium.get(medium);
    if (!materials) {
      continue;
    }
    nodes.push({
      value: `medium:${medium}`,
      label: medium,
      children: materials.map((material) => ({
        value: String(material.id),
        label: material.title,
        children: materialChildren(
          material.id,
          material.title,
          ctx.unitsByMaterial[material.id] ?? [],
        ),
      })),
    });
  }
  return nodes;
}

/** Extracts the material id from an encoded leaf value, or `null`. */
function materialIdOf(value: string): number | null {
  const id = Number(value.split(':')[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Extracts a trailing `u{unitId}` standalone-unit token, or `null`. */
function standaloneUnitIdOf(value: string): number | null {
  const parts = value.split(':');
  if (parts.length === 2 && parts[1].startsWith('u')) {
    const id = Number(parts[1].slice(1));
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

/**
 * Extracts the unit id referenced by any scoped leaf value — either the
 * standalone `u{unitId}` token or the trailing id of a nested value — or
 * `null` for whole-material values.
 */
function parsedUnitId(value: string): number | null {
  return standaloneUnitIdOf(value) ?? nestedUnitIdOf(value);
}

/** Extracts the unit id from `{materialId}:{parentUnitId}:{unitId}`, or `null`. */
function nestedUnitIdOf(value: string): number | null {
  const parts = value.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const id = Number(parts[2]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Collapses nested unit pins upward: whenever every child of a container is
 * among the pinned units, those children are replaced by the container
 * itself, repeating until nothing further collapses.
 *
 * @param units  All units of the material.
 * @param pins   Mutable working set of pinned unit ids.
 */
function collapseCoveredContainers(
  units: readonly ApiSourceMaterialUnit[],
  pins: Set<number>,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const container of units) {
      if (!pins.has(container.id)) {
        const children = units.filter((u) => u.parentUnitId === container.id);
        if (children.length > 0 && children.every((child) => pins.has(child.id))) {
          for (const child of children) {
            pins.delete(child.id);
          }
          pins.add(container.id);
          changed = true;
        }
      }
    }
  }
}

/**
 * Resolves the checked tree leaves into API link payloads — one per checked
 * scope, preserving sub-unit granularity.
 *
 * A whole-material check implies everything beneath it, so it wins over any
 * other selection of the same material. Otherwise every checked leaf keeps
 * its own association: two episodes of one season stay two separate links.
 * The only remaining collapse is upward: when a container's children are all
 * covered (for example every episode of Season 1 is checked), they are
 * replaced by a single pin on the container itself.
 *
 * @param ctx       Catalog materials plus per-material unit lists.
 * @param selected  The checked leaf values from the option tree.
 * @returns One link per distinct checked scope.
 */
export function resolveSourceLinks(
  ctx: SourceOptionContext,
  selected: readonly string[],
): EventSourceLinkInput[] {
  const byMaterial = new Map<number, Set<string>>();
  for (const value of selected) {
    const materialId = materialIdOf(value);
    if (materialId === null) {
      continue;
    }
    let values = byMaterial.get(materialId);
    if (!values) {
      values = new Set();
      byMaterial.set(materialId, values);
    }
    values.add(value);
  }

  const links: EventSourceLinkInput[] = [];
  for (const [materialId, values] of [...byMaterial.entries()].sort((a, b) => a[0] - b[0])) {
    if (values.has(String(materialId))) {
      links.push({ sourceMaterialId: materialId, sourceMaterialUnitId: null });
      continue;
    }

    const units = ctx.unitsByMaterial[materialId] ?? [];
    const pins = new Set<number>();
    for (const value of values) {
      const standalone = standaloneUnitIdOf(value);
      if (standalone !== null) {
        pins.add(standalone);
        continue;
      }
      const parts = value.split(':');
      if (parts.length === 2) {
        const containerId = Number(parts[1]);
        if (Number.isInteger(containerId) && containerId > 0) {
          pins.add(containerId);
        }
      } else if (parts.length === 3) {
        const unitId = Number(parts[2]);
        if (Number.isInteger(unitId) && unitId > 0) {
          pins.add(unitId);
        }
      }
    }

    collapseCoveredContainers(units, pins);

    // Every surviving pin becomes its own association so sub-unit
    // granularity is preserved end-to-end.
    for (const unitId of [...pins].sort((a, b) => a - b)) {
      links.push({ sourceMaterialId: materialId, sourceMaterialUnitId: unitId });
    }
  }
  return links;
}

/**
 * Removes the checked leaves that produced one resolved link, used by the
 * dialog's removable source chips.
 *
 * For a whole-material link this drops the whole-material leaf itself. For a
 * pinned-unit link it drops every checked leaf whose unit is the pin or sits
 * anywhere beneath it in the parent chain (removing a collapsed "Season 1"
 * chip clears all of the season's checked episodes).
 *
 * @param ctx        Catalog materials plus per-material unit lists.
 * @param selected   The current checked leaf values.
 * @param link       The resolved link whose chip was dismissed.
 * @returns A new selection without the values behind the link.
 */
export function removeSourceLink(
  ctx: SourceOptionContext,
  selected: readonly string[],
  link: EventSourceLinkInput,
): readonly string[] {
  const { sourceMaterialId } = link;
  const pinnedUnitId = link.sourceMaterialUnitId;
  if (pinnedUnitId === null) {
    const wholeValue = String(sourceMaterialId);
    return selected.filter((value) => value !== wholeValue);
  }
  const units: readonly ApiSourceMaterialUnit[] = ctx.unitsByMaterial[sourceMaterialId] ?? [];
  return selected.filter((value) => {
    if (materialIdOf(value) !== sourceMaterialId) {
      return true;
    }
    const unitId = parsedUnitId(value);
    if (unitId === null) {
      return true;
    }
    let current: ApiSourceMaterialUnit | undefined = units.find((u) => u.id === unitId);
    while (current !== undefined && current.id !== pinnedUnitId) {
      const parentId: number | null = current.parentUnitId ?? null;
      if (parentId === null) {
        return true;
      }
      current = units.find((u) => u.id === parentId);
    }
    // The loop exits either on the pin itself or when the chain ends.
    return current?.id !== pinnedUnitId;
  });
}

/**
 * Human-readable label for a resolved link's pinned unit, including its full
 * container path, e.g. `"Volume 2 - Issue 1: The Prisoner of Bogan"` or
 * `"Season 1 - Episode 3: The Siege of Mandalore"`.
 *
 * @param ctx   Catalog materials plus per-material unit lists.
 * @param link  The resolved link to describe.
 * @returns The unit's hierarchical label, or `null` for whole-material
 *          links (and while a pinned unit is not yet in the catalog cache).
 */
export function describeSourceLinkUnit(
  ctx: SourceOptionContext,
  link: EventSourceLinkInput,
): string | null {
  if (link.sourceMaterialUnitId === null) {
    return null;
  }
  const units = ctx.unitsByMaterial[link.sourceMaterialId] ?? [];
  const unit = units.find((u) => u.id === link.sourceMaterialUnitId);
  if (!unit) {
    return null;
  }
  const materialTitle = ctx.materials.find((m) => m.id === link.sourceMaterialId)?.title;
  return sourceUnitPathLabel(unit, (parentId) => units.find((u) => u.id === parentId), {
    materialTitle,
  });
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
