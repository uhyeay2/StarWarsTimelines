import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterGroup } from './filter-group';

describe('FilterGroup', () => {
  let component: FilterGroup;
  let fixture: ComponentFixture<FilterGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterGroup],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterGroup);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Characters');
    fixture.componentRef.setInput('options', [
      { value: 'Padme Amidala', label: 'Padme Amidala' },
      { value: 'Darth Maul', label: 'Darth Maul' },
      { value: 'Anakin Skywalker', label: 'Anakin Skywalker' },
    ]);
    fixture.componentRef.setInput('selected', []);
    await fixture.whenStable();
  });

  const openDropdown = (): void => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
  };

  const optionLabels = (): string[] =>
    [...fixture.nativeElement.querySelectorAll('.filter-option-label')].map(
      (el) => (el as HTMLElement).textContent ?? '',
    );

  const optionElements = (): HTMLElement[] => [
    ...fixture.nativeElement.querySelectorAll('.filter-option'),
  ];

  const optionInputs = (): HTMLInputElement[] => [
    ...fixture.nativeElement.querySelectorAll('.filter-option input[type="checkbox"]'),
  ];

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the panel when the trigger is clicked', () => {
    fixture.detectChanges();
    expect(component.open()).toBe(false);
    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.open()).toBe(true);
    expect(optionLabels()).toEqual(['Padme Amidala', 'Darth Maul', 'Anakin Skywalker']);
  });

  it('toggles an option into and out of the selection', () => {
    openDropdown();
    optionInputs()[1].click();
    expect(component.selected()).toEqual(['Darth Maul']);
    fixture.detectChanges();
    optionInputs()[1].click();
    expect(component.selected()).toEqual([]);
  });

  it('marks selected options', () => {
    fixture.componentRef.setInput('selected', ['Padme Amidala']);
    openDropdown();
    expect(optionElements()[0].classList.contains('filter-option--selected')).toBe(true);
    expect(optionElements()[1].classList.contains('filter-option--selected')).toBe(false);
  });

  it('shows the selected count on the trigger', () => {
    fixture.componentRef.setInput('selected', ['Padme Amidala', 'Darth Maul']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-group-count')?.textContent?.trim()).toBe(
      '2',
    );
  });

  it('filters options by search query', () => {
    openDropdown();
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Padme';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['Padme Amidala']);
  });

  it('shows a clear button on the trigger only when there are selections', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-group-clear-trigger')).toBeNull();

    fixture.componentRef.setInput('selected', ['Padme Amidala']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-group-clear-trigger')).toBeTruthy();
  });

  it('clears the selection from the trigger button', () => {
    fixture.componentRef.setInput('selected', ['Padme Amidala']);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-group-clear-trigger') as HTMLElement).click();
    expect(component.selected()).toEqual([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filter-group-clear-trigger')).toBeNull();
  });

  it('closes the panel when clicking outside', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.open()).toBe(true);
    document.body.click();
    expect(component.open()).toBe(false);
  });

  it('displays option labels while selecting option values', () => {
    fixture.componentRef.setInput('options', [
      { value: 'material-tcw:7', label: 'The Clone Wars — Season 7' },
    ]);
    openDropdown();
    expect(optionLabels()).toEqual(['The Clone Wars — Season 7']);
    optionInputs()[0].click();
    expect(component.selected()).toEqual(['material-tcw:7']);
  });
});
