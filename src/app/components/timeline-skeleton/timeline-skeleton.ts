import { Component, computed, input } from '@angular/core';

/**
 * Loading placeholder for the timeline page.
 *
 * Renders a shimmering list of skeleton cards that mirrors the layout of
 * {@link TimelineEventItem} cards so the page does not shift when data
 * arrives.
 */
@Component({
  selector: 'app-timeline-skeleton',
  templateUrl: './timeline-skeleton.html',
  styleUrl: './timeline-skeleton.scss',
})
export class TimelineSkeleton {
  /** Number of skeleton rows to render. */
  readonly rows = input(5);

  /** Index sequence driving the row loop. */
  protected readonly rowIndexes = computed(() =>
    Array.from({ length: this.rows() }, (_, index) => index),
  );
}
