import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Dropdown option for searchable selects. */
export interface CatalogSelectOption {
  id: number;
  name: string;
}

/** Sentinel value representing "no selection"; catalog ids start at 1. */
const NONE = 0;

/**
 * Type-ahead combobox replacing native selects for long option lists.
 * Shows the selected name in a closed toggle; opening reveals a search
 * box plus a filtered option list. `value` is the selected id, with
 * `0` as the "no selection" sentinel (labelled via `noneLabel`).
 *
 * Two-way binds `value` to the host. Purely presentational.
 */
@Component({
  selector: 'app-searchable-select',
  imports: [FormsModule],
  templateUrl: './searchable-select.html',
  styleUrl: './searchable-select.scss',
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class SearchableSelect {
  /** Available options. */
  readonly options = input<readonly CatalogSelectOption[]>([]);

  /** Label for the built-in "no selection" entry; omit when required. */
  readonly noneLabel = input<string | null>(null);

  /** Accessible label for the collapsed control. */
  readonly ariaLabel = input.required<string>();

  /** Selected option id; `NONE` when nothing is selected. */
  readonly value = model(NONE);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly NONE = NONE;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.searchInput()?.nativeElement.focus();
      }
    });
  }

  /** All selectable entries: the optional none-sentinel plus options. */
  protected readonly allEntries = computed<CatalogSelectOption[]>(() => {
    const none = this.noneLabel();
    const base: CatalogSelectOption[] = none ? [{ id: NONE, name: none }] : [];
    return [...base, ...this.options()];
  });

  /** Entries matching the current query. */
  protected readonly entries = computed<CatalogSelectOption[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.allEntries();
    return q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all;
  });

  /** Name shown on the closed toggle. */
  protected readonly selectedName = computed(() => {
    const v = this.value();
    return this.allEntries().find((o) => o.id === v)?.name ?? '';
  });

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.query.set('');
    this.activeIndex.set(this.entries().findIndex((o) => o.id === this.value()));
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  pick(option: CatalogSelectOption): void {
    this.value.set(option.id);
    this.close();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeIndex() >= 0 && this.activeIndex() < this.entries().length) {
          this.pick(this.entries()[this.activeIndex()]);
        }
        break;
    }
  }

  protected onDocumentPointerDown(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private moveActive(delta: number): void {
    const count = this.entries().length;
    if (count === 0) {
      return;
    }
    const current = this.activeIndex();
    const next = Math.min(count - 1, Math.max(0, current < 0 ? 0 : current + delta));
    this.activeIndex.set(next);
  }
}
