import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UNIT_TYPES, UnitType } from '../../models/unit-type';

/**
 * A candidate container unit (season/volume/book/collection) offered in the
 * parent-unit dropdown of the unit edit form.
 */
export interface ParentUnitOption {
  id: number;
  label: string;
}

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

  /** Candidate container units this unit can nest inside. */
  readonly parentOptions = input<readonly ParentUnitOption[]>([]);

  /** The selected container unit's ID, or null when top level. */
  readonly parentUnitId = model<number | null>(null);

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
