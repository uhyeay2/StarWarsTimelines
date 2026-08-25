import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NameAddDialog } from './name-add-dialog';

describe('NameAddDialog', () => {
  let fixture: ComponentFixture<NameAddDialog>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NameAddDialog, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(NameAddDialog);
    fixture.componentRef.setInput('heading', 'Add Vehicle');
    fixture.autoDetectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  function nameInput(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('input[name="newName"]')!;
  }

  function saveButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.admin-popup-actions .btn-primary')!;
  }

  it('renders the heading and binds the name field', async () => {
    fixture.componentInstance.name.set('X-Wing');
    await fixture.whenStable();

    expect(element.querySelector('h3')?.textContent).toContain('Add Vehicle');
    expect(nameInput().value).toBe('X-Wing');
    expect(saveButton().disabled).toBe(false);
  });

  it('emits save with the entered name on submit', async () => {
    const saved: number[] = [];
    fixture.componentInstance.save.subscribe(() => saved.push(1));

    nameInput().value = 'Speeder';
    nameInput().dispatchEvent(new Event('input'));
    nameInput().form!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(fixture.componentInstance.name()).toBe('Speeder');
    expect(saved).toHaveLength(1);
  });

  it('emits cancel from the backdrop and the Cancel button', async () => {
    const cancelled: number[] = [];
    fixture.componentInstance.cancel.subscribe(() => cancelled.push(1));

    (element.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    (element.querySelector('.admin-popup-actions .btn:not(.btn-primary)') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(cancelled).toHaveLength(2);
  });
});
