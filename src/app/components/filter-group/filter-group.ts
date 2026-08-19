/**
 * @fileoverview Collapsible filter group component with search and tree structure.
 *
 * Renders a dropdown panel for a single facet category (Source, Location,
 * Characters, Vehicles) with a trigger button, search input, and a tree
 * of selectable options. Supports multi-level nesting via
 * {@link FilterTree} and search-based filtering.
 *
 * @see {@link FilterTree} for the recursive tree node renderer.
 * @see {@link Timeline} for the parent component that uses filter groups.
 */

import {
  Component,
  computed,
  HostListener,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { collectTreeLeaves, FilterTreeNode } from '../../models/timeline-filters';
import { FilterTree } from './filter-tree';

@Component({
  selector: 'app-filter-group',
  imports: [FilterTree],
  templateUrl: './filter-group.html',
  styleUrl: './filter-group.scss',
})
export class FilterGroup {
  // ─── Inputs ────────────────────────────────────────────────────────────

  /** Display label for the filter group (e.g. "Source", "Characters"). */
  readonly label = input.required<string>();

  /** The tree of selectable options for this facet category. */
  readonly options = input.required<readonly FilterTreeNode[]>();

  /** Two-way bindable model of the currently selected leaf values. */
  readonly selected = model<readonly string[]>([]);

  /** Default expansion depth for tree nodes. `-1` expands all levels. */
  readonly defaultExpandedDepth = input(-1);

  // ─── Internal state ────────────────────────────────────────────────────

  /** Whether the filter panel is currently open. */
  readonly open = signal(false);

  /** Current search query text for filtering options. */
  protected readonly query = signal('');

  // ─── Computed state ─────────────────────────────────────────────────────

  /** Number of currently selected values. */
  protected readonly selectedCount = computed(() => this.selected().length);

  /** Whether a search query is active. */
  protected readonly isSearching = computed(() => this.query().trim().length > 0);

  /**
   * Options filtered by the current search query.
   *
   * Returns the original options when no query is active, otherwise
   * recursively filters the tree to only include matching nodes.
   */
  protected readonly filteredOptions = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) {
      return this.options();
    }
    return this.options()
      .map((option) => filterNode(option, term))
      .filter((option): option is FilterTreeNode => option !== undefined);
  });

  // ─── Public methods ────────────────────────────────────────────────────

  /**
   * Toggles a tree node's selection state.
   *
   * If all leaf values under the node are currently selected, they are
   * deselected. Otherwise, all leaf values are selected.
   *
   * @param option  The tree node to toggle.
   */
  toggle(option: FilterTreeNode): void {
    const leaves = collectTreeLeaves(option);
    this.selected.update((current) => {
      const set = new Set(current);
      const allSelected = leaves.every((value) => set.has(value));
      if (allSelected) {
        for (const value of leaves) set.delete(value);
      } else {
        for (const value of leaves) set.add(value);
      }
      return [...set];
    });
  }

  /** Toggles the filter panel open/closed and clears the search query on open. */
  togglePanel(): void {
    this.open.update((isOpen) => {
      const next = !isOpen;
      if (next) {
        this.query.set('');
      }
      return next;
    });
  }

  /** Clears all selected values in this filter group. */
  clearSelection(): void {
    this.selected.set([]);
  }

  // ─── Host listeners ────────────────────────────────────────────────────

  /** Closes the panel when the Escape key is pressed. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }
}

/**
 * Recursively filters a tree node by a search term.
 *
 * Returns `undefined` if neither the node label nor any descendant
 * matches the term.
 *
 * @param node  The tree node to filter.
 * @param term  The lowercase search term.
 * @returns The filtered tree node, or `undefined` if no match.
 */
function filterNode(node: FilterTreeNode, term: string): FilterTreeNode | undefined {
  const labelMatches = node.label.toLowerCase().includes(term);
  const children = node.children
    ?.map((child) => filterNode(child, term))
    .filter((child): child is FilterTreeNode => child !== undefined);
  if (!labelMatches && (children === undefined || children.length === 0)) {
    return undefined;
  }
  return { ...node, children };
}
