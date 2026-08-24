import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ConvertCollectionDialog } from './convert-collection-dialog';

describe('ConvertCollectionDialog', () => {
  function create(): ComponentFixture<ConvertCollectionDialog> {
    const fixture = TestBed.createComponent(ConvertCollectionDialog);
    fixture.componentRef.setInput('title', 'Standalone novel');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConvertCollectionDialog, FormsModule],
    }).compileComponents();
  });

  it('prefills the collection title with the current material title', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Convert to Collection');
    expect((el.querySelector('[name="collectionTitle"]') as HTMLInputElement).value).toBe(
      'Standalone novel',
    );
    expect(el.textContent).toContain('Standalone novel');
  });

  it('writes edits back to the model signal', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector(
      '[name="collectionTitle"]',
    ) as HTMLInputElement;
    title.value = 'Thrawn Trilogy';
    title.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.title()).toBe('Thrawn Trilogy');
  });

  it('emits convert on submit and cancel via the cancel button or backdrop', async () => {
    const fixture = create();
    const converted: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.convert.subscribe((value) => converted.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    expect(converted.length).toBe(1);

    (
      fixture.nativeElement.querySelector('.admin-popup-actions button[type="button"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLDivElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(2);
  });

  it('disables converting and shows the error while a conversion is in flight', () => {
    const fixture = create();
    fixture.componentRef.setInput('saving', true);
    fixture.componentRef.setInput('error', 'A collection title is required.');
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Converting…');

    const error = fixture.nativeElement.querySelector('.form-error') as HTMLParagraphElement;
    expect(error.textContent?.trim()).toBe('A collection title is required.');
  });
});
