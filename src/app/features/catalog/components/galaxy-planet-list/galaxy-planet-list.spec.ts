import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createFakeGalaxyHost } from '../galaxy-catalog/fake-galaxy-host';
import { GalaxyPlanetNode } from '../../../../features/catalog/models/galaxy-catalog-models';
import { ApiPlanet } from '../../../../shared/models/api-galaxy';
import { GalaxyPlanetList } from './galaxy-planet-list';

describe('GalaxyPlanetList', () => {
  const planet: ApiPlanet = {
    id: 31,
    name: 'Ryloth',
    description: "Twi'lek homeworld",
    planetSystemId: 21,
    planetSystemName: 'Ryloth System',
    locations: [{ id: 41, name: 'Lessu' }],
  };

  const node: GalaxyPlanetNode = { planet, locations: [] };

  function create(
    options: {
      host?: ReturnType<typeof createFakeGalaxyHost>;
      nodes?: readonly GalaxyPlanetNode[];
      addParentId?: number;
    } = {},
  ): ComponentFixture<GalaxyPlanetList> {
    const fixture = TestBed.createComponent(GalaxyPlanetList);
    fixture.componentRef.setInput('host', options.host ?? createFakeGalaxyHost());
    fixture.componentRef.setInput('nodes', options.nodes ?? [node]);
    fixture.componentRef.setInput('addParentId', options.addParentId ?? 21);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyPlanetList],
    }).compileComponents();
  });

  it('renders each planet row with its name and description', () => {
    const fixture = create();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ryloth');
    expect(fixture.nativeElement.textContent).toContain("Twi'lek homeworld");
  });

  it('forwards the toggle through togglePlanet so the host warms its cache', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.galaxy-toggle') as HTMLButtonElement).click();
    expect(vi.mocked(host.togglePlanet)).toHaveBeenCalledWith(planet);
    expect(vi.mocked(host.toggleExpanded)).not.toHaveBeenCalled();
  });

  it('forwards edit and delete to the host', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.galaxy-actions .btn',
    ) as HTMLButtonElement[];
    buttons[0]!.click();
    expect(vi.mocked(host.startEditPlanet)).toHaveBeenCalledWith(planet);

    buttons[1]!.click();
    expect(vi.mocked(host.requestDelete)).toHaveBeenCalledWith('planet', 31, 'Ryloth');
  });

  it('renders the add-planet row and scopes it to the owning system', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    const add = fixture.nativeElement.querySelector('.galaxy-add-row button') as HTMLButtonElement;
    expect(add.textContent?.trim()).toBe('+ Add planet');
    add.click();
    expect(vi.mocked(host.openAddPlanet)).toHaveBeenCalledWith(21);
  });

  it('renders the surface locations and their add row once expanded', () => {
    const expanded = { ...node, locations: [{ id: 41, name: 'Lessu' }] };
    const host = createFakeGalaxyHost({ isExpanded: vi.fn(() => true) });
    const fixture = create({ host, nodes: [expanded] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lessu');

    (fixture.nativeElement.querySelector('.galaxy-add-row button') as HTMLButtonElement).click();
    expect(vi.mocked(host.openAddLocation)).toHaveBeenCalledWith(31);
  });

  it('hides the admin actions and add row when the viewer cannot edit', () => {
    const host = createFakeGalaxyHost({ isAdmin: vi.fn(() => false) });
    const fixture = create({ host });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.galaxy-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.galaxy-add-row')).toBeNull();
  });
});
