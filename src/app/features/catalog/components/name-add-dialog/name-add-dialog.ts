import { ChangeDetectionStrategy, Component, HostListener, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Modal dialog for creating a simple named catalog entry (locations,
 * vehicles). The user only fills in a name.
 *
 * Two-way binds the name field to the host's signal and emits `save` /
 * `cancel` intents. Purely presentational: the host owns persistence.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-name-add-dialog',
  imports: [FormsModule],
  templateUrl: './name-add-dialog.html',
  styleUrl: './name-add-dialog.scss',
})
export class NameAddDialog {
  /** Heading shown in the dialog, e.g. "Add Vehicle". */
  readonly heading = input.required<string>();

  /** The name entered by the user. */
  readonly name = model('');

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
