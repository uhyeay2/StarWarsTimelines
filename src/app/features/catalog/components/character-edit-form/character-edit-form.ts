import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Option shape required for the species / birth-planet selects. */
export interface CharacterEditOption {
  readonly id: number;
  readonly name: string;
}

/** Sentinel value representing "no species / planet selected". */
const NO_SELECTION = 0;

/**
 * Inline edit form for a character row (admin catalog view).
 *
 * Two-way binds the editable character fields to the host's signals via
 * model inputs and emits `save` / `cancel` intents. Purely presentational:
 * the host owns persistence and busy state.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-character-edit-form',
  imports: [FormsModule],
  templateUrl: './character-edit-form.html',
  styleUrl: './character-edit-form.scss',
})
export class CharacterEditForm {
  /** Character display name. */
  readonly name = model('');

  /** Selected species id, or {@link NO_SELECTION} for unknown. */
  readonly speciesId = model(NO_SELECTION);

  /** Selected birth planet id, or {@link NO_SELECTION} for unknown. */
  readonly bornOnPlanetId = model(NO_SELECTION);

  /** Earliest birth year (BBY is negative). */
  readonly birthFrom = model<number | null>(null);

  /** Latest birth year. */
  readonly birthTo = model<number | null>(null);

  /** Earliest death year (ABY is positive). */
  readonly deathFrom = model<number | null>(null);

  /** Latest death year. */
  readonly deathTo = model<number | null>(null);

  /** Species options for the species select. */
  readonly speciesOptions = input<readonly CharacterEditOption[]>([]);

  /** Planet options for the birth planet select. */
  readonly planetOptions = input<readonly CharacterEditOption[]>([]);

  /** Whether the save request is in flight. */
  readonly saving = input(false);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user cancels editing. */
  readonly cancel = output<void>();

  /** Sentinel bound to the "Unknown" options. */
  protected readonly noSelection = NO_SELECTION;
}
