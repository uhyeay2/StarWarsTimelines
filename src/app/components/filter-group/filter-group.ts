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
  readonly label = input.required<string>();
  readonly options = input.required<readonly FilterTreeNode[]>();
  readonly selected = model<readonly string[]>([]);
  readonly defaultExpandedDepth = input(-1);

  readonly open = signal(false);
  protected readonly query = signal('');

  protected readonly selectedCount = computed(() => this.selected().length);
  protected readonly isSearching = computed(() => this.query().trim().length > 0);

  protected readonly filteredOptions = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) {
      return this.options();
    }
    return this.options()
      .map((option) => filterNode(option, term))
      .filter((option): option is FilterTreeNode => option !== undefined);
  });

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

  togglePanel(): void {
    this.open.update((isOpen) => {
      const next = !isOpen;
      if (next) {
        this.query.set('');
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selected.set([]);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }
}

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
