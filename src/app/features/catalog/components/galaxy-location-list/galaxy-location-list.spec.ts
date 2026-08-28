import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createFakeGalaxyHost } from '../galaxy-catalog/fake-galaxy-host';
import { GalaxyLocationNode } from '../../../../features/catalog/models/galaxy-catalog-models';
import { GalaxyLocationList } from './galaxy-location-list';

describe('GalaxyLocationList', () => {
  const location: GalaxyLocationNode = { id: 41, name: 'Lessu' };

  function create(
    options: {
      host?: ReturnType<typeof createFakeGalaxyHost>;
      nodes?: readonly GalaxyLocationNode[];
      addParentId?: number;
    } = {},
  ): ComponentFixture<GalaxyLocationList> {
    const fixture = TestBed.createComponent(GalaxyLocationList);
    fixture.componentRef.setInput('host', options.host ?? createFakeGalaxyHost());
    fixture.componentRef.setInput('nodes', options.nodes ?? [location]);
    fixture.componentRef.setInput('addParentId', options.addParentId ?? 31);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyLocationList],
    }).compileComponents();
  });

  it('renders each location row with its name', () => {
    const fixture = create();
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.galaxy-name') as HTMLElement).textContent).toBe(
      'Lessu',
    );
    expect(fixture.nativeElement.querySelectorAll('li.galaxy-node--leaf').length).toBe(1);
  });

  it('forwards edit with the owning planet id and delete to the host', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.galaxy-actions .btn',
    ) as HTMLButtonElement[];
    buttons[0]!.click();
    expect(vi.mocked(host.startEditLocation)).toHaveBeenCalledWith(location, 31);

    buttons[1]!.click();
    expect(vi.mocked(host.requestDelete)).toHaveBeenCalledWith('planet-location', 41, 'Lessu');
  });

  it('renders the add-location row and scopes it to the owning planet', () => {
    const host = createFakeGalaxyHost();
    const fixture = create({ host });
    fixture.detectChanges();

    const add = fixture.nativeElement.querySelector('.galaxy-add-row button') as HTMLButtonElement;
    expect(add.textContent?.trim()).toBe('+ Add location');
    add.click();
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
