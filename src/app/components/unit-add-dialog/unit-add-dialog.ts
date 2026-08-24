import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Modal dialog for adding a unit to a source material (admin catalog view).
 * The unit type and target container are inferred by the host; the user only
 * fills in the number and optional title.
 *
 * Two-way binds the form fields to the host's signals and emits `save` /
 * `cancel` intents. Purely presentational: the host owns persistence.
 */
@Component({
  selector: 'app-unit-add-dialog',
  imports: [FormsModule],
  templateUrl: './unit-add-dialog.html',
  styleUrl: './unit-add-dialog.scss',
})
export class UnitAddDialog {
  /** Dialog heading naming the inferred unit type and target. */
  readonly heading = input.required<string>();

  /** The unit number within its parent scope. */
  readonly number = model<number | null>(null);

  /** Optional unit title. */
  readonly title = model('');

  /** Whether the create request is in flight. */
  readonly saving = input(false);

  /** Validation or server error to show inside the dialog. */
  readonly error = input<string | null>(null);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();
}
