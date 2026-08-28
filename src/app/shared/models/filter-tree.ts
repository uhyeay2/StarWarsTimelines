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
  /**
   * When `true`, this node is selectable in its own right even though it has
   * children — selecting it toggles its own value plus every descendant value.
   * Used by place-name hierarchies (region -> planet -> location) where a
   * parent is itself a matchable place. Defaults to `false` for pure grouping
   * containers (e.g. source mediums).
   */
  readonly ownLeaf?: boolean;
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
 * recursively collects from all descendants. When the node carries
 * `ownLeaf` (a node that is a selectable value in its own right while also
 * having children), its own value is included alongside the descendants.
 *
 * @param node  The tree node to collect leaves from.
 * @returns An array of all leaf values.
 */
export function collectTreeLeaves(node: FilterTreeNode): string[] {
  if (node.children !== undefined && node.children.length > 0) {
    const descendants = node.children.flatMap(collectTreeLeaves);
    return node.ownLeaf !== true ? descendants : [...descendants, node.value];
  }
  return [node.value];
}
