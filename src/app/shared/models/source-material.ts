import { Medium } from './medium';
import { UnitType } from './unit-type';

export interface SourceMaterialUnit {
  readonly id?: number;
  readonly unitType: UnitType;
  readonly number: number;
  /** Published unit title, or `null`/`undefined` when untitled. */
  readonly title?: string | null;
  /** The container unit (season/volume/book/collection) this unit nests inside. */
  readonly parentUnitId?: number | null;
}

export interface SourceMaterial {
  readonly title: string;
  readonly medium: Medium;
  readonly sourceId?: number;
  readonly unit?: SourceMaterialUnit;
}

/**
 * Builds a label for the container a unit nests inside, e.g.
 * `"Season 2"` for an episode whose parent season carries number 2.
 *
 * @param parent  The resolved container unit, or `undefined` when unknown.
 * @returns The group prefix such as `Season 2`, or `undefined`.
 */
function containerPrefix(parent: SourceMaterialUnit | undefined): string | undefined {
  if (parent === undefined) {
    return undefined;
  }
  switch (parent.unitType) {
    case 'Season':
      return `Season ${parent.number}`;
    case 'Volume':
      return `Volume ${parent.number}`;
    case 'Book':
      return `Book ${parent.number}`;
    case 'Collection':
      return `Collection ${parent.number}`;
    default:
      return `${parent.unitType} ${parent.number}`;
  }
}

export function sourceUnitLabel(unit: SourceMaterialUnit, parent?: SourceMaterialUnit): string {
  const prefix = containerPrefix(parent);
  let base: string;
  switch (unit.unitType) {
    case 'Episode':
      base = prefix === undefined ? `Episode ${unit.number}` : `${prefix} · Episode ${unit.number}`;
      break;
    case 'Issue':
      base = prefix === undefined ? `Issue ${unit.number}` : `${prefix} · Issue ${unit.number}`;
      break;
    case 'Chapter':
      base = `Chapter ${unit.number}`;
      break;
    case 'Level':
      base = `Level ${unit.number}`;
      break;
    default:
      base = `${unit.unitType} ${unit.number}`;
      break;
  }
  return unit.title ? `${base}: ${unit.title}` : base;
}

/**
 * Builds a display label for one unit: `"{unitType} {number}"`, suffixed
 * with `": {title}"` unless the title merely repeats the generated base
 * (e.g. a season titled "Season 1"), which would render redundantly.
 *
 * @param unit  The unit to label.
 * @returns The deduplicated label, e.g. `"Season 1"` or `"Issue 1: Part 1"`.
 */
export function sourceUnitDisplayLabel(unit: SourceMaterialUnit): string {
  const base = `${unit.unitType} ${unit.number}`;
  const title = unit.title?.trim();
  if (!title || title.toLowerCase() === base.toLowerCase()) {
    return base;
  }
  return `${base}: ${title}`;
}

/**
 * Builds a hierarchical label for a unit by walking its ancestor chain from
 * root to leaf, joined with `" - "`:
 *
 * - Episode in a season: `"Season 1 - Episode 3: The Siege of Mandalore"`
 * - Issue in a volume: `"Volume 2: Force War - Issue 1: Part 1"`
 * - Chapter in a book: `"Book 2: Dark Times - Chapter 4"` / standalone
 *   book: `"Book 3: Kenobi"`
 *
 * Redundancy is trimmed along the way:
 * - Titles repeating their own type+number are dropped ("Season 1: Season 1"
 *   renders as just "Season 1").
 * - Segments whose title equals the material's title (e.g. a collection
 *   named after its trilogy, already shown beside the chip) are omitted as
 *   long as other segments remain.
 *
 * @param unit          The leaf unit to describe.
 * @param resolveParent Optional lookup resolving a `parentUnitId` to its
 *                      unit; without it only the leaf itself is labelled.
 * @param options       Optional extra context; `materialTitle` enables the
 *                      duplicate-of-material-title trimming described above.
 * @returns The full path label, e.g. `"Season 1 - Episode 3: Title"`.
 */
export function sourceUnitPathLabel(
  unit: SourceMaterialUnit,
  resolveParent?: (parentUnitId: number) => SourceMaterialUnit | undefined,
  options?: { materialTitle?: string },
): string {
  const segments: SourceMaterialUnit[] = [];
  let current: SourceMaterialUnit | undefined = unit;
  // Guard against malformed cyclic parent chains.
  let depth = 0;
  while (current !== undefined && depth < 16) {
    segments.unshift(current);
    const parentId: number | null = current.parentUnitId ?? null;
    current =
      parentId !== null && resolveParent !== undefined ? resolveParent(parentId) : undefined;
    depth++;
  }
  const materialTitleKey = options?.materialTitle?.trim().toLowerCase();
  const labelled =
    materialTitleKey !== undefined && materialTitleKey !== ''
      ? segments.filter((segment) => segment.title?.trim().toLowerCase() !== materialTitleKey)
      : segments;
  return (labelled.length > 0 ? labelled : segments).map(sourceUnitDisplayLabel).join(' - ');
}

/** The container kind ("Season" / "Volume") a child unit type groups under. */
export function sourceGroupName(unitType: UnitType): string | undefined {
  switch (unitType) {
    case 'Episode':
    case 'Season':
      return 'Season';
    case 'Issue':
    case 'Volume':
      return 'Volume';
    default:
      return undefined;
  }
}

export function sourceUnitDetail(
  unit: SourceMaterialUnit,
  parent?: SourceMaterialUnit,
): string | undefined {
  const prefix = containerPrefix(parent);
  switch (unit.unitType) {
    case 'Episode':
    case 'Issue': {
      const noun = unit.unitType === 'Episode' ? 'Episode' : 'Issue';
      const base =
        prefix === undefined ? `${noun} ${unit.number}` : `${prefix} · ${noun} ${unit.number}`;
      return unit.title ? `${base}: ${unit.title}` : base;
    }
    case 'Chapter':
      return unit.title ? `Chapter ${unit.number}: ${unit.title}` : undefined;
    case 'Season':
      return `Season ${unit.number}`;
    case 'Volume':
      return `Volume ${unit.number}`;
    case 'Level':
      return `Level ${unit.number}`;
    case 'Collection':
      return `Collection ${unit.number}`;
    case 'Book':
      return unit.title ? `Book ${unit.number}: ${unit.title}` : `Book ${unit.number}`;
  }
}
