import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createFakeGalaxyHost } from '../galaxy-catalog/fake-galaxy-host';
import { GalaxySystemNode } from '../../../../features/catalog/models/galaxy-catalog-models';
import { ApiPlanetSystem } from '../../../../shared/models/api-galaxy';
import { GalaxyPlanetSystemList } from './galaxy-planet-system-list';

describe('GalaxyPlanetSystemList', () => {
  const system: ApiPlanetSystem = {
    id: 21,
    name: 'Ryloth System',
    coordinates: 'R-16',
    description: null,
    subregions: [{ id: 11, name: 'Ryloth Sector' }],
  };

  const node: GalaxySystemNode = { system, planets: [] };

  function create(
    options: {
      host?: ReturnType<typeof createFakeGalaxyHost>;
      nodes?: readonly GalaxySystemNode[];
      showChips?: boolean;
      showAdd?: boolean;
      addParentId?: number | null;
    } = {},
  ): ComponentFixture<GalaxyPlanetSystemList> {
    const fixture = TestBed.createComponent(GalaxyPlanetSystemList);
    fixture.componentRef.setInput('host', options.host ?? createFakeGalaxyHost());
    fixture.componentRef.setInput('nodes', options.nodes ?? [node]);
    fixture.componentRef.setInput('showChips', options.showChips ?? false);
    fixture.componentRef.setInput('showAdd', options.showAdd ?? false);
    fixture.componentRef.setInput('addParentId', options.addParentId ?? null);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyPlanetSystemList],
    }).compileComponents();
  });

  it('renders each system row with its name and coordinates', () => {
    const fixture = create();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ryloth System');
    expect(fixture.nativeElement.textContent).toContain('R-16');
  });

  it('shows the "Inside" chips with subregion names when enabled', () => {
    const fixture = create({ showChips: true });
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect((el.querySelector('.galaxy-chips-label') as HTMLElement).textContent).toBe('Inside');
    expect(el.textContent).toContain('Ryloth Sector');
  });

  it('forwards edit and delete to the host', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.galaxy-actions .btn',
    ) as HTMLButtonElement[];
    buttons[0]!.click();
    expect(vi.mocked(host.startEditSystem)).toHaveBeenCalledWith(system);

    buttons[1]!.click();
    expect(vi.mocked(host.requestDelete)).toHaveBeenCalledWith(
      'planet-system',
      21,
      'Ryloth System',
    );
  });

  it('renders the add-system row and scopes it to the owning subregion', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host, showAdd: true, addParentId: 11 });
    fixture.detectChanges();

    const add = fixture.nativeElement.querySelector('.galaxy-add-row button') as HTMLButtonElement;
    expect(add.textContent?.trim()).toBe('+ Add planet system');
    add.click();
    expect(vi.mocked(host.openAddSystem)).toHaveBeenCalledWith(11);
  });

  it('renders the nested planets and their add row once expanded', () => {
    const planet = {
      id: 31,
      name: 'Ryloth',
      description: "Twi'lek homeworld",
      planetSystemId: 21,
      planetSystemName: 'Ryloth System',
      locations: [{ id: 41, name: 'Lessu' }],
    };
    const expanded = { ...node, planets: [{ planet, locations: [] }] };
    const host = createFakeGalaxyHost({ isExpanded: vi.fn(() => true) });
    const fixture = create({ host, nodes: [expanded] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ryloth');

    const addButtons = fixture.nativeElement.querySelectorAll(
      '.galaxy-add-row button',
    ) as HTMLButtonElement[];
    const addPlanet = [...addButtons].find(
      (button) => button.textContent?.trim() === '+ Add planet',
    );
    addPlanet!.click();
    expect(vi.mocked(host.openAddPlanet)).toHaveBeenCalledWith(21);
  });
});
