import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SourceOptionContext } from '../../models/catalog/event-source-options';
import { TimelineEventAddDialog } from './timeline-event-add-dialog';

const CONTEXT: SourceOptionContext = {
  materials: [{ id: 100, title: 'A New Hope', medium: 'Movie', canonType: 'Canon' }],
  unitsByMaterial: {},
};

const COMIC_CONTEXT: SourceOptionContext = {
  materials: [{ id: 200, title: 'Dawn of the Jedi', medium: 'Comic', canonType: 'Canon' }],
  unitsByMaterial: {
    200: [
      {
        id: 53,
        sourceMaterialId: 200,
        unitType: 'Volume',
        number: 2,
        title: 'Force War',
        parentUnitId: null,
      },
      {
        id: 71,
        sourceMaterialId: 200,
        unitType: 'Issue',
        number: 1,
        title: 'The Prisoner of Bogan, Part 1',
        parentUnitId: 53,
      },
      {
        id: 72,
        sourceMaterialId: 200,
        unitType: 'Issue',
        number: 2,
        title: 'The Prisoner of Bogan, Part 2',
        parentUnitId: 53,
      },
    ],
  },
};

describe('TimelineEventAddDialog', () => {
  let fixture: ComponentFixture<TimelineEventAddDialog>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineEventAddDialog, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineEventAddDialog);
    fixture.componentRef.setInput('sourceContext', CONTEXT);
    fixture.componentRef.setInput('characterOptions', [{ id: 7, name: 'Darth Maul' }]);
    fixture.componentRef.setInput('locationOptions', [{ id: 12, name: 'Naboo' }]);
    fixture.componentRef.setInput('vehicleOptions', []);
    fixture.autoDetectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  function field(name: string): HTMLInputElement {
    return element.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  }

  function saveButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.admin-popup-actions .btn-primary')!;
  }

  /** Opens the n-th filter group and returns its rendered option labels. */
  function openOptions(index: number): string[] {
    const groups = element.querySelectorAll('.filter-group');
    groups[index].querySelector<HTMLButtonElement>('.filter-group-trigger')!.click();
    fixture.detectChanges();
    const panel = groups[index].querySelector('.filter-group-panel')!;
    expect(panel.hasAttribute('hidden')).toBe(false);
    return Array.from(panel.querySelectorAll('.filter-option-label')).map(
      (o) => o.textContent?.trim() ?? '',
    );
  }

  it('renders the heading, form fields, and entity dropdowns', async () => {
    expect(element.querySelector('h3')?.textContent).toContain('Add event');

    const triggers = Array.from(element.querySelectorAll('.filter-group-label')).map((l) =>
      l.textContent?.trim(),
    );
    expect(triggers).toEqual(['Sources', 'Characters', 'Locations', 'Vehicles']);

    expect(field('eventTitle')).toBeTruthy();
    expect(field('yearStart')).toBeTruthy();
    expect(field('sequence')).toBeTruthy();

    expect(openOptions(1)).toEqual(['Darth Maul']);
    element
      .querySelectorAll('.filter-group')[1]
      .querySelector<HTMLButtonElement>('.filter-group-trigger')!
      .click();
    fixture.detectChanges();
    expect(openOptions(2)).toEqual(['Naboo']);
  });

  it('builds a nested source tree and shows resolved link chips', async () => {
    const labels = openOptions(0);
    expect(labels).toContain('Movie');
    expect(labels).toContain('A New Hope');

    fixture.componentInstance.sourceSelection.set([String(CONTEXT.materials[0].id)]);
    await fixture.whenStable();

    const chips = element.querySelectorAll('.link-chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('A New Hope');
  });

  it('offers no whole-material entries when units are loaded', async () => {
    fixture.componentRef.setInput('sourceContext', COMIC_CONTEXT);
    await fixture.whenStable();

    const panelText = openOptions(0).join('\n');
    expect(panelText).toContain('Volume 2: Force War');
    expect(panelText).not.toContain('Whole');
  });

  it('removes a resolved link chip and unchecks its leaves', async () => {
    fixture.componentInstance.sourceSelection.set([String(CONTEXT.materials[0].id)]);
    await fixture.whenStable();
    expect(element.querySelectorAll('.link-chip').length).toBe(1);

    (element.querySelector('.link-chip .link-chip-remove') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.sourceSelection()).toEqual([]);
    expect(element.querySelectorAll('.link-chip').length).toBe(0);
  });

  it('labels pinned chips with the full container path', async () => {
    fixture.componentRef.setInput('sourceContext', COMIC_CONTEXT);
    await fixture.whenStable();

    fixture.componentInstance.sourceSelection.set(['200:53:71']);
    await fixture.whenStable();

    const chipText = element.querySelector('.link-chip')!.textContent ?? '';
    expect(chipText).toContain('Dawn of the Jedi');
    expect(chipText).toContain('Volume 2: Force War');
    expect(chipText).toContain('Issue 1: The Prisoner of Bogan, Part 1');
    expect(chipText).not.toContain('Unit #');
  });

  it('omits the unit suffix while a pinned unit is not in the catalog cache', async () => {
    fixture.componentInstance.sourceSelection.set(['100:u999']);
    await fixture.whenStable();

    const chip = element.querySelector('.link-chip')!;
    expect(chip.textContent).toContain('A New Hope');
    expect(chip.textContent).not.toContain('#999');
  });

  it('shows removable chips for selected entities', async () => {
    fixture.componentInstance.characterSelection.set(['7']);
    fixture.componentInstance.locationSelection.set(['12', '999']);
    await fixture.whenStable();

    const names = Array.from(element.querySelectorAll('.link-chip')).map((chip) =>
      chip.textContent?.trim(),
    );
    expect(names.some((n) => n?.includes('Darth Maul'))).toBe(true);
    expect(names.some((n) => n?.includes('Naboo'))).toBe(true);
    // Unknown ids fall back to a raw marker.
    expect(names.some((n) => n?.includes('#999'))).toBe(true);

    const nabooRemove = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.link-chip-remove'),
    ).find((button) => button.getAttribute('aria-label') === 'Remove Naboo')!;
    nabooRemove.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.locationSelection()).toEqual(['999']);
    expect(fixture.componentInstance.characterSelection()).toEqual(['7']);
  });

  it('keeps the dialog open on backdrop click while a dropdown panel is open', async () => {
    const cancelled: number[] = [];
    fixture.componentInstance.cancel.subscribe(() => cancelled.push(1));

    openOptions(0);
    (element.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    await fixture.whenStable();

    expect(cancelled).toHaveLength(0);
  });

  it('two-way binds every field to its model', async () => {
    fixture.componentInstance.title.set('The Invasion of Naboo');
    fixture.componentInstance.yearStart.set(-32);
    fixture.componentInstance.sequence.set(3);
    await fixture.whenStable();

    expect(field('eventTitle').value).toBe('The Invasion of Naboo');
    expect(Number(field('yearStart').value)).toBe(-32);
    expect(Number(field('sequence').value)).toBe(3);
  });

  it('emits save on submit and cancel from the backdrop and button', async () => {
    const saved: number[] = [];
    const cancelled: number[] = [];
    fixture.componentInstance.save.subscribe(() => saved.push(1));
    fixture.componentInstance.cancel.subscribe(() => cancelled.push(1));

    field('eventTitle').value = 'Duel on Mustafar';
    field('eventTitle').dispatchEvent(new Event('input'));
    field('eventTitle').form!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(saved).toHaveLength(1);

    (element.querySelector('.admin-popup-backdrop') as HTMLElement).click();
    (
      element.querySelector('.admin-popup-actions .btn:not(.btn-primary)') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(cancelled).toHaveLength(2);
  });

  it('supports edit mode via heading and submit label inputs', async () => {
    fixture.componentRef.setInput('heading', 'Edit event');
    fixture.componentRef.setInput('submitLabel', 'Save');
    await fixture.whenStable();

    expect(element.querySelector('h3')?.textContent).toContain('Edit event');
    expect(saveButton().textContent).toContain('Save');
  });

  it('shows the error inside the dialog while saving disables the submit button', async () => {
    fixture.componentRef.setInput('error', 'Link at least one source material.');
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();

    expect(element.textContent).toContain('Link at least one source material.');
    expect(saveButton().disabled).toBe(true);
    expect(saveButton().textContent).toContain('Saving…');
  });
});
