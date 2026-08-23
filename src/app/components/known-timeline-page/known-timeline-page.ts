/**
 * @fileoverview Known Timeline page component.
 *
 * Displays a filtered subset of the galactic timeline showing only events
 * from source materials the user has tracked in their library. The user
 * can select which tracking statuses (All, Completed, In Progress, Wish
 * Listed) to include via the shared {@link StatusFilter} multi-select tabs.
 *
 * Wraps the shared {@link Timeline} component with a `sourceIds` input
 * to restrict the visible events.
 *
 * @see {@link Timeline} for the underlying timeline rendering component.
 * @see {@link TrackedEventsPage} for managing tracked items.
 * @see {@link StatusFilter} for the shared filter control.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { LibraryItem } from '../../models/library-item';
import { TrackingStatus } from '../../models/tracking-status';
import { AuthService } from '../../services/auth/auth.service';
import { LibraryService } from '../../services/library/library.service';
import { LoggerService } from '../../services/logging/logger.service';
import { StatusFilter } from '../status-filter/status-filter';
import { Timeline } from '../timeline/timeline';
import { LoginPrompt } from '../login-prompt/login-prompt';

@Component({
  selector: 'app-known-timeline-page',
  imports: [StatusFilter, Timeline, LoginPrompt],
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

  // ─── Status filter ──────────────────────────────────────────────────────

  /**
   * Selected tracking statuses from the {@link StatusFilter} tabs.
   * Empty means "All" statuses are included.
   */
  readonly statusSelection = signal<readonly TrackingStatus[]>([]);

  // ─── Computed state ─────────────────────────────────────────────────────

  /**
   * IDs of tracked items whose status matches the active selection.
   *
   * Passed to the {@link Timeline} component's `sourceIds` input to
   * restrict which events are displayed.
   */
  readonly consumedIds = computed(() => {
    const selected = this.statusSelection();
    const ids = new Set<string>();
    for (const item of this.tracked()) {
      if (selected.length === 0 || selected.includes(item.status)) {
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
}
