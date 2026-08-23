/**
 * @fileoverview Known Timeline page component.
 *
 * Displays a filtered subset of the galactic timeline showing only events
 * the user actually knows from their tracked library content. Filtering is
 * two-level: a material must be tracked at all (coarse `sourceIds`), and a
 * unit-pinned event must additionally fall inside that material's tracked
 * scope (`trackedUnitScope`) — tracking Season 1 of a show hides events
 * pinned to other seasons, and tracking one book of a collection hides
 * events tied to its untracked sequels. The user can select which tracking
 * statuses (All, Completed, In Progress, Wish Listed) to include via the
 * shared {@link StatusFilter} multi-select tabs.
 *
 * Wraps the shared {@link Timeline} component with the `sourceIds` and
 * `trackedUnitScope` inputs to restrict the visible events.
 *
 * @see {@link Timeline} for the underlying timeline rendering component.
 * @see {@link TrackedEventsPage} for managing tracked items.
 * @see {@link StatusFilter} for the shared filter control.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { LibraryItem } from '../../models/library-item';
import { TrackingStatus } from '../../models/tracking-status';
import { buildTrackedScope } from '../../models/tracking-selection';
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
   * Unit-level tracked scope per tracked material, honoring the active
   * status selection (see {@link buildTrackedScope}).
   *
   * Passed to the {@link Timeline} component's `trackedUnitScope` input so a
   * unit-pinned event only shows when its pinned unit is actually part of
   * the user's tracked content: tracking Season 1 of a show hides events
   * pinned to other seasons, and tracking book one of a collection hides
   * events tied to its untracked sequels.
   */
  readonly trackedUnitScope = computed(() =>
    buildTrackedScope(this.tracked(), this.statusSelection()),
  );

  /**
   * IDs of tracked items within the active status selection.
   *
   * Passed to the {@link Timeline} component's `sourceIds` input as the
   * coarse material-level restriction; {@link trackedUnitScope} refines it
   * down to individual units.
   */
  readonly consumedIds = computed(() => [...this.trackedUnitScope().keys()]);

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
