/**
 * @fileoverview Reusable multi-select tracking status filter.
 *
 * Renders an "All" tab followed by one tab per {@link TrackingStatus}.
 * Multiple statuses may be selected at once; selecting "All" clears the
 * explicit selection, and deselecting every status returns the filter to
 * "All". An empty selection therefore means "All".
 *
 * The selection is exposed as a two-way bindable model so pages such as
 * {@link KnownTimelinePage} and {@link TrackedEventsPage} can react to
 * changes with computed signals.
 */

import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TRACKING_STATUSES, TrackingStatus } from '../../../../shared/models/tracking-status';

/** Filter options: "All" followed by every tracking status. */
export const STATUS_FILTER_OPTIONS = ['All', ...TRACKING_STATUSES] as const;

/** Union type for a single status filter option value. */
export type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-status-filter',
  templateUrl: './status-filter.html',
  styleUrl: './status-filter.scss',
})
export class StatusFilter {
  // ─── Component inputs / models ──────────────────────────────────────────

  /**
   * Currently selected statuses. Empty means "All" is active.
   *
   * Two-way bindable via `[(selection)]`.
   */
  readonly selection = model<readonly TrackingStatus[]>([]);

  /** Accessible group label announced by screen readers. */
  readonly label = input('Filter by tracking status');

  // ─── Computed state ─────────────────────────────────────────────────────

  /** Available filter tab options. */
  protected readonly options = STATUS_FILTER_OPTIONS;

  /** Whether the "All" option is currently active. */
  readonly allSelected = computed(() => this.selection().length === 0);

  // ─── Public methods ─────────────────────────────────────────────────────

  /**
   * Tests whether a filter option is currently active.
   *
   * @param option  The option to test ("All" or a tracking status).
   * @returns `true` when the option should render as selected.
   */
  isSelected(option: StatusFilterOption): boolean {
    if (option === 'All') {
      return this.allSelected();
    }
    return this.selection().includes(option);
  }

  /**
   * Applies a click on a filter option.
   *
   * Clicking "All" clears the selection; clicking a status toggles it.
   * When the last status is deselected the filter falls back to "All"
   * automatically (an empty selection).
   *
   * @param option  The option that was clicked.
   */
  toggle(option: StatusFilterOption): void {
    if (option === 'All') {
      this.selection.set([]);
      return;
    }
    const current = this.selection();
    this.selection.set(
      current.includes(option)
        ? current.filter((status) => status !== option)
        : [...current, option],
    );
  }
}
