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

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import { buildTrackedScope } from '../../../../shared/models/tracking-selection';
import { AuthService } from '../../../auth/services/auth.service';
import { LibraryService } from '../../../library/services/library.service';
import { StatusFilter } from '../../../library/components/status-filter/status-filter';
import { Timeline } from '../../components/timeline/timeline';
import { LoginPrompt } from '../../../../shared/components/login-prompt/login-prompt';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    effect(() => {
      const userId = this.userId();
      if (!userId) {
        this.libraryService.clearCache();
        return;
      }
      this.libraryService.ensureTracked(userId);
    });
  }
}
