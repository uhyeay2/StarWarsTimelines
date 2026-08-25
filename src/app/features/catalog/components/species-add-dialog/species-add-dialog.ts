import { ChangeDetectionStrategy, Component, HostListener, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogSelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { SearchableSelect } from '../../../../shared/components/searchable-select/searchable-select';

export type { CatalogSelectOption };

/**
 * Modal dialog for creating a species (admin catalog view). The user fills
 * in the name and an optional home planet.
 *
 * Two-way binds the form fields to the host's signals and emits `save` /
 * `cancel` intents. Purely presentational: the host owns persistence.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-species-add-dialog',
  imports: [FormsModule, SearchableSelect],
  templateUrl: './species-add-dialog.html',
  styleUrl: './species-add-dialog.scss',
})
export class SpeciesAddDialog {
  /** Location options sorted by name, offered as home planets. */
  readonly locationOptions = input<readonly CatalogSelectOption[]>([]);

  /** The species name entered by the user. */
  readonly name = model('');

  /** Selected home planet id, or `0` when none. */
  readonly homePlanetId = model(0);

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
