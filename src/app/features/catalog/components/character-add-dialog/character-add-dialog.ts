import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogSelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { SearchableSelect } from '../../../../shared/components/searchable-select/searchable-select';

export type { CatalogSelectOption };

/**
 * Modal dialog for creating a character (admin catalog view). The user
 * fills in the name and optional biography details; year pairs use the
 * galactic timeline (negative = BBY, positive = ABY).
 *
 * Two-way binds the form fields to the host's signals and emits `save` /
 * `cancel` intents. Purely presentational: the host owns persistence and
 * validation.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-character-add-dialog',
  imports: [FormsModule, SearchableSelect],
  templateUrl: './character-add-dialog.html',
  styleUrl: './character-add-dialog.scss',
})
export class CharacterAddDialog {
  /** Species options sorted by name. */
  readonly speciesOptions = input<readonly CatalogSelectOption[]>([]);

  /** Location options sorted by name. */
  readonly locationOptions = input<readonly CatalogSelectOption[]>([]);

  /** The character name entered by the user. */
  readonly name = model('');

  /** Selected species id, or `0` when unknown. */
  readonly speciesId = model(0);

  /** Birth planet id, or `0` when unknown. */
  readonly planetBornOnId = model(0);

  /** Earliest birth year (negative = BBY), or null when unknown. */
  readonly birthFrom = model<number | null>(null);

  /** Latest birth year (positive = ABY), or null when unknown. */
  readonly birthTo = model<number | null>(null);

  /** Earliest death year, or null when unknown. */
  readonly deathFrom = model<number | null>(null);

  /** Latest death year, or null when unknown. */
  readonly deathTo = model<number | null>(null);

  /** Whether the create request is in flight. */
  readonly saving = input(false);

  /** Validation or server error to show inside the dialog. */
  readonly error = input<string | null>(null);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancel.emit();
  }
}
