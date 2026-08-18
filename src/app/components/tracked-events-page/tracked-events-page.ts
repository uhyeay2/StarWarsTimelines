import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { LibraryItem } from '../../models/library-item';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';
import { AuthService } from '../../services/auth.service';
import { CatalogService } from '../../services/catalog.service';
import { LibraryService } from '../../services/library/library.service';
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
  private readonly catalogService = inject(CatalogService);

  readonly user = this.auth.currentUser;
  readonly userId = computed(() => this.user()?.id ?? null);
  readonly tracked = signal<readonly LibraryItem[]>([]);
  readonly statuses = TRACKING_STATUSES;
  readonly catalog = computed(() => this.catalogService.sourceMaterials() ?? []);
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
    this.catalog().filter((material) => !this.trackedMaterialIds().has(material.id)),
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
      this.catalogService.fetchSourceMaterials();
      const trackedSubscription = this.libraryService
        .getTracked(userId)
        .subscribe((items) => this.tracked.set(items));
      onCleanup(() => {
        trackedSubscription.unsubscribe();
      });
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

  toggleFavorite(item: LibraryItem): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setFavorite(userId, item.id, !item.favorite)
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

  setUnitProgress(materialId: string, unitId: string, isCompleted: boolean): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setUnitProgress(userId, materialId, unitId, isCompleted)
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
    const material = this.catalog().find((entry) => entry.id === materialId);
    if (!material) {
      return;
    }
    this.libraryService.addTracked(userId, material).subscribe((items) => {
      this.tracked.set(items);
      this.selectedMaterialId.set('');
    });
  }

  moveTrackedItem(itemId: string, direction: -1 | 1): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    const items = [...this.tracked()];
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) {
      return;
    }
    const status = items[index].status;
    const group = items
      .map((item, position) => ({ item, position }))
      .filter(({ item }) => item.status === status);
    const groupIndex = group.findIndex(({ item }) => item.id === itemId);
    const targetIndex = groupIndex + direction;
    if (targetIndex < 0 || targetIndex >= group.length) {
      return;
    }
    const from = group[groupIndex].position;
    const to = group[targetIndex].position;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    this.applyOrder(next.map((item) => item.id));
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
    const items = [...this.tracked()];
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) {
      return;
    }
    const next = [...items];
    const [dragged] = next.splice(from, 1);
    next.splice(to, 0, dragged);
    this.applyOrder(next.map((item) => item.id));
  }

  private applyOrder(orderedSourceMaterialIds: readonly string[]): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .reorderTrackedItem(userId, orderedSourceMaterialIds)
      .subscribe((items) => this.tracked.set(items));
  }
}
