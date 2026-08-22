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
    fixture.detectChanges();
    expect(component.open()).toBe(false);
  });

  it('keeps the panel open when clicking inside it', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.open()).toBe(true);
    (fixture.nativeElement.querySelector('.filter-group-panel input') as HTMLElement).click();
    expect(component.open()).toBe(true);
  });

  it('closes the panel when toggled again', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
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

  const nestedOptions = [
    {
      value: 'material-tcw',
      label: 'The Clone Wars',
      children: [
        { value: 'material-tcw:2', label: 'Season 2' },
        { value: 'material-tcw:7', label: 'Season 7' },
      ],
    },
  ];

  it('renders a parent with its children', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    fixture.componentRef.setInput('defaultExpandedDepth', 0);
    openDropdown();
    expect(optionLabels()).toEqual(['The Clone Wars', 'Season 2', 'Season 7']);
  });

  it('selects every descendant leaf when the parent is checked', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    openDropdown();
    optionInputs()[0].click();
    expect(component.selected()).toEqual(['material-tcw:2', 'material-tcw:7']);
  });

  it('deselects every descendant leaf when the checked parent is toggled again', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    fixture.componentRef.setInput('selected', ['material-tcw:2', 'material-tcw:7']);
    openDropdown();
    optionInputs()[0].click();
    expect(component.selected()).toEqual([]);
  });

  it('toggles a child without affecting the other children', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    fixture.componentRef.setInput('defaultExpandedDepth', 0);
    openDropdown();
    optionInputs()[1].click();
    expect(component.selected()).toEqual(['material-tcw:2']);
    optionInputs()[1].click();
    expect(component.selected()).toEqual([]);
  });

  it('marks the parent indeterminate when only some children are selected', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    fixture.componentRef.setInput('selected', ['material-tcw:7']);
    openDropdown();
    const parent = optionInputs()[0];
    expect(parent.checked).toBe(false);
    expect(parent.indeterminate).toBe(true);
  });

  it('marks the parent checked when all children are selected', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    fixture.componentRef.setInput('selected', ['material-tcw:2', 'material-tcw:7']);
    openDropdown();
    const parent = optionInputs()[0];
    expect(parent.checked).toBe(true);
    expect(parent.indeterminate).toBe(false);
  });

  it('collapses and expands the children of a parent', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    fixture.componentRef.setInput('defaultExpandedDepth', 0);
    openDropdown();
    const expand = fixture.nativeElement.querySelector('.filter-option-expand') as HTMLElement;
    expand.click();
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['The Clone Wars']);
    expand.click();
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['The Clone Wars', 'Season 2', 'Season 7']);
  });

  it('keeps parents with matching children when searching', () => {
    fixture.componentRef.setInput('options', nestedOptions);
    openDropdown();
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Season 7';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['The Clone Wars', 'Season 7']);
  });

  const deepOptions = [
    {
      value: 'medium:Animated Show',
      label: 'Animated Show',
      children: [
        {
          value: 'material-tcw',
          label: 'The Clone Wars',
          children: [
            { value: 'material-tcw:2', label: 'Season 2' },
            { value: 'material-tcw:7', label: 'Season 7' },
          ],
        },
      ],
    },
  ];

  it('shows only the first level by default', () => {
    fixture.componentRef.setInput('options', deepOptions);
    openDropdown();
    expect(optionLabels()).toEqual(['Animated Show']);
  });

  it('expands a collapsed layer to reveal the next level of options', () => {
    fixture.componentRef.setInput('options', deepOptions);
    openDropdown();
    const expanders = [
      ...fixture.nativeElement.querySelectorAll('.filter-option-expand'),
    ] as HTMLElement[];
    expect(expanders.length).toBe(1);
    expanders[0].click();
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['Animated Show', 'The Clone Wars']);

    const seasonExpanders = [
      ...fixture.nativeElement.querySelectorAll('.filter-option-expand'),
    ] as HTMLElement[];
    expect(seasonExpanders.length).toBe(2);
    seasonExpanders[1].click();
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['Animated Show', 'The Clone Wars', 'Season 2', 'Season 7']);
  });

  it('retains tree expansion when the panel is closed and reopened', () => {
    fixture.componentRef.setInput('options', deepOptions);
    openDropdown();
    const expanders = [
      ...fixture.nativeElement.querySelectorAll('.filter-option-expand'),
    ] as HTMLElement[];
    expanders[0].click();
    fixture.detectChanges();
    expect(optionLabels()).toEqual(['Animated Show', 'The Clone Wars']);

    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.filter-group-panel') as HTMLElement;
    expect(panel.hasAttribute('hidden')).toBe(true);

    (fixture.nativeElement.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(optionLabels()).toEqual(['Animated Show', 'The Clone Wars']);
  });

  it('selects every leaf when a medium node is toggled', () => {
    fixture.componentRef.setInput('options', deepOptions);
    openDropdown();
    optionInputs()[0].click();
    expect(component.selected()).toEqual(['material-tcw:2', 'material-tcw:7']);
  });

  it('marks a medium node indeterminate when only some of its leaves are selected', () => {
    fixture.componentRef.setInput('options', deepOptions);
    fixture.componentRef.setInput('selected', ['material-tcw:7']);
    openDropdown();
    const medium = optionInputs()[0];
    expect(medium.checked).toBe(false);
    expect(medium.indeterminate).toBe(true);
  });

  it('deselects every leaf when a fully selected medium node is toggled again', () => {
    fixture.componentRef.setInput('options', deepOptions);
    fixture.componentRef.setInput('selected', ['material-tcw:2', 'material-tcw:7']);
    openDropdown();
    optionInputs()[0].click();
    expect(component.selected()).toEqual([]);
  });
});
