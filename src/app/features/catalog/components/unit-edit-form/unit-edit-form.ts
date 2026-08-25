import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Inline edit form for a source material unit (admin catalog view).
 *
 * Two-way binds the editable unit fields (number and title) to the host's
 * signals via model inputs and emits `save` / `cancel` intents. The unit
 * type and parent placement are inferred by the host and are not editable
 * here. Purely presentational: the host owns persistence and busy state.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-unit-edit-form',
  imports: [FormsModule],
  templateUrl: './unit-edit-form.html',
  styleUrl: './unit-edit-form.scss',
})
export class UnitEditForm {
  /** Unit number within its parent scope. */
  readonly number = model<number | null>(null);

  /** Optional unit title. */
  readonly title = model('');

  /** Whether the save request is in flight. */
  readonly saving = input(false);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user cancels editing. */
  readonly cancel = output<void>();
}
