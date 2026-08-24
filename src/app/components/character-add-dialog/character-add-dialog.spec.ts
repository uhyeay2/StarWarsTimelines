import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { CharacterAddDialog, CatalogSelectOption } from './character-add-dialog';

describe('CharacterAddDialog', () => {
  const SPECIES: CatalogSelectOption[] = [
    { id: 3, name: 'Human' },
    { id: 4, name: 'Wookiee' },
  ];
  const LOCATIONS: CatalogSelectOption[] = [{ id: 11, name: 'Tatooine' }];

  let fixture: ComponentFixture<CharacterAddDialog>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterAddDialog, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterAddDialog);
    fixture.componentRef.setInput('speciesOptions', SPECIES);
    fixture.componentRef.setInput('locationOptions', LOCATIONS);
    fixture.autoDetectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  function field(name: string): HTMLInputElement {
    return element.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  }

  function saveButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.admin-popup-actions .btn-primary')!;
  }

  /** Returns the option labels of the n-th searchable select's open panel. */
  function openOptions(index: number): string[] {
    const toggles = element.querySelectorAll<HTMLButtonElement>('.ss-toggle');
    toggles[index].click();
    fixture.detectChanges();
    return Array.from(element.querySelectorAll('.ss-option')).map(
      (o) => o.textContent?.trim() ?? '',
    );
  }

  it('renders the biography fields with the provided options', async () => {
    expect(element.querySelector('h3')?.textContent).toContain('Add character');

    expect(openOptions(0)).toEqual(['Unknown', 'Human', 'Wookiee']);

    // Close species panel, then check the birth planet select.
    element.querySelectorAll<HTMLButtonElement>('.ss-toggle')[0].click();
    fixture.detectChanges();
    expect(openOptions(1)).toEqual(['Unknown', 'Tatooine']);

    expect(field('newBirthFrom')).toBeTruthy();
    expect(field('newDeathTo')).toBeTruthy();
  });

  it('two-way binds every field to its model', async () => {
    fixture.componentInstance.name.set('Grogu');
    fixture.componentInstance.speciesId.set(4);
    fixture.componentInstance.planetBornOnId.set(11);
    fixture.componentInstance.birthFrom.set(-41);
    fixture.componentInstance.deathTo.set(15);
    await fixture.whenStable();

    expect((field('newName') as HTMLInputElement).value).toBe('Grogu');
    const toggleLabels = Array.from(element.querySelectorAll('.ss-value')).map(
      (s) => s.textContent?.trim(),
    );
    expect(toggleLabels).toEqual(['Wookiee', 'Tatooine']);
    expect(Number(field('newBirthFrom').value)).toBe(-41);
    expect(Number(field('newDeathTo').value)).toBe(15);
  });

  it('emits save on submit and cancel from the backdrop and button', async () => {
    const saved: number[] = [];
    const cancelled: number[] = [];
    fixture.componentInstance.save.subscribe(() => saved.push(1));
    fixture.componentInstance.cancel.subscribe(() => cancelled.push(1));

    field('newName').value = 'Luke Skywalker';
    field('newName').dispatchEvent(new Event('input'));
    field('newName').form!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(saved).toHaveLength(1);

    (element.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    (element.querySelector('.admin-popup-actions .btn:not(.btn-primary)') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(cancelled).toHaveLength(2);
  });

  it('shows the error inside the dialog while saving disables the submit button', async () => {
    fixture.componentRef.setInput('error', 'A character with this name already exists.');
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();

    expect(element.textContent).toContain('A character with this name already exists.');
    expect(saveButton().disabled).toBe(true);
    expect(saveButton().textContent).toContain('Adding…');
  });
});
