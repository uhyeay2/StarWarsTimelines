/**
 * @fileoverview Tracked Events page component.
 *
 * Manages the user's library of tracked source materials. Displays a
 * filterable, reorderable list of tracked items with status controls,
 * favorites, drag-and-drop reordering, and unit progress tracking.
 *
 * @see {@link TrackedItemRow} for the individual row component.
 * @see {@link KnownTimelinePage} for the per-source timeline view.
 * @see {@link LibraryService} for the backend API integration.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { LibraryItem } from '../../models/library-item';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';
import { AuthService } from '../../services/auth/auth.service';
import { LibraryService } from '../../services/library/library.service';
import { TrackedItemRow } from '../tracked-item-row/tracked-item-row';
import { LoginPrompt } from '../login-prompt/login-prompt';

/** Available status filter options for the filter tabs. */
const FILTERS = ['All', ...TRACKING_STATUSES] as const;

/** Union type for the tracked item filter values. */
export type TrackedFilter = (typeof FILTERS)[number];

@Component({
  selector: 'app-tracked-events-page',
  imports: [TrackedItemRow, LoginPrompt],
  templateUrl: './tracked-events-page.html',
  styleUrl: './tracked-events-page.scss',
})
export class TrackedEventsPage {
  // ─── Injected services ──────────────────────────────────────────────────

  /** Authentication service for the current user. */
  private readonly auth = inject(AuthService);

  /** Library service for managing tracked items. */
  private readonly libraryService = inject(LibraryService);

  // ─── User state ─────────────────────────────────────────────────────────

  /** The currently authenticated user, or `null`. */
  readonly user = this.auth.currentUser;

  /** The current user's ID, or `null`. */
  readonly userId = computed(() => this.user()?.id ?? null);

  /**
   * The user's tracked library items, read from {@link LibraryService}'s
   * shared signal cache (survives route navigation; no refetch on revisit).
   */
  readonly tracked = computed(() => this.libraryService.items());

  /** Whether a library fetch is currently in flight. */
  readonly isLoading = computed(() => this.libraryService.loading());

  /** The last library load error message, or `null`. */
  readonly error = computed(() => this.libraryService.error());

  // ─── Catalog data ───────────────────────────────────────────────────────

  /** All available tracking status options. */
  readonly statuses = TRACKING_STATUSES;

  // ─── Filter state ───────────────────────────────────────────────────────

  /** Available filter tab options. */
  readonly filters = FILTERS;

  /** Currently active status filter. */
  readonly filter = signal<TrackedFilter>('All');

  // ─── Drag-and-drop state ────────────────────────────────────────────────

  /** ID of the item currently being dragged, or `null`. */
  readonly draggedId = signal<string | null>(null);

  // ─── Computed state ─────────────────────────────────────────────────────

  /** Tracked items filtered by the active status filter. */
  readonly filteredItems = computed(() => {
    const currentFilter = this.filter();
    if (currentFilter === 'All') {
      return this.tracked();
    }
    return this.tracked().filter((item) => item.status === currentFilter);
  });

  /** Whether to show reorder controls (only for "Wish Listed" filter). */
  readonly showReorder = computed(() => this.filter() === 'Wish Listed');

  // ─── Constructor ────────────────────────────────────────────────────────

  constructor() {
    // Load the library through the service's shared cache: `ensureTracked`
    // fetches only when the data is not already cached for this user, so
    // navigating away and back renders instantly without a refetch.
    effect(() => {
      const userId = this.userId();
      if (!userId) {
        this.libraryService.clearCache();
        return;
      }
      this.libraryService.ensureTracked(userId);
    });
  }

  // ─── Filter methods ─────────────────────────────────────────────────────

  /**
   * Sets the active status filter and clears any drag state.
   *
   * @param value  The status filter to apply.
   */
  setFilter(value: TrackedFilter): void {
    this.filter.set(value);
    this.draggedId.set(null);
  }

  // ─── Status / tracking methods ──────────────────────────────────────────

  /**
   * Updates the tracking status of a tracked item.
   *
   * @param itemId  The source material ID.
   * @param status  The new tracking status.
   */
  setStatus(itemId: string, status: TrackingStatus): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setStatus(userId, itemId, status)
      .subscribe();
  }

  /**
   * Toggles the favorite status of a tracked item.
   *
   * @param item  The tracked item to toggle.
   */
  toggleFavorite(item: LibraryItem): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setFavorite(userId, item.id, !item.favorite)
      .subscribe();
  }

  /**
   * Removes a tracked item from the library.
   *
   * @param itemId  The source material ID to remove.
   */
  removeTracked(itemId: string): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .removeTracked(userId, itemId)
      .subscribe();
  }

/**
    * Sets the status of a unit (season/volume) within a tracked item.
    *
    * @param materialId  The source material ID.
    * @param unitId      The unit ID to update.
    * @param status      The new tracking status.
    */
  setGroupStatus(materialId: string, unitId: string, status: TrackingStatus): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setStatus(userId, materialId, status, unitId)
      .subscribe();
  }

  /**
   * Clears the tracking progress of a unit (season/volume) within a tracked
   * item. When no other units of the material remain tracked, the library
   * entry itself is removed by the backend.
   *
   * @param materialId  The source material ID.
   * @param unitId      The unit ID whose progress should be cleared.
   */
  clearGroupProgress(materialId: string, unitId: string): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .clearUnitProgress(userId, materialId, unitId)
      .subscribe();
  }

  /**
    * Updates unit progress for a tracked item.
    *
    * @param materialId  The source material ID.
    * @param unitId      The unit ID to update.
    * @param isCompleted  Whether the unit is completed.
    */
  setUnitProgress(materialId: string, unitId: string, isCompleted: boolean): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setUnitProgress(userId, materialId, unitId, isCompleted)
      .subscribe();
  }

  // ─── Reorder methods ────────────────────────────────────────────────────

  /**
   * Moves a tracked item up or down within its status group.
   *
   * @param itemId    The item to move.
   * @param direction `-1` to move up, `1` to move down.
   */
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

  /**
   * Starts dragging a tracked item.
   *
   * @param itemId  The ID of the item being dragged.
   */
  onDragStart(itemId: string): void {
    this.draggedId.set(itemId);
  }

  /** Clears the drag state when dragging ends. */
  onDragEnd(): void {
    this.draggedId.set(null);
  }

  /**
   * Prevents default drag-over behavior to allow dropping.
   *
   * @param event  The drag event.
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  /**
   * Reorders a tracked item to the position of the target item.
   *
   * @param targetId  The ID of the item to drop onto.
   */
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

  // ─── Internal helpers ───────────────────────────────────────────────────

  /**
   * Applies a new ordering of tracked items by sending the reordered
   * IDs to the server.
   *
   * @param orderedSourceMaterialIds  The ordered list of source material IDs.
   */
  private applyOrder(orderedSourceMaterialIds: readonly string[]): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .reorderTrackedItem(userId, orderedSourceMaterialIds)
      .subscribe();
  }
}
