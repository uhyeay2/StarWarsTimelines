import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createFakeGalaxyHost } from '../galaxy-catalog/fake-galaxy-host';
import { GalaxyRegionNode } from '../../../../features/catalog/models/galaxy-catalog-models';
import { ApiRegion } from '../../../../shared/models/api-galaxy';
import { GalaxyRegionList } from './galaxy-region-list';

describe('GalaxyRegionList', () => {
  const region: ApiRegion = {
    id: 1,
    name: 'Outer Rim',
    description: 'The frontier',
    subregions: [{ id: 11, name: 'Ryloth Sector' }],
  };

  const emptyNode: GalaxyRegionNode = { region, subregions: [] };

  function create(host = createFakeGalaxyHost()): ComponentFixture<GalaxyRegionList> {
    const fixture = TestBed.createComponent(GalaxyRegionList);
    fixture.componentRef.setInput('host', host);
    fixture.componentRef.setInput('nodes', [emptyNode]);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyRegionList],
    }).compileComponents();
  });

  it('renders each region row with its name and description', () => {
    const fixture = create();
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect(el.querySelectorAll('li.galaxy-node').length).toBe(1);
    expect(el.textContent).toContain('Outer Rim');
    expect(el.textContent).toContain('The frontier');
  });

  it('forwards expand and collapse to the host', () => {
    const host = createFakeGalaxyHost();
    const fixture = create(host);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.galaxy-toggle') as HTMLButtonElement).click();
    expect(vi.mocked(host.toggleExpanded)).toHaveBeenCalledWith('region-1');
  });

  it('shows admin actions and forwards edit and delete', () => {
    const host = createFakeGalaxyHost();
    const fixture = create(host);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.galaxy-actions .btn',
    ) as HTMLButtonElement[];
    buttons[0]!.click();
    expect(vi.mocked(host.startEditRegion)).toHaveBeenCalledWith(region);

    buttons[1]!.click();
    expect(vi.mocked(host.requestDelete)).toHaveBeenCalledWith('region', 1, 'Outer Rim');
  });

  it('hides admin actions when the viewer cannot edit', () => {
    const host = createFakeGalaxyHost({ isAdmin: vi.fn(() => false) });
    const fixture = create(host);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.galaxy-actions')).toBeNull();
  });

  it('renders the linked subregions once a region is expanded', () => {
    const subregion = {
      id: 11,
      name: 'Ryloth Sector',
      sectorType: 'Sector',
      description: null,
      regions: [{ id: 1, name: 'Outer Rim' }],
      planetSystems: [],
    };
    const node: GalaxyRegionNode = {
      region,
      subregions: [{ subregion, systems: [] }],
    };
    const host = createFakeGalaxyHost({ isExpanded: vi.fn(() => true) });
    const fixture = TestBed.createComponent(GalaxyRegionList);
    fixture.componentRef.setInput('host', host);
    fixture.componentRef.setInput('nodes', [node]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ryloth Sector');
  });
});
