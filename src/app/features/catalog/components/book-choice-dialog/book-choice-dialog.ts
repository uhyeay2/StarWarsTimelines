import { ChangeDetectionStrategy, Component, HostListener, output } from '@angular/core';

/**
 * Choice dialog shown when the admin adds a unit to a Book material that has
 * no units yet: the book can stay standalone (chapters) or become a
 * collection (first book). Purely presentational.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-book-choice-dialog',
  imports: [],
  templateUrl: './book-choice-dialog.html',
  styleUrl: './book-choice-dialog.scss',
})
export class BookChoiceDialog {
  /** Emits when the user chooses to keep the book standalone. */
  readonly chooseChapter = output<void>();

  /** Emits when the user chooses to start a collection. */
  readonly chooseBook = output<void>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancel.emit();
  }
}
