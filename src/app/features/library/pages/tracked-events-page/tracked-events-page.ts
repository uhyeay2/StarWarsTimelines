/**
 * @fileoverview Tracked Events page component.
 *
 * Displays the user's library of tracked source materials grouped by
 * medium (similar to the catalog's source material view), with status
 * filters powered by the shared {@link StatusFilter} control, per-item
 * status selects, favorites, and unit progress tracking.
 *
 * Wish list reordering moved to {@link WishListPage}; this page is
 * strictly for viewing and updating tracked items.
 *
 * @see {@link TrackedItemRow} for the individual row component.
 * @see {@link StatusFilter} for the shared filter control.
 * @see {@link LibraryService} for the backend API integration.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LibraryItem } from '../../../../shared/models/library-item';
import { MEDIA, Medium } from '../../../../shared/models/medium';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import { AuthService } from '../../../auth/services/auth.service';
import { LibraryService } from '../../services/library.service';
import { StatusFilter } from '../../../../shared/components/status-filter/status-filter';
import { TrackedItemRow } from '../../components/tracked-item-row/tracked-item-row';
import { LoginPrompt } from '../../../../shared/components/login-prompt/login-prompt';

/** A group of tracked items sharing the same medium. */
interface MediumGroup {
  /** The medium shared by every item in the group. */
  medium: Medium;
  /** The tracked items in the group, in saved order. */
  items: readonly LibraryItem[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tracked-events-page',
  imports: [StatusFilter, TrackedItemRow, LoginPrompt],
  templateUrl: './tracked-events-page.html',
  styleUrl: './tracked-events-page.scss',
})
export class TrackedEventsPage {
  // ─── Injected services ──────────────────────────────────────────────────

  /** Authentication service for the current user. */
  private readonly auth = inject(AuthService);

  /** Library service for managing tracked items. */
  private readonly libraryService = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

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

  // ─── Filter state ───────────────────────────────────────────────────────

  /**
   * Selected tracking statuses from the {@link StatusFilter} tabs.
   * Empty means "All" statuses are shown.
   */
  readonly statusSelection = signal<readonly TrackingStatus[]>([]);

  // ─── Medium grouping state ──────────────────────────────────────────────

  /** Currently expanded media; every medium starts expanded. */
  private readonly expandedMedia = signal(new Set<Medium>([...MEDIA]));

  // ─── Computed state ─────────────────────────────────────────────────────

  /** Tracked items matching the active status selection (All when empty). */
  readonly filteredItems = computed(() => {
    const selected = this.statusSelection();
    if (selected.length === 0) {
      return this.tracked();
    }
    return this.tracked().filter((item) => item.status !== null && selected.includes(item.status));
  });

  /** Whether specific statuses are selected (as opposed to "All"). */
  readonly isFiltering = computed(() => this.statusSelection().length > 0);

  /**
   * Visible items grouped by medium, following the canonical
   * {@link MEDIA} order. Empty media are omitted.
   */
  readonly mediumGroups = computed<readonly MediumGroup[]>(() =>
    MEDIA.map((medium) => ({
      medium,
      items: this.filteredItems().filter((item) => item.medium === medium),
    })).filter((group) => group.items.length > 0),
  );

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

  // ─── Medium grouping methods ────────────────────────────────────────────

  /**
   * Tests whether a medium group is currently expanded.
   *
   * @param medium  The medium to test.
   * @returns `true` when the group's rows are visible.
   */
  isMediumExpanded(medium: Medium): boolean {
    return this.expandedMedia().has(medium);
  }

  /**
   * Toggles a medium group between expanded and collapsed.
   *
   * @param medium  The medium to toggle.
   */
  toggleMedium(medium: Medium): void {
    this.expandedMedia.update((current) => {
      const next = new Set(current);
      if (next.has(medium)) {
        next.delete(medium);
      } else {
        next.add(medium);
      }
      return next;
    });
  }

  // ─── Status / tracking methods ──────────────────────────────────────────

  /**
   * Updates the tracking status of a tracked item.
   *
   * @param itemId  The source material ID.
   * @param status  The new tracking status.
   */
  setStatus(itemId: number, status: TrackingStatus): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setStatus(userId, itemId, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /**
   * Removes a tracked item from the library.
   *
   * @param itemId  The source material ID to remove.
   */
  removeTracked(itemId: number): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .removeTracked(userId, itemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /**
   * Sets the status of a unit (season/volume) within a tracked item.
   *
   * @param materialId  The source material ID.
   * @param unitId      The unit ID to update.
   * @param status      The new tracking status.
   */
  setGroupStatus(materialId: number, unitId: number, status: TrackingStatus): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setStatus(userId, materialId, status, unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /**
   * Clears the tracking progress of a unit (season/volume) within a
   * tracked item. When no other units of the material remain tracked,
   * the library entry itself is removed by the backend.
   *
   * @param materialId  The source material ID.
   * @param unitId      The unit ID whose progress should be cleared.
   */
  clearGroupProgress(materialId: number, unitId: number): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .clearUnitProgress(userId, materialId, unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /**
   * Updates unit progress for a tracked item.
   *
   * @param materialId  The source material ID.
   * @param unitId      The unit ID to update.
   * @param status      The new tracking status for the unit.
   */
  setUnitProgress(materialId: number, unitId: number, status: TrackingStatus): void {
    const userId = this.userId();
    if (!userId) {
      return;
    }
    this.libraryService
      .setUnitProgress(userId, materialId, unitId, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
