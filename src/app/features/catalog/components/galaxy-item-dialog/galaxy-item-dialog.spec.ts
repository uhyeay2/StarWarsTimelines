import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GalaxyKind } from '../../models/galaxy-catalog-models';
import { ApiRegion, ApiSubregion } from '../../../../shared/models/api-galaxy';
import { PLANET_LOCATION_TYPES } from '../../../../shared/models/planet-location-type';
import { GalaxyItemDialog } from './galaxy-item-dialog';

describe('GalaxyItemDialog', () => {
  const regionOptions: readonly ApiRegion[] = [
    { id: 1, name: 'Outer Rim', description: null, subregions: [] },
    { id: 2, name: 'Mid Rim', description: null, subregions: [] },
  ];

  const subregionOptions: readonly ApiSubregion[] = [
    {
      id: 11,
      name: 'Ryloth Sector',
      sectorType: 'Sector',
      description: null,
      regions: [],
      planetSystems: [],
    },
  ];

  function create(kind: GalaxyKind): ComponentFixture<GalaxyItemDialog> {
    const fixture = TestBed.createComponent(GalaxyItemDialog);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('adding', true);
    fixture.componentRef.setInput('kindLabel', 'planet system');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyItemDialog],
    }).compileComponents();
  });

  it('renders the subregion fields and the region link multi-select with chips', async () => {
    const fixture = create('subregion');
    fixture.componentRef.setInput('regionOptions', regionOptions);
    fixture.componentRef.setInput('regionIds', [1]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect((el.querySelector('[name="galaxyName"]') as HTMLInputElement).value).toBe('');
    expect(el.querySelector('[name="galaxySectorType"]')).not.toBeNull();
    expect(el.querySelector('[name="galaxyCoordinates"]')).toBeNull();
    expect(el.querySelector('[name="galaxyDescription"]')).toBeNull();
    expect(el.querySelector('app-filter-group')).not.toBeNull();

    const chips = el.querySelectorAll('.link-chip');
    expect(chips.length).toBe(1);
    expect(chips[0]!.textContent).toContain('Outer Rim');
    expect(el.textContent).toContain('Outer Rim');
  });

  it('removes a selected region through its chip without reopening the dropdown', async () => {
    const fixture = create('subregion');
    fixture.componentRef.setInput('regionOptions', regionOptions);
    fixture.componentRef.setInput('regionIds', [1, 2]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.link-chip').length).toBe(2);

    const removeButtons = fixture.nativeElement.querySelectorAll(
      '.link-chip-remove',
    ) as NodeListOf<HTMLButtonElement>;
    removeButtons[0]!.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.regionIds()).toEqual([2]);
    expect(fixture.nativeElement.querySelectorAll('.link-chip').length).toBe(1);
  });

  it('adds a region from the searchable filter-group dropdown', async () => {
    const fixture = create('subregion');
    fixture.componentRef.setInput('regionOptions', regionOptions);
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      '.filter-group-trigger',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const checkboxes = fixture.nativeElement.querySelectorAll(
      '.filter-option input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(checkboxes.length).toBe(2);
    checkboxes[1]!.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.regionIds()).toEqual([2]);
  });

  it('renders the location-only fields with every planet location type', async () => {
    const fixture = create('planet-location');
    fixture.componentRef.setInput('coordinates', 'R-16');
    fixture.componentRef.setInput('type', 'City');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect((el.querySelector('[name="galaxyCoordinates"]') as HTMLInputElement).value).toBe('R-16');
    const typeSelect = el.querySelector('[name="galaxyType"]') as HTMLSelectElement;
    expect(typeSelect.options.length).toBe(PLANET_LOCATION_TYPES.length);
    expect(el.querySelector('[name="galaxySectorType"]')).toBeNull();
    expect(el.querySelector('[name="galaxyDescription"]')).not.toBeNull();
    expect(el.querySelector('app-filter-group')).toBeNull();
  });

  it('renders the planet-system fields with subregion link options', async () => {
    const fixture = create('planet-system');
    fixture.componentRef.setInput('subregionOptions', subregionOptions);
    fixture.componentRef.setInput('subregionIds', [11]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect(el.querySelector('[name="galaxyCoordinates"]')).not.toBeNull();
    expect(el.querySelector('[name="galaxyDescription"]')).not.toBeNull();
    expect(el.querySelector('[name="galaxySectorType"]')).toBeNull();
    expect(el.querySelectorAll('.link-chip').length).toBe(1);
    expect(el.textContent).toContain('Ryloth Sector');
  });

  it('does not render a link multi-select for kinds without links', async () => {
    const fixture = create('region');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-filter-group')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-chips')).toBeNull();
  });

  it('writes edits back to the model signals', async () => {
    const fixture = create('region');
    fixture.detectChanges();
    await fixture.whenStable();

    const name = fixture.nativeElement.querySelector('[name="galaxyName"]') as HTMLInputElement;
    name.value = 'Wild Space';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.name()).toBe('Wild Space');
  });

  it('emits save on submit and cancel on the cancel button', async () => {
    const fixture = create('region');
    const saved: unknown[] = [];
    const cancelled: unknown[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe((value) => cancelled.push(value));
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = fixture.nativeElement.querySelector('.admin-popup') as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    expect(saved.length).toBe(1);

    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);
  });

  it('headings and submit labels reflect add vs edit for the current kind', () => {
    const fixture = create('planet-system');
    fixture.detectChanges();

    expect(fixture.componentInstance.heading()).toBe('Add planet system');
    expect(fixture.nativeElement.querySelector('h3')?.textContent).toContain('Add planet system');
    expect(fixture.nativeElement.textContent).toContain('Adding a new planet system.');
    expect(
      (
        fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement
      ).textContent?.trim(),
    ).toBe('Add');

    fixture.componentRef.setInput('adding', false);
    fixture.detectChanges();

    expect(fixture.componentInstance.heading()).toBe('Edit planet system');
    expect(fixture.nativeElement.textContent).toContain('Saving replaces all fields.');
    expect(
      (
        fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement
      ).textContent?.trim(),
    ).toBe('Save');
  });

  it('disables the submit button while the save request is in flight', () => {
    const fixture = create('region');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Saving…');
  });

  it('shows the validation or server error inside the dialog', () => {
    const fixture = create('region');
    fixture.componentRef.setInput('error', 'A region with this name already exists.');
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.form-error') as HTMLElement).textContent).toBe(
      'A region with this name already exists.',
    );
  });
});
