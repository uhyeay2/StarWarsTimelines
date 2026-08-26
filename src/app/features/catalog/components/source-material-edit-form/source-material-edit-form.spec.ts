import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SourceMaterialEditForm } from './source-material-edit-form';

describe('SourceMaterialEditForm', () => {
  function create(): ComponentFixture<SourceMaterialEditForm> {
    const fixture = TestBed.createComponent(SourceMaterialEditForm);
    fixture.componentRef.setInput('title', 'Thrawn');
    fixture.componentRef.setInput('medium', 'Book');
    fixture.componentRef.setInput('canonType', 'Canon');
    fixture.componentRef.setInput('media', ['Book', 'Movie']);
    fixture.componentRef.setInput('canonTypes', ['Canon', 'Legends']);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceMaterialEditForm, FormsModule],
    }).compileComponents();
  });

  it('renders the editable fields with bound values and options', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect((el.querySelector('[name="editTitle"]') as HTMLInputElement).value).toBe('Thrawn');

    const mediumSelect = el.querySelector('[name="editMedium"]') as HTMLSelectElement;
    expect(mediumSelect.options.length).toBe(2);

    const canonSelect = el.querySelector('[name="editCanonType"]') as HTMLSelectElement;
    expect(canonSelect.options.length).toBe(2);
  });

  it('writes edits back to the model signals', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('[name="editTitle"]') as HTMLInputElement;
    title.value = 'Thrawn Ascendancy';
    title.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.title()).toBe('Thrawn Ascendancy');
  });

  it('emits save on submit and cancel on the cancel button', async () => {
    const fixture = create();
    const saved: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.source-edit') as HTMLFormElement).dispatchEvent(
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
