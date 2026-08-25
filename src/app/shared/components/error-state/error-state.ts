import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Reusable error panel for failed data loads.
 *
 * Renders a title, an optional detail message, and a retry button that
 * emits {@link retry} so the host decides how to reload.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-error-state',
  templateUrl: './error-state.html',
  styleUrl: './error-state.scss',
})
export class ErrorState {
  /** Short heading describing the failure. */
  readonly title = input('Something went wrong');

  /** Optional detail message (e.g. the server-provided error text). */
  readonly message = input<string | null>(null);

  /** Label for the retry action. */
  readonly retryLabel = input('Try again');

  /** Emits when the user requests a retry. */
  readonly retry = output<void>();
}
