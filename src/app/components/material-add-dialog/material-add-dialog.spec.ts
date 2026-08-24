import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MaterialAddDialog } from './material-add-dialog';

describe('MaterialAddDialog', () => {
  function create(): ComponentFixture<MaterialAddDialog> {
    const fixture = TestBed.createComponent(MaterialAddDialog);
    fixture.componentRef.setInput('medium', 'Live Action Show');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialAddDialog, FormsModule],
    }).compileComponents();
  });

  it('renders the fixed medium in its heading and fields', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Add Live Action Show');
    expect((el.querySelector('[name="materialCanonType"]') as HTMLSelectElement).value).toBe(
      'Canon',
    );
  });

  it('labels the title field "Title" by default', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.source-field span')?.textContent?.trim()).toBe('Title');
  });

  it('supports a custom title field label for ambiguous media', async () => {
    const fixture = create();
    fixture.componentRef.setInput('medium', 'Book');
    fixture.componentRef.setInput('titleLabel', 'Book Title or Collection Name');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.source-field span')?.textContent?.trim()).toBe(
      'Book Title or Collection Name',
    );
  });

  it('writes edits back to the model signals', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('[name="materialTitle"]') as HTMLInputElement;
    title.value = 'Ahsoka';
    title.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.title()).toBe('Ahsoka');
  });

  it('emits save on submit and cancel via the cancel button or backdrop', async () => {
    const fixture = create();
    const saved: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    expect(saved.length).toBe(1);

    (
      fixture.nativeElement.querySelector('.admin-popup-actions button[type="button"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLDivElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(2);
  });

  it('disables saving and shows the server error while a save is in flight', () => {
    const fixture = create();
    fixture.componentRef.setInput('saving', true);
    fixture.componentRef.setInput('error', 'A source material with this title already exists.');
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Adding…');

    const error = fixture.nativeElement.querySelector('.form-error') as HTMLParagraphElement;
    expect(error.textContent?.trim()).toBe('A source material with this title already exists.');
  });
});
