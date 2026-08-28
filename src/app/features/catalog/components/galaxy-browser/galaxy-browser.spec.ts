/**
 * @fileoverview Unit tests for the galaxy page's {@link GalaxyBrowser} browsing
 * component: view switching, search, tree expansion, the empty-state footer,
 * and the re-emitted editor requests.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ApiPlanet,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../../shared/models/api-galaxy';
import { GalaxyDeleteTarget, GalaxyLocationEdit } from '../../models/galaxy-catalog-models';
import { GalaxyService } from '../../services/galaxy.service';
import { drainGalaxyRequests, seedGalaxy } from '../../test-support/galaxy-http-mock';
import { GalaxyBrowser } from './galaxy-browser';

describe('GalaxyBrowser', () => {
  let component: GalaxyBrowser;
  let fixture: ComponentFixture<GalaxyBrowser>;
  let httpMock: HttpTestingController;
  let galaxyService: GalaxyService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalaxyBrowser],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GalaxyBrowser);
    fixture.componentRef.setInput('admin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    galaxyService = TestBed.inject(GalaxyService);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the title, empty state, and a view-scoped add button', () => {
    expect(component.isAdmin()).toBe(true);
    expect(component.activeView()).toBe('regions');
    expect(component.addLabel()).toBe('+ Add region');
    const header = fixture.nativeElement.querySelector('.catalog-header') as HTMLElement;
    expect(header.querySelector('.catalog-add-button')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'The galaxy catalog is empty. Add a region to begin.',
    );
  });

  it('switches between the three browsing views and updates the add label', () => {
    const tabs = fixture.nativeElement.querySelectorAll(
      '.galaxy-view-switch__tab',
    ) as NodeListOf<HTMLButtonElement>;
    expect(tabs.length).toBe(3);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');

    tabs[1]!.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('subregions');
    expect(component.addLabel()).toBe('+ Add subregion');

    tabs[2]!.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('systems');
    expect(component.addLabel()).toBe('+ Add planet system');

    tabs[0]!.click();
    fixture.detectChanges();
    expect(component.activeView()).toBe('regions');
    expect(component.addLabel()).toBe('+ Add region');
  });

  it('emits the active-view add request from the header Add button', () => {
    let regionAdds = 0;
    const addSubregionValues: Array<number | null> = [];
    const addSystemValues: Array<number | null> = [];
    component.addRegion.subscribe(() => regionAdds++);
    component.addSubregion.subscribe((value) => addSubregionValues.push(value));
    component.addSystem.subscribe((value) => addSystemValues.push(value));

    const header = fixture.nativeElement.querySelector('.catalog-header') as HTMLElement;
    const addButton = header.querySelector('.catalog-add-button') as HTMLButtonElement;

    addButton.click();
    expect(regionAdds).toBe(1);

    (
      fixture.nativeElement.querySelectorAll('.galaxy-view-switch__tab')[1] as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    addButton.click();
    expect(addSubregionValues).toEqual([null]);

    (
      fixture.nativeElement.querySelectorAll('.galaxy-view-switch__tab')[2] as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    addButton.click();
    expect(addSystemValues).toEqual([null]);
  });

  it('expands a region down to its subregion, system, planet, and locations', () => {
    const assertRegionName = 'Outer Rim';
    const subregionName = 'Ryloth Sector';
    const systemName = 'Ryloth system';
    const planetName = 'Ryloth';
    const locationName = 'Lessu';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: assertRegionName, description: null, subregions: [] }],
      subregions: [
        {
          id: 2,
          name: subregionName,
          sectorType: 'sector',
          description: null,
          regions: [{ id: 1, name: assertRegionName }],
          planetSystems: [],
        },
      ],
      systems: [
        {
          id: 3,
          name: systemName,
          coordinates: 'R-16',
          description: null,
          subregions: [{ id: 2, name: subregionName }],
        },
      ],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: 'Twi\u2019lek homeworld',
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [{ id: 5, name: locationName }],
          },
        ],
      },
    });

    component.toggleExpanded('region-1');
    component.toggleExpanded('subregion-2');
    component.toggleExpanded('system-3');
    component.togglePlanet({
      id: 4,
      name: planetName,
      description: 'Twi\u2019lek homeworld',
      planetSystemId: 3,
      planetSystemName: systemName,
      locations: [{ id: 5, name: locationName }],
    });
    drainGalaxyRequests(httpMock);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain(subregionName);
    expect(text).toContain(systemName);
    expect(text).toContain(planetName);
    expect(text).toContain(locationName);

    const addLabels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.galaxy-add-row button',
      ) as NodeListOf<HTMLButtonElement>,
    ).map((button) => button.textContent?.trim());
    expect(addLabels).toEqual([
      '+ Add location',
      '+ Add planet',
      '+ Add planet system',
      '+ Add subregion',
    ]);
  });

  it('shows the region links as chips in the subregions view', () => {
    const assertRegionName = 'Outer Rim';
    const subregionName = 'Ryloth Sector';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: assertRegionName, description: null, subregions: [] }],
      subregions: [
        {
          id: 2,
          name: subregionName,
          sectorType: null,
          description: null,
          regions: [{ id: 1, name: assertRegionName }],
          planetSystems: [],
        },
      ],
      systems: [],
    });

    component.selectView('subregions');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Part of');
    expect(text).toContain(assertRegionName);
    expect(component.filteredSubregionRows()[0]?.subregion.regions).toEqual([
      { id: 1, name: assertRegionName },
    ]);
  });

  it('shows the subregion links as chips in the planet systems view', () => {
    const subregionName = 'Ryloth Sector';
    const systemName = 'Ryloth system';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [
        {
          id: 2,
          name: subregionName,
          sectorType: null,
          description: null,
          regions: [{ id: 1, name: 'Outer Rim' }],
          planetSystems: [],
        },
      ],
      systems: [
        {
          id: 3,
          name: systemName,
          coordinates: null,
          description: null,
          subregions: [{ id: 2, name: subregionName }],
        },
      ],
    });

    component.selectView('systems');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Inside');
    expect(text).toContain(subregionName);
  });

  it('filters the regions view by a nested descendant', () => {
    const keptRegionName = 'Outer Rim';
    const droppedRegionName = 'Inner Worlds';
    const subregionName = 'Ryloth Sector';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [
        { id: 1, name: keptRegionName, description: null, subregions: [] },
        { id: 6, name: droppedRegionName, description: null, subregions: [] },
      ],
      subregions: [
        {
          id: 2,
          name: subregionName,
          sectorType: null,
          description: null,
          regions: [{ id: 1, name: keptRegionName }],
          planetSystems: [],
        },
      ],
      systems: [],
    });

    component.searchTerm.set('ryloth');
    fixture.detectChanges();

    expect(component.filteredRegionRows()).toEqual([
      expect.objectContaining({
        region: expect.objectContaining({ id: 1, name: keptRegionName }),
      }),
    ]);
    expect(fixture.nativeElement.textContent).not.toContain(droppedRegionName);
  });

  it('delegates edit, add, and delete requests to its outputs', () => {
    const editedRegions: ApiRegion[] = [];
    const editedSubregions: ApiSubregion[] = [];
    const editedSystems: ApiPlanetSystem[] = [];
    const editedPlanets: ApiPlanet[] = [];
    const editedLocations: GalaxyLocationEdit[] = [];
    const addedSubregions: Array<number | null> = [];
    const addedSystems: Array<number | null> = [];
    const addedPlanets: number[] = [];
    const addedLocations: number[] = [];
    const removed: GalaxyDeleteTarget[] = [];
    component.editRegion.subscribe((value) => editedRegions.push(value));
    component.editSubregion.subscribe((value) => editedSubregions.push(value));
    component.editSystem.subscribe((value) => editedSystems.push(value));
    component.editPlanet.subscribe((value) => editedPlanets.push(value));
    component.editLocation.subscribe((value) => editedLocations.push(value));
    component.addSubregion.subscribe((value) => addedSubregions.push(value));
    component.addSystem.subscribe((value) => addedSystems.push(value));
    component.addPlanet.subscribe((value) => addedPlanets.push(value));
    component.addLocation.subscribe((value) => addedLocations.push(value));
    component.remove.subscribe((value) => removed.push(value));

    const region: ApiRegion = { id: 1, name: 'Outer Rim', description: null, subregions: [] };
    component.startEditRegion(region);
    expect(editedRegions).toEqual([region]);

    const subregion: ApiSubregion = {
      id: 2,
      name: 'Ryloth Sector',
      sectorType: null,
      description: null,
      regions: [{ id: 1, name: 'Outer Rim' }],
      planetSystems: [],
    };
    component.startEditSubregion(subregion);
    expect(editedSubregions).toEqual([subregion]);

    const system: ApiPlanetSystem = {
      id: 3,
      name: 'Ryloth system',
      coordinates: null,
      description: null,
      subregions: [],
    };
    component.startEditSystem(system);
    expect(editedSystems).toEqual([system]);

    const planet: ApiPlanet = {
      id: 4,
      name: 'Ryloth',
      description: null,
      planetSystemId: 3,
      planetSystemName: 'Ryloth system',
      locations: [],
    };
    component.startEditPlanet(planet);
    expect(editedPlanets).toEqual([planet]);

    component.startEditLocation({ id: 5, name: 'Lessu' }, 4);
    expect(editedLocations).toEqual([{ location: { id: 5, name: 'Lessu' }, planetId: 4 }]);

    component.requestDelete('planet-location', 5, 'Lessu');
    expect(removed).toEqual([{ kind: 'planet-location', id: 5, name: 'Lessu' }]);

    component.openAddSubregion(1);
    expect(addedSubregions).toEqual([1]);
    component.openAddSystem(2);
    expect(addedSystems).toEqual([2]);
    component.openAddPlanet(3);
    expect(addedPlanets).toEqual([3]);
    component.openAddLocation(4);
    expect(addedLocations).toEqual([4]);
  });

  it('hides the header Add button for non-admin viewers', () => {
    fixture.componentRef.setInput('admin', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.catalog-add-button')).toBeNull();
  });
});
