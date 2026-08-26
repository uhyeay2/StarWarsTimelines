import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Inline edit form for a source material row (admin catalog view).
 *
 * Two-way binds the editable fields (title, medium, canon type) to the
 * host's signals via model inputs and emits `save` / `cancel` intents.
 * Purely presentational: the host owns persistence and busy state.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-source-material-edit-form',
  imports: [FormsModule],
  templateUrl: './source-material-edit-form.html',
  styleUrl: './source-material-edit-form.scss',
})
export class SourceMaterialEditForm {
  /** Source material title. */
  readonly title = model('');

  /** Selected medium label. */
  readonly medium = model('');

  /** Selected canon type label. */
  readonly canonType = model('');

  /** Selectable medium labels. */
  readonly media = input<readonly string[]>([]);

  /** Selectable canon type labels. */
  readonly canonTypes = input<readonly string[]>([]);

  /** Whether the save request is in flight. */
  readonly saving = input(false);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user cancels editing. */
  readonly cancel = output<void>();
}
