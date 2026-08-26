/**
 * @fileoverview Shared filter tree types and utilities.
 *
 * Used by both the timeline filter sidebar and the reusable filter-group
 * components. Moved here from timeline-specific models to respect the
 * dependency direction: shared ← features.
 */

/** A selectable filter option with a value and display label. */
export interface FilterOption {
  /** The unique value used for matching. */
  readonly value: string;
  /** The human-readable display label. */
  readonly label: string;
}

/** A filter option that may contain nested children (tree structure). */
export interface FilterTreeNode extends FilterOption {
  /** Optional child nodes for hierarchical filtering. */
  readonly children?: readonly FilterTreeNode[];
}

/**
 * Creates a simple leaf-level filter option from a value string.
 *
 * @param value  The value and label for the option.
 * @returns A leaf {@link FilterTreeNode}.
 */
export function simpleOption(value: string): FilterTreeNode {
  return { value, label: value };
}

/**
 * Recursively collects all leaf values from a tree node.
 *
 * If the node has no children, returns its own value. Otherwise,
 * recursively collects from all descendants.
 *
 * @param node  The tree node to collect leaves from.
 * @returns An array of all leaf values.
 */
export function collectTreeLeaves(node: FilterTreeNode): string[] {
  if (node.children !== undefined && node.children.length > 0) {
    return node.children.flatMap(collectTreeLeaves);
  }
  return [node.value];
}
