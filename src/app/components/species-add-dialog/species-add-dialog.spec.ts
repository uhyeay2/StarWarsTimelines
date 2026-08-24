import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SpeciesAddDialog, CatalogSelectOption } from './species-add-dialog';

describe('SpeciesAddDialog', () => {
  const LOCATIONS: CatalogSelectOption[] = [
    { id: 11, name: 'Kashyyyk' },
    { id: 12, name: 'Corellia' },
  ];

  let fixture: ComponentFixture<SpeciesAddDialog>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeciesAddDialog, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeciesAddDialog);
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

  function openOptions(): string[] {
    (element.querySelector('.ss-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    return Array.from(element.querySelectorAll('.ss-option')).map(
      (o) => o.textContent?.trim() ?? '',
    );
  }

  it('renders the name and home planet fields with the provided options', async () => {
    expect(element.querySelector('h3')?.textContent).toContain('Add species');

    expect(openOptions()).toEqual(['No home planet', 'Kashyyyk', 'Corellia']);
    expect(saveButton().disabled).toBe(false);
  });

  it('two-way binds the name and home planet fields', async () => {
    fixture.componentInstance.name.set('Twi\u2019lek');
    fixture.componentInstance.homePlanetId.set(11);
    await fixture.whenStable();

    expect(field('newName').value).toBe('Twi\u2019lek');
    const toggleLabel = element.querySelector('.ss-value')?.textContent?.trim();
    expect(toggleLabel).toBe('Kashyyyk');
  });

  it('emits save on submit and cancel from the backdrop and button', async () => {
    const saved: number[] = [];
    const cancelled: number[] = [];
    fixture.componentInstance.save.subscribe(() => saved.push(1));
    fixture.componentInstance.cancel.subscribe(() => cancelled.push(1));

    field('newName').value = 'Rodian';
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
    fixture.componentRef.setInput('error', 'A species with this name already exists.');
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();

    expect(element.textContent).toContain('A species with this name already exists.');
    expect(saveButton().disabled).toBe(true);
    expect(saveButton().textContent).toContain('Adding…');
  });
});
