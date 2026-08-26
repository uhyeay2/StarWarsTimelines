import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CANON_TYPES, CanonType } from '../../../../shared/models/canon-type';

/**
 * Modal dialog for creating a source material of a fixed medium (admin
 * catalog view). The medium is chosen by the button that opens the dialog;
 * the user only fills in the title and canon type.
 *
 * Two-way binds the form fields to the host's signals and emits `save` /
 * `cancel` intents. Purely presentational: the host owns persistence.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-material-add-dialog',
  imports: [FormsModule, CdkTrapFocus],
  templateUrl: './material-add-dialog.html',
  styleUrl: './material-add-dialog.scss',
})
export class MaterialAddDialog {
  /** Medium the new material will be created with. */
  readonly medium = input.required<string>();

  /** Canon types offered in the dropdown. */
  readonly canonTypes = CANON_TYPES;

  /** The material title entered by the user. */
  readonly title = model('');

  /** Label for the title field; overridden when the title's meaning is ambiguous. */
  readonly titleLabel = input('Title');

  /** The selected canon type. */
  readonly canonType = model<CanonType>('Canon');

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
