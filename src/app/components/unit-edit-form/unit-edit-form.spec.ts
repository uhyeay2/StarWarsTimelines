import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { UnitEditForm } from './unit-edit-form';

describe('UnitEditForm', () => {
  function create(): ComponentFixture<UnitEditForm> {
    const fixture = TestBed.createComponent(UnitEditForm);
    fixture.componentRef.setInput('unitType', 'Episode');
    fixture.componentRef.setInput('number', 4);
    fixture.componentRef.setInput('title', 'A New Hope');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitEditForm, FormsModule],
    }).compileComponents();
  });

  it('renders the editable fields with bound values', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect((el.querySelector('[name="unitEditType"]') as HTMLSelectElement).value).toBe('Episode');
    const parentSelect = el.querySelector('[name="unitEditParent"]') as HTMLSelectElement;
    expect(parentSelect.selectedOptions[0]?.textContent?.trim()).toBe('Top level');
    expect((el.querySelector('[name="unitEditNumber"]') as HTMLInputElement).value).toBe('4');
    expect((el.querySelector('[name="unitEditTitle"]') as HTMLInputElement).value).toBe(
      'A New Hope',
    );
  });

  it('writes edits back to the model signals', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('[name="unitEditTitle"]') as HTMLInputElement;
    title.value = 'Revised title';
    title.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.title()).toBe('Revised title');
  });

  it('emits save on submit and cancel on the cancel button', async () => {
    const fixture = create();
    const saved: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.unit-edit') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    expect(saved.length).toBe(1);

    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);
  });

  it('disables saving while a save is in flight', () => {
    const fixture = create();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Saving…');
  });
});
