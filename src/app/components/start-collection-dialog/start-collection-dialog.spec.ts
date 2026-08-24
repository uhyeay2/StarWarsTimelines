import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { StartCollectionDialog, StartCollectionPayload } from './start-collection-dialog';

describe('StartCollectionDialog', () => {
  function create(collectionName = ''): ComponentFixture<StartCollectionDialog> {
    const fixture = TestBed.createComponent(StartCollectionDialog);
    fixture.componentRef.setInput('collectionName', collectionName);
    return fixture;
  }

  function bookInputs(el: HTMLElement): HTMLInputElement[] {
    return Array.from(el.querySelectorAll('.book-row input'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartCollectionDialog, FormsModule],
    }).compileComponents();
  });

  it('renders the collection name prefill and a single numbered book row', async () => {
    const fixture = create('Empty novel');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Start collection');
    expect((el.querySelector('[name="collectionName"]') as HTMLInputElement).value).toBe(
      'Empty novel',
    );
    expect(bookInputs(el).length).toBe(1);
    expect(el.querySelector('.book-number')?.textContent?.trim()).toBe('1.');
  });

  it('adds another book row on demand', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const add = fixture.nativeElement.querySelector('.add-another') as HTMLButtonElement;
    add.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.books()).toEqual(['', '']);
    const el = fixture.nativeElement as HTMLElement;
    const numbers = Array.from(el.querySelectorAll('.book-number')).map((n) =>
      n.textContent?.trim(),
    );
    // Numbers are assigned automatically by list position.
    expect(numbers).toEqual(['1.', '2.']);
  });

  it('reorders books with the move buttons and disables them at the edges', async () => {
    const fixture = create();
    fixture.componentInstance.books.set(['Thrawn', 'Dark Force Rising']);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('.book-row');
    expect((rows[0].querySelector('.book-move[aria-label="Move book up"]') as HTMLButtonElement).disabled).toBe(true);
    expect(
      (rows[0].querySelector('.book-move[aria-label="Move book down"]') as HTMLButtonElement).disabled,
    ).toBe(false);

    (rows[0].querySelector('.book-move[aria-label="Move book down"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.books()).toEqual(['Dark Force Rising', 'Thrawn']);
  });

  it('removes rows beyond the first and hides removal for a single book', async () => {
    const fixture = create();
    fixture.componentInstance.books.set(['One', 'Two', 'Three']);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.book-remove').length).toBe(3);
    (el.querySelectorAll('.book-remove')[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.books()).toEqual(['One', 'Three']);

    fixture.componentInstance.removeBook(0);
    fixture.componentInstance.removeBook(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.books()).toEqual([]);
    expect(el.querySelectorAll('.book-remove').length).toBe(0);
  });

  it('emits the entered collection name and book titles in order on save', async () => {
    const fixture = create('Heir to the Empire');
    const saved: StartCollectionPayload[] = [];
    fixture.componentInstance.save.subscribe((payload) => saved.push(payload));
    fixture.componentInstance.collectionName.set('Thrawn Trilogy');
    fixture.componentInstance.books.set(['Thrawn', 'Dark Force Rising']);
    fixture.detectChanges();
    await fixture.whenStable();

    (
      fixture.nativeElement.querySelector('form') as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(saved.length).toBe(1);
    expect(saved[0]).toEqual({
      collectionName: 'Thrawn Trilogy',
      bookTitles: ['Thrawn', 'Dark Force Rising'],
    });
  });

  it('emits cancel via the cancel button or backdrop and disables saving while in flight', async () => {
    const fixture = create();
    let cancelled = 0;
    fixture.componentInstance.cancel.subscribe(() => cancelled++);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const submit = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Creating…');
    expect((el.querySelector('.add-another') as HTMLButtonElement).disabled).toBe(true);

    (el.querySelector('.admin-popup-actions button[type="button"]') as HTMLButtonElement).click();
    expect(cancelled).toBe(1);

    (el.querySelector('.admin-popup-backdrop') as HTMLDivElement).click();
    expect(cancelled).toBe(2);
  });
});
