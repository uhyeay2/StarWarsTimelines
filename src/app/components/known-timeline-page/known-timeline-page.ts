/**
 * @fileoverview Known Timeline page component.
 *
 * Displays a filtered subset of the galactic timeline showing only events
 * from source materials the user has tracked in their library. The user
 * can toggle which tracking statuses (Completed, In Progress, Wish Listed)
 * to include via pill-style toggle buttons.
 *
 * Wraps the shared {@link Timeline} component with a `sourceIds` input
 * to restrict the visible events.
 *
 * @see {@link Timeline} for the underlying timeline rendering component.
 * @see {@link TrackedEventsPage} for managing tracked items.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryItem } from '../../models/library-item';
import { AuthService } from '../../services/auth/auth.service';
import { LibraryService } from '../../services/library/library.service';
import { LoggerService } from '../../services/logging/logger.service';
import { Timeline } from '../timeline/timeline';

@Component({
  selector: 'app-known-timeline-page',
  imports: [Timeline, RouterLink],
  templateUrl: './known-timeline-page.html',
  styleUrl: './known-timeline-page.scss',
})
export class KnownTimelinePage {
  // ─── Injected services ──────────────────────────────────────────────────

  /** Authentication service for the current user. */
  private readonly auth = inject(AuthService);

  /** Library service for fetching tracked items. */
  private readonly libraryService = inject(LibraryService);

  /** Logger for analytics and diagnostics. */
  private readonly logger = inject(LoggerService);

  // ─── User state ─────────────────────────────────────────────────────────

  /** The currently authenticated user, or `null`. */
  readonly user = this.auth.currentUser;

  /** The current user's ID, or `null`. */
  readonly userId = computed(() => this.user()?.id ?? null);

  /** The user's tracked library items. */
  readonly tracked = signal<readonly LibraryItem[]>([]);

  // ─── Status filter toggles ──────────────────────────────────────────────

  /** Whether "Completed" items are included in the known timeline. */
  readonly includeCompleted = signal(true);

  /** Whether "In Progress" items are included in the known timeline. */
  readonly includeInProgress = signal(false);

  /** Whether "Wish Listed" items are included in the known timeline. */
  readonly includeWishListed = signal(false);

  // ─── Computed state ─────────────────────────────────────────────────────

  /**
   * IDs of tracked items whose status matches an active toggle.
   *
   * Passed to the {@link Timeline} component's `sourceIds` input to
   * restrict which events are displayed.
   */
  readonly consumedIds = computed(() => {
    const ids = new Set<string>();
    for (const item of this.tracked()) {
      const included =
        (item.status === 'Completed' && this.includeCompleted()) ||
        (item.status === 'In progress' && this.includeInProgress()) ||
        (item.status === 'Wish Listed' && this.includeWishListed());
      if (included) {
        ids.add(item.id);
      }
    }
    return [...ids];
  });

  // ─── Constructor ────────────────────────────────────────────────────────

  constructor() {
    // Subscribe to tracked library items for the current user.
    // Uses the effect's onCleanup callback for automatic cleanup.
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

  // ─── Public methods ─────────────────────────────────────────────────────

  /**
   * Toggles a status filter on or off.
   *
   * @param key  The status toggle to flip.
   */
  toggleStatus(key: 'completed' | 'inProgress' | 'wishListed'): void {
    this.logger.debug('[KnownTimelinePage] Status toggle', { key });
    if (key === 'completed') {
      this.includeCompleted.update((value) => !value);
    } else if (key === 'inProgress') {
      this.includeInProgress.update((value) => !value);
    } else {
      this.includeWishListed.update((value) => !value);
    }
  }
}
