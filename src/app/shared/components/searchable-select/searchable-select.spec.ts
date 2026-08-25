import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { CatalogSelectOption, SearchableSelect } from './searchable-select';

describe('SearchableSelect', () => {
  const OPTIONS: CatalogSelectOption[] = [
    { id: 11, name: 'Tatooine' },
    { id: 12, name: 'Coruscant' },
    { id: 13, name: 'Naboo' },
  ];

  let fixture: ComponentFixture<SearchableSelect>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchableSelect, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchableSelect);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('noneLabel', 'Unknown');
    fixture.componentRef.setInput('ariaLabel', 'Birth planet');
    fixture.autoDetectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  function toggle(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.ss-toggle')!;
  }

  function searchBox(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('.ss-search')!;
  }

  /** Opens the panel and returns the rendered option labels. */
  function openPanel(): string[] {
    toggle().click();
    fixture.detectChanges();
    return Array.from(element.querySelectorAll('.ss-option')).map(
      (o) => o.textContent?.trim() ?? '',
    );
  }

  it('shows the none label when nothing is selected', () => {
    expect(toggle().textContent).toContain('Unknown');
    expect(element.querySelector('.ss-panel')).toBeNull();
  });

  it('lists the none entry plus all options when opened', () => {
    expect(openPanel()).toEqual(['Unknown', 'Tatooine', 'Coruscant', 'Naboo']);
    expect(searchBox()).toBeTruthy();
  });

  it('filters options as the user types', () => {
    openPanel();

    searchBox().value = 'co';
    searchBox().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const labels = Array.from(element.querySelectorAll('.ss-option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(labels).toEqual(['Coruscant']);
  });

  it('selects an option on click and closes the panel', async () => {
    const entries = openPanel();
    const naboo = Array.from(element.querySelectorAll('.ss-option')).find(
      (o) => o.textContent?.trim() === 'Naboo',
    ) as HTMLElement;
    naboo.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(13);
    expect(element.querySelector('.ss-panel')).toBeNull();
    expect(toggle().textContent).toContain('Naboo');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('selects via keyboard: arrows move the active row and Enter picks it', async () => {
    openPanel();
    const box = searchBox();

    // Opening highlights the current selection ("Unknown", id 0).
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(0);
    expect(element.querySelector('.ss-panel')).toBeNull();

    // Re-open, arrow down to "Tatooine" and pick it.
    toggle().click();
    fixture.detectChanges();
    const reopenedBox = searchBox();
    reopenedBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    const active = element.querySelector('.ss-option--active')?.textContent?.trim();
    expect(active).toBe('Tatooine');

    reopenedBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(11);
    expect(toggle().textContent).toContain('Tatooine');
  });

  it('closes on Escape without changing the value', () => {
    openPanel();
    searchBox().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(0);
    expect(element.querySelector('.ss-panel')).toBeNull();
  });

  it('shows "No matches" when the query hits nothing', () => {
    openPanel();

    searchBox().value = 'zzz';
    searchBox().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element.textContent).toContain('No matches');
  });

  it('reflects a preselected model value on the toggle', async () => {
    fixture.componentInstance.value.set(12);
    await fixture.whenStable();

    expect(toggle().textContent).toContain('Coruscant');
  });
});
