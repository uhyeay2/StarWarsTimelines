import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  collectTreeLeaves,
  FilterTreeNode,
} from '../../../features/timeline/models/timeline-filters';

@Directive({
  selector: '[appIndeterminate]',
})
export class IndeterminateDirective {
  private readonly element = inject(ElementRef<HTMLInputElement>);

  readonly appIndeterminate = input<boolean | undefined>();

  constructor() {
    effect(() => {
      this.element.nativeElement.indeterminate = this.appIndeterminate() === true;
    });
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-filter-tree',
  imports: [IndeterminateDirective],
  templateUrl: './filter-tree.html',
  styleUrl: './filter-tree.scss',
})
export class FilterTree {
  readonly node = input.required<FilterTreeNode>();
  readonly depth = input(0);
  readonly defaultExpandedDepth = input(1);
  readonly selected = input.required<readonly string[]>();
  readonly searching = input(false);

  readonly toggle = output<FilterTreeNode>();

  protected readonly expanded = signal(true);
  private readonly toggled = signal(false);

  protected readonly children = computed(() => this.node().children ?? []);
  protected readonly isParent = computed(() => this.children().length > 0);

  protected readonly state = computed(() => {
    const leaves = collectTreeLeaves(this.node());
    const selected = new Set(this.selected());
    let count = 0;
    for (const value of leaves) {
      if (selected.has(value)) {
        count += 1;
      }
    }
    return { checked: count === leaves.length, indeterminate: count > 0 && count < leaves.length };
  });

  constructor() {
    effect(() => {
      if (!this.toggled()) {
        this.expanded.set(this.depth() <= this.defaultExpandedDepth());
      }
    });
  }

  protected toggleExpanded(): void {
    this.toggled.set(true);
    this.expanded.update((value) => !value);
  }

  protected onToggle(): void {
    this.toggle.emit(this.node());
  }
}
