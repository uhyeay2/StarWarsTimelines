import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UNIT_TYPES, UnitType } from '../../models/unit-type';

/**
 * Inline edit form for a source material unit (admin catalog view).
 *
 * Two-way binds the editable unit fields to the host's signals via model
 * inputs and emits `save` / `cancel` intents. Purely presentational: the
 * host owns persistence and busy state.
 */
@Component({
  selector: 'app-unit-edit-form',
  imports: [FormsModule],
  templateUrl: './unit-edit-form.html',
  styleUrl: './unit-edit-form.scss',
})
export class UnitEditForm {
  /** Available unit types for the type dropdown. */
  readonly unitTypes = UNIT_TYPES;

  /** Unit type being edited. */
  readonly unitType = model<UnitType>('Episode');

  /** Group (season/volume) number, or null when ungrouped. */
  readonly groupNumber = model<number | null>(null);

  /** Unit number within its group. */
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
