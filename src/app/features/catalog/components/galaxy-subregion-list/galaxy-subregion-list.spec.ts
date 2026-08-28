import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createFakeGalaxyHost } from '../galaxy-catalog/fake-galaxy-host';
import { GalaxySubregionNode } from '../../../../features/catalog/models/galaxy-catalog-models';
import { ApiSubregion } from '../../../../shared/models/api-galaxy';
import { GalaxySubregionList } from './galaxy-subregion-list';

describe('GalaxySubregionList', () => {
  const subregion: ApiSubregion = {
    id: 11,
    name: 'Ryloth Sector',
    sectorType: 'Sector',
    description: null,
    regions: [{ id: 1, name: 'Outer Rim' }],
    planetSystems: [],
  };

  const node: GalaxySubregionNode = { subregion, systems: [] };

  function create(
    options: {
      host?: ReturnType<typeof createFakeGalaxyHost>;
      nodes?: readonly GalaxySubregionNode[];
      showChips?: boolean;
      showAdd?: boolean;
      addParentId?: number | null;
    } = {},
  ): ComponentFixture<GalaxySubregionList> {
    const fixture = TestBed.createComponent(GalaxySubregionList);
    fixture.componentRef.setInput('host', options.host ?? createFakeGalaxyHost());
    fixture.componentRef.setInput('nodes', options.nodes ?? [node]);
    fixture.componentRef.setInput('showChips', options.showChips ?? false);
    fixture.componentRef.setInput('showAdd', options.showAdd ?? false);
    fixture.componentRef.setInput('addParentId', options.addParentId ?? null);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxySubregionList],
    }).compileComponents();
  });

  it('renders each subregion row with its name and sector type', () => {
    const fixture = create();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ryloth Sector');
    expect(fixture.nativeElement.textContent).toContain('Sector');
  });

  it('hides the region links unless showChips is on', () => {
    const fixture = create();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.galaxy-chips')).toBeNull();
  });

  it('shows the "Part of" chips with region names when enabled', () => {
    const fixture = create({ showChips: true });
    fixture.detectChanges();

    const el = fixture.nativeElement;
    expect((el.querySelector('.galaxy-chips-label') as HTMLElement).textContent).toBe('Part of');
    expect(el.textContent).toContain('Outer Rim');
  });

  it('forwards edit and delete to the host', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.galaxy-actions .btn',
    ) as HTMLButtonElement[];
    buttons[0]!.click();
    expect(vi.mocked(host.startEditSubregion)).toHaveBeenCalledWith(subregion);

    buttons[1]!.click();
    expect(vi.mocked(host.requestDelete)).toHaveBeenCalledWith('subregion', 11, 'Ryloth Sector');
  });

  it('renders the add-subregion row and scopes it to the owning region', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host, showAdd: true, addParentId: 1 });
    fixture.detectChanges();

    const add = fixture.nativeElement.querySelector('.galaxy-add-row button') as HTMLButtonElement;
    expect(add.textContent?.trim()).toBe('+ Add subregion');
    add.click();
    expect(vi.mocked(host.openAddSubregion)).toHaveBeenCalledWith(1);
  });

  it('omits the add-subregion row when disabled', () => {
    const fixture = create({ showAdd: false });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.galaxy-add-row')).toBeNull();
  });

  it('renders the linked planet systems once a subregion is expanded', () => {
    const system = {
      id: 21,
      name: 'Ryloth System',
      coordinates: 'R-16',
      description: null,
      subregions: [{ id: 11, name: 'Ryloth Sector' }],
    };
    const expanded = { ...node, systems: [{ system, planets: [] }] };
    const host = createFakeGalaxyHost({ isExpanded: vi.fn(() => true) });
    const fixture = create({ host, nodes: [expanded] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ryloth System');
  });
});
