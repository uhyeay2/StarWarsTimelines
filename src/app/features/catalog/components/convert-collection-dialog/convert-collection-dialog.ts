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

/**
 * Modal dialog for converting a standalone book into a book collection
 * (admin catalog view). The collection title renames the source material;
 * the original book stays as its first book with all progress carried over.
 *
 * Two-way binds the title to the host's signal and emits `convert` / `cancel`
 * intents. Purely presentational: the host owns persistence.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-convert-collection-dialog',
  imports: [FormsModule, CdkTrapFocus],
  templateUrl: './convert-collection-dialog.html',
  styleUrl: './convert-collection-dialog.scss',
})
export class ConvertCollectionDialog {
  /** The collection title entered by the user. */
  readonly title = model('');

  /** Whether the conversion request is in flight. */
  readonly saving = input(false);

  /** Validation or server error to show inside the dialog. */
  readonly error = input<string | null>(null);

  /** Emits when the user submits the form. */
  readonly convert = output<void>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancel.emit();
  }
}
