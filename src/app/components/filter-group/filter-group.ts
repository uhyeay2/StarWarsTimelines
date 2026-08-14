import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-filter-group',
  imports: [],
  templateUrl: './filter-group.html',
  styleUrl: './filter-group.scss',
})
export class FilterGroup {
  readonly label = input.required<string>();
  readonly options = input.required<readonly string[]>();
  readonly selected = model<readonly string[]>([]);

  private readonly elementRef = inject(ElementRef);

  readonly open = signal(false);
  protected readonly query = signal('');

  protected readonly selectedCount = computed(() => this.selected().length);

  protected readonly filteredOptions = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) {
      return this.options();
    }
    return this.options().filter((option) => option.toLowerCase().includes(term));
  });

  toggle(option: string): void {
    this.selected.update((current) =>
      current.includes(option) ? current.filter((value) => value !== option) : [...current, option],
    );
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }
}
