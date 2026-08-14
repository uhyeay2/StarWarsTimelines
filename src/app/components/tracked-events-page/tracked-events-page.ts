import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LibraryItem } from '../../models/library-item';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';
import { AuthService } from '../../services/auth.service';
import { SOURCE_MATERIAL_CATALOG } from '../../services/library.data';
import { LibraryService } from '../../services/library.service';
import { TrackedItemRow } from '../tracked-item-row/tracked-item-row';

const FILTERS = ['All', ...TRACKING_STATUSES] as const;

export type TrackedFilter = (typeof FILTERS)[number];

@Component({
  selector: 'app-tracked-events-page',
  imports: [TrackedItemRow, RouterLink],
  templateUrl: './tracked-events-page.html',
  styleUrl: './tracked-events-page.scss',
})
export class TrackedEventsPage {
  private readonly auth = inject(AuthService);
  private readonly libraryService = inject(LibraryService);

  readonly user = toSignal(this.auth.currentUser$);
  readonly userId = computed(() => this.user()?.id ?? null);
  readonly tracked = signal<readonly LibraryItem[]>([]);
  readonly statuses = TRACKING_STATUSES;
  readonly catalog = SOURCE_MATERIAL_CATALOG;
  readonly filters = FILTERS;
  readonly filter = signal<TrackedFilter>('All');
  readonly draggedId = signal<string | null>(null);
  readonly selectedMaterialId = signal('');

  readonly trackedMaterialIds = computed(() => {
    const ids = new Set<string>();
    for (const item of this.tracked()) {
      ids.add(item.id);
    }
    return ids;
  });

  readonly addOptions = computed(() =>
    this.catalog.filter((material) => !this.trackedMaterialIds().has(material.id)),
  );

  readonly filteredItems = computed(() => {
    const currentFilter = this.filter();
    if (currentFilter === 'All') {
      return this.tracked();
    }
    return this.tracked().filter((item) => item.status === currentFilter);
  });

  readonly showReorder = computed(() => this.filter() === 'Wish Listed');

  constructor() {
    effect((onCleanup) => {
      const userId = this.userId();
      if (!userId) {
        this.tracked.set([]);
        return;
      }
      const subscription = this.libraryService
        .getTracked(userId)
        .subscribe((items) => this.tracked.set(items));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  setFilter(value: TrackedFilter): void {
    this.filter.set(value);
    this.draggedId.set(null);
  }

  setStatus(itemId: string, status: TrackingStatus): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setStatus(userId, itemId, status)
      .subscribe((items) => this.tracked.set(items));
  }

  toggleFavorite(itemId: string): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .toggleFavorite(userId, itemId)
      .subscribe((items) => this.tracked.set(items));
  }

  removeTracked(itemId: string): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .removeTracked(userId, itemId)
      .subscribe((items) => this.tracked.set(items));
  }

  onSelectMaterial(event: Event): void {
    this.selectedMaterialId.set((event.target as HTMLSelectElement).value);
  }

  addTracked(): void {
    const userId = this.userId();
    const materialId = this.selectedMaterialId();
    if (!userId || !materialId) {
      return;
    }
    this.libraryService.addTracked(userId, materialId).subscribe((items) => {
      this.tracked.set(items);
      this.selectedMaterialId.set('');
    });
  }

  moveTrackedItem(itemId: string, direction: -1 | 1): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .moveTrackedItem(userId, itemId, direction)
      .subscribe((items) => this.tracked.set(items));
  }

  onDragStart(itemId: string): void {
    this.draggedId.set(itemId);
  }

  onDragEnd(): void {
    this.draggedId.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  reorderTracked(targetId: string): void {
    const userId = this.userId();
    const draggedId = this.draggedId();
    if (!userId || !draggedId) {
      return;
    }
    this.draggedId.set(null);
    this.libraryService
      .reorderTrackedItem(userId, draggedId, targetId)
      .subscribe((items) => this.tracked.set(items));
  }
}
