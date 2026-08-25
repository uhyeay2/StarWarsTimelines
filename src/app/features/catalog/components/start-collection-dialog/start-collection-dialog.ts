import { ChangeDetectionStrategy, Component, HostListener, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Payload emitted when the user saves the new collection. */
export interface StartCollectionPayload {
  /** New title for the source material (the collection's name). */
  collectionName: string;
  /** Book titles in display order; positions become their numbers. */
  bookTitles: string[];
}

/**
 * Modal dialog for turning an empty book source material into a collection
 * (admin catalog view). The user names the collection and lists its books in
 * order; book numbers are assigned automatically from the list position.
 *
 * Two-way binds the collection name to the host (so it can be prefilled with
 * the material title) and owns the reorderable book list internally. Emits
 * `save` with the payload / `cancel` intents. Purely presentational: the host
 * owns persistence.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-start-collection-dialog',
  imports: [FormsModule],
  templateUrl: './start-collection-dialog.html',
  styleUrl: './start-collection-dialog.scss',
})
export class StartCollectionDialog {
  /** The collection name entered by the user; prefilled by the host. */
  readonly collectionName = model('');

  /** Whether the create request is in flight. */
  readonly saving = input(false);

  /** Validation or server error to show inside the dialog. */
  readonly error = input<string | null>(null);

  /** Emits when the user submits the form. */
  readonly save = output<StartCollectionPayload>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancel.emit();
  }

  /** Book titles in order; starts with one empty entry. */
  readonly books = signal<string[]>(['']);

  addBook(): void {
    this.books.update((books) => [...books, '']);
  }

  removeBook(index: number): void {
    this.books.update((books) => books.filter((_, i) => i !== index));
  }

  /** Moves a book one position up (-1) or down (+1) in the list. */
  moveBook(index: number, direction: -1 | 1): void {
    this.books.update((books) => {
      const target = index + direction;
      if (target < 0 || target >= books.length) {
        return books;
      }
      const next = [...books];
      [next[index]!, next[target]!] = [next[target]!, next[index]!];
      return next;
    });
  }

  setBook(index: number, title: string): void {
    this.books.update((books) => books.map((book, i) => (i === index ? title : book)));
  }

  submit(): void {
    this.save.emit({
      collectionName: this.collectionName(),
      bookTitles: this.books(),
    });
  }
}
