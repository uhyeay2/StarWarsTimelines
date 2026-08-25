import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { UnitAddDialog } from './unit-add-dialog';

describe('UnitAddDialog', () => {
  function create(): ComponentFixture<UnitAddDialog> {
    const fixture = TestBed.createComponent(UnitAddDialog);
    fixture.componentRef.setInput('heading', 'Add episode to Season 1');
    fixture.componentRef.setInput('number', 3);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitAddDialog, FormsModule],
    }).compileComponents();
  });

  it('renders the heading and prefilled number', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Add episode to Season 1');
    expect((el.querySelector('[name="unitNumber"]') as HTMLInputElement).value).toBe('3');
  });

  it('writes edits back to the model signals', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('[name="unitTitle"]') as HTMLInputElement;
    title.value = 'Cat and Mouse';
    title.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.title()).toBe('Cat and Mouse');
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
      fixture.nativeElement.querySelector(
        '.admin-popup-actions button[type="button"]',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);

    (fixture.nativeElement.querySelector('.admin-popup-backdrop') as HTMLDivElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(2);
  });

  it('disables saving and shows the error while a save is in flight', () => {
    const fixture = create();
    fixture.componentRef.setInput('saving', true);
    fixture.componentRef.setInput('error', 'A unit number of at least one is required.');
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Adding…');

    const error = fixture.nativeElement.querySelector('.form-error') as HTMLParagraphElement;
    expect(error.textContent?.trim()).toBe('A unit number of at least one is required.');
  });
});
