import { Component, input, output } from '@angular/core';

/**
 * Presentational tracking-status dropdown shared by the source material
 * catalog.
 *
 * Renders the "Track…" placeholder, one option per available status, and an
 * optional "Remove From Library" entry (value `remove`) supplied by the
 * parent through {@link options}.
 *
 * Purely presentational: all state is passed in via inputs and user
 * selections are emitted via {@link statusChange}.
 */
@Component({
  selector: 'app-track-select',
  templateUrl: './track-select.html',
  styleUrl: './track-select.scss',
})
export class TrackSelect {
  /** Available status values to render (may include `'remove'`). */
  readonly options = input<readonly string[]>([]);

  /** Currently tracked status, or null when untracked (placeholder shown). */
  readonly currentStatus = input<string | null>(null);

  /** Accessible label describing what is being tracked. */
  readonly label = input.required<string>();

  /**
   * Visual variant: `material` tracks a whole source material,
   * `group` tracks a season/volume container unit.
   */
  readonly variant = input<'material' | 'group'>('material');

  /** Emits the newly selected value (`'remove'` clears tracking). */
  readonly statusChange = output<string>();

  /** Handles native change events and re-emits the selected value. */
  onSelect(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value);
  }
}
