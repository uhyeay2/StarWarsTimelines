import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { GalaxyKind } from '../../../../features/catalog/models/galaxy-catalog-models';
import { ApiRegion, ApiSubregion } from '../../../../shared/models/api-galaxy';
import { PLANET_LOCATION_TYPES } from '../../../../shared/models/planet-location-type';
import { GalaxyItemForm } from './galaxy-item-form';

describe('GalaxyItemForm', () => {
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

  function create(kind: GalaxyKind): ComponentFixture<GalaxyItemForm> {
    const fixture = TestBed.createComponent(GalaxyItemForm);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('adding', true);
    fixture.componentRef.setInput('kindLabel', 'planet system');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyItemForm, FormsModule],
    }).compileComponents();
  });

  it('renders the subregion fields and the region link options', async () => {
    const fixture = create('subregion');
    fixture.componentRef.setInput('regionOptions', regionOptions);
    fixture.componentRef.setInput('name', 'Bahayan');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect((el.querySelector('[name="galaxyName"]') as HTMLInputElement).value).toBe('Bahayan');
    expect(el.querySelector('[name="galaxySectorType"]')).not.toBeNull();
    expect(el.querySelector('[name="galaxyCoordinates"]')).toBeNull();
    expect(el.querySelector('[name="galaxyDescription"]')).toBeNull();
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(2);
    expect(el.textContent).toContain('Outer Rim');
  });

  it('toggles a region id in the link selection through its checkbox', async () => {
    const fixture = create('subregion');
    fixture.componentRef.setInput('regionOptions', regionOptions);
    fixture.componentRef.setInput('regionIds', [1]);
    fixture.detectChanges();
    await fixture.whenStable();

    const checkboxes = fixture.nativeElement.querySelectorAll(
      'input[type="checkbox"]',
    ) as HTMLInputElement[];
    expect(checkboxes[1]!.checked).toBe(false);
    checkboxes[1]!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.regionIds()).toEqual([1, 2]);

    checkboxes[0]!.click();
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
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('renders the planet-system fields with subregion link options', async () => {
    const fixture = create('planet-system');
    fixture.componentRef.setInput('subregionOptions', subregionOptions);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect(el.querySelector('[name="galaxyCoordinates"]')).not.toBeNull();
    expect(el.querySelector('[name="galaxyDescription"]')).not.toBeNull();
    expect(el.querySelector('[name="galaxySectorType"]')).toBeNull();
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(1);
    expect(el.textContent).toContain('Ryloth Sector');
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

    (fixture.nativeElement.querySelector('.galaxy-form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();
    expect(saved.length).toBe(1);

    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(cancelled.length).toBe(1);
  });

  it('labels and disables saving from the adding and busy inputs', () => {
    const fixture = create('region');
    fixture.detectChanges();

    let submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.textContent?.trim()).toBe('Add');
    expect(fixture.nativeElement.textContent).toContain('Adding a new planet system.');

    fixture.componentRef.setInput('adding', false);
    fixture.detectChanges();
    submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.textContent?.trim()).toBe('Save');
    expect(fixture.nativeElement.textContent).toContain('Saving replaces all fields.');
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
});
