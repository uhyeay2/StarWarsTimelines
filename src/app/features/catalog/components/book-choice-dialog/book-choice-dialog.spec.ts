import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookChoiceDialog } from './book-choice-dialog';

describe('BookChoiceDialog', () => {
  function create(): ComponentFixture<BookChoiceDialog> {
    return TestBed.createComponent(BookChoiceDialog);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookChoiceDialog],
    }).compileComponents();
  });

  it('offers the standalone and collection choices plus cancel', async () => {
    const fixture = create();
    const chapters: unknown[] = [];
    const books: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.chooseChapter.subscribe((value) => chapters.push(value));
    fixture.componentInstance.chooseBook.subscribe((value) => books.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-popup-actions button'),
    ) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Add chapter',
      'Start collection',
      'Cancel',
    ]);

    buttons[0]!.click();
    await fixture.whenStable();
    expect(chapters.length).toBe(1);

    buttons[1]!.click();
    await fixture.whenStable();
    expect(books.length).toBe(1);

    buttons[2]!.click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);
  });

  it('cancels when the backdrop is clicked', async () => {
    const fixture = create();
    const cancelled: unknown[] = [];
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLDivElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);
  });
});
