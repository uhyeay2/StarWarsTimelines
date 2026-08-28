import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { CharacterEditForm } from './character-edit-form';

describe('CharacterEditForm', () => {
  const speciesOptions = [
    { id: 1, name: 'Human' },
    { id: 2, name: "Twi'lek" },
  ];
  const planetOptions = [{ id: 7, name: 'Tatooine' }];

  function create(): ComponentFixture<CharacterEditForm> {
    const fixture = TestBed.createComponent(CharacterEditForm);
    fixture.componentRef.setInput('name', 'Luke Skywalker');
    fixture.componentRef.setInput('speciesId', 1);
    fixture.componentRef.setInput('bornOnPlanetId', 7);
    fixture.componentRef.setInput('speciesOptions', speciesOptions);
    fixture.componentRef.setInput('planetOptions', planetOptions);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterEditForm, FormsModule],
    }).compileComponents();
  });

  it('renders the editable fields with bound values and selection options', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect((el.querySelector('[name="editName"]') as HTMLInputElement).value).toBe(
      'Luke Skywalker',
    );

    const speciesSelect = el.querySelector('[name="editSpeciesId"]') as HTMLSelectElement;
    expect(speciesSelect.options.length).toBe(3);
    expect(speciesSelect.selectedIndex).toBe(1);

    const planetSelect = el.querySelector('[name="editBornOnPlanetId"]') as HTMLSelectElement;
    expect(planetSelect.options.length).toBe(2);
    expect(planetSelect.selectedIndex).toBe(1);
  });

  it('writes edits back to the model signals', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    const name = fixture.nativeElement.querySelector('[name="editName"]') as HTMLInputElement;
    name.value = 'Leia Organa';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.name()).toBe('Leia Organa');
  });

  it('emits save on submit and cancel on the cancel button', async () => {
    const fixture = create();
    const saved: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.character-edit') as HTMLFormElement).dispatchEvent(
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
