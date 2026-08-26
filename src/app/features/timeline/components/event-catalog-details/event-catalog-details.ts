import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One formatted source line inside the details grid. */
export interface EventCatalogSourceLine {
  readonly medium: string;
  readonly label: string;
}

/** One non-empty entity (characters / locations / vehicles) row. */
export interface EventCatalogEntityLine {
  readonly label: string;
  readonly text: string;
}

/** Precomputed details model for a single timeline event row. */
export interface EventCatalogDetailsModel {
  /** Event description, or empty string when absent. */
  readonly description: string;
  /** Formatted source material lines. */
  readonly sources: readonly EventCatalogSourceLine[];
  /** Non-empty entity summary lines. */
  readonly entities: readonly EventCatalogEntityLine[];
}

/**
 * Expandable details grid for a timeline event catalog row.
 *
 * Purely presentational: the host precomputes every displayed string so
 * this template stays free of formatting logic.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-event-catalog-details',
  imports: [],
  templateUrl: './event-catalog-details.html',
  styleUrl: './event-catalog-details.scss',
})
export class EventCatalogDetails {
  /** Precomputed details model for the expanded event. */
  readonly model = input.required<EventCatalogDetailsModel>();
}
