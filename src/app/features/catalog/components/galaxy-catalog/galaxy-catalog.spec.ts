import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GalaxyService } from '../../services/galaxy.service';
import {
  drainGalaxyRequests,
  PLANET_SYSTEMS_URL,
  REGIONS_URL,
  seedGalaxy,
  SUBREGIONS_URL,
} from '../../test-support/galaxy-http-mock';
import { GalaxyCatalog } from './galaxy-catalog';

describe('GalaxyCatalog', () => {
  let component: GalaxyCatalog;
  let fixture: ComponentFixture<GalaxyCatalog>;
  let httpMock: HttpTestingController;
  let galaxyService: GalaxyService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GalaxyCatalog],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GalaxyCatalog);
    fixture.componentRef.setInput('isAdmin', true);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    galaxyService = TestBed.inject(GalaxyService);
    fixture.detectChanges();

    drainGalaxyRequests(httpMock);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Finds the tree add-row button with the given label. */
  function findAddButton(label: string): HTMLButtonElement {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('.galaxy-add-row button'),
    ).find((candidate) => (candidate as HTMLButtonElement).textContent?.trim() === label);
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
  }

  /** Clicks the 1-based browsing view tab, then re-renders. */
  function selectView(index: number): void {
    const tab = fixture.nativeElement.querySelectorAll('.galaxy-view-switch__tab')[
      index
    ] as HTMLButtonElement;
    tab.click();
    fixture.detectChanges();
  }

  /** Clicks the expand toggle of the tree row with the given name. */
  function toggleRow(name: string): void {
    const candidates = fixture.nativeElement.querySelectorAll('.galaxy-row');
    const row = Array.from(candidates).find(
      (candidate) =>
        (candidate as HTMLElement).querySelector('.galaxy-name')?.textContent?.trim() === name,
    );
    expect(row).toBeDefined();
    const toggle = (row as HTMLElement).querySelector('.galaxy-toggle') as HTMLButtonElement;
    toggle.click();
  }

  /** The tree row names currently rendered. */
  function rowNames(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.galaxy-name')).map(
      (element) => (element as HTMLElement).textContent?.trim() ?? '',
    );
  }

  it('creates a region from the header add button', () => {
    const createdName = 'Core Worlds';
    const header = fixture.nativeElement.querySelector('.catalog-header') as HTMLElement;
    const addButton = header.querySelector('.catalog-add-button') as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    component.formName.set(createdName);
    component.submitForm();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(REGIONS_URL));
    expect(post.request.body).toEqual({ name: createdName, description: null });
    post.flush({ id: 7, name: createdName, description: null, subregions: [] });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 7, name: createdName, description: null, subregions: [] }],
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(rowNames()).toContain(createdName);
  });

  it('requires a name when saving the form', () => {
    component.openAddRegion();
    component.formName.set('   ');
    component.submitForm();

    expect(component.formError()).toBe('A name is required.');
    expect(component.busy()).toBe(false);
  });

  it('surfaces the server message when creating a duplicate region', () => {
    const duplicateDetail = 'A region with this name already exists.';
    component.openAddRegion();
    component.formName.set('Outer Rim');
    component.submitForm();

    httpMock
      .expectOne((r) => r.method === 'POST' && r.url.endsWith(REGIONS_URL))
      .flush({ detail: duplicateDetail }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(component.formError()).toBe(duplicateDetail);
    expect(component.formState()?.id).toBeNull();
  });

  it('creates a subregion linked to the region it is added from', () => {
    const assertRegionName = 'Outer Rim';
    const createdName = 'Ryloth Sector';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: assertRegionName, description: null, subregions: [] }],
      subregions: [],
      systems: [],
    });

    toggleRow(assertRegionName);
    fixture.detectChanges();
    findAddButton('+ Add subregion').click();
    fixture.detectChanges();

    expect(component.formState()?.kind).toBe('subregion');
    expect(component.formRegionIds()).toEqual([1]);
    expect(component.formContextLabel()).toContain(assertRegionName);

    component.formName.set(createdName);
    component.submitForm();

    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith(SUBREGIONS_URL));
    expect(post.request.body).toEqual({
      name: createdName,
      sectorType: null,
      description: null,
      regionIds: [1],
    });
    post.flush({
      id: 2,
      name: createdName,
      sectorType: null,
      description: null,
      regions: [{ id: 1, name: assertRegionName }],
      planetSystems: [],
    });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: assertRegionName, description: null, subregions: [] }],
      subregions: [
        {
          id: 2,
          name: createdName,
          sectorType: null,
          description: null,
          regions: [{ id: 1, name: assertRegionName }],
          planetSystems: [],
        },
      ],
      systems: [],
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(rowNames()).toContain(createdName);
  });

  it('creates a planet system linked to the subregion it is added from', () => {
    const assertRegionName = 'Outer Rim';
    const subregionName = 'Ryloth Sector';
    const createdName = 'Ryloth system';
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

    selectView(1);
    toggleRow(subregionName);
    fixture.detectChanges();
    findAddButton('+ Add planet system').click();
    fixture.detectChanges();

    expect(component.formState()?.kind).toBe('planet-system');
    expect(component.formSubregionIds()).toEqual([2]);
    expect(component.formContextLabel()).toContain(subregionName);

    component.formName.set(createdName);
    component.submitForm();

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith(PLANET_SYSTEMS_URL),
    );
    expect(post.request.body).toEqual({
      name: createdName,
      coordinates: null,
      description: null,
      subregionIds: [2],
    });
    post.flush({
      id: 3,
      name: createdName,
      coordinates: null,
      description: null,
      subregions: [{ id: 2, name: subregionName }],
    });

    drainGalaxyRequests(httpMock, {
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
      systems: [
        {
          id: 3,
          name: createdName,
          coordinates: null,
          description: null,
          subregions: [{ id: 2, name: subregionName }],
        },
      ],
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(rowNames()).toContain(createdName);
  });

  it('creates a planet inside a planet system', () => {
    const systemName = 'Ryloth system';
    const createdName = 'Ryloth';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [
        {
          id: 3,
          name: systemName,
          coordinates: null,
          description: null,
          subregions: [],
        },
      ],
      planets: { 3: [] },
    });

    component.openAddPlanet(3);
    component.formName.set(createdName);
    component.submitForm();

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith(`${PLANET_SYSTEMS_URL}/3/planets`),
    );
    expect(post.request.body).toEqual({ name: createdName, description: null });
    post.flush({
      id: 4,
      name: createdName,
      description: null,
      planetSystemId: 3,
      planetSystemName: systemName,
      locations: [],
    });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [
        {
          id: 3,
          name: systemName,
          coordinates: null,
          description: null,
          subregions: [],
        },
      ],
      planets: {
        3: [
          {
            id: 4,
            name: createdName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [],
          },
        ],
      },
    });
    fixture.detectChanges();

    selectView(2);
    toggleRow(systemName);
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(rowNames()).toContain(createdName);
  });

  it('creates a planet location scoped to its planet', () => {
    const systemName = 'Ryloth system';
    const planetName = 'Ryloth';
    const createdName = 'Lessu';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [
        {
          id: 3,
          name: systemName,
          coordinates: null,
          description: null,
          subregions: [],
        },
      ],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [],
          },
        ],
      },
    });

    selectView(2);
    toggleRow(systemName);
    fixture.detectChanges();
    toggleRow(planetName);
    fixture.detectChanges();
    drainGalaxyRequests(httpMock);
    fixture.detectChanges();

    findAddButton('+ Add location').click();
    fixture.detectChanges();

    expect(component.formState()?.kind).toBe('planet-location');
    component.formName.set(createdName);
    component.formType.set('City');
    component.submitForm();

    const post = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url.endsWith('/api/planets/4/locations'),
    );
    expect(post.request.body).toEqual({
      name: createdName,
      type: 1,
      coordinates: null,
      description: null,
    });
    post.flush({
      id: 5,
      name: createdName,
      type: 1,
      coordinates: null,
      description: null,
      planetId: 4,
      planetName,
    });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [
        {
          id: 3,
          name: systemName,
          coordinates: null,
          description: null,
          subregions: [],
        },
      ],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [{ id: 5, name: createdName }],
          },
        ],
      },
      locations: {
        4: [
          {
            id: 5,
            name: createdName,
            type: 1,
            coordinates: null,
            description: null,
            planetId: 4,
            planetName,
          },
        ],
      },
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(createdName);
  });

  it('replaces a region when editing it', () => {
    const originalName = 'Outer Rim';
    const renamed = 'Outer Rim Territories';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [
        { id: 1, name: originalName, description: null, subregions: [{ id: 2, name: 'Sector' }] },
      ],
      subregions: [],
      systems: [],
    });

    component.startEditRegion({
      id: 1,
      name: originalName,
      description: null,
      subregions: [{ id: 2, name: 'Sector' }],
    });
    component.formName.set(renamed);
    component.submitForm();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith(`${REGIONS_URL}/1`));
    expect(put.request.body).toEqual({ name: renamed, description: null });
    put.flush({ id: 1, name: renamed, description: null, subregions: [] });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: renamed, description: null, subregions: [] }],
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(rowNames()).toContain(renamed);
  });

  it('replaces a planet system keeping its subregion links', () => {
    const subregionName = 'Ryloth Sector';
    const systemName = 'Ryloth system';
    const renamed = 'Ryloth system (Revised)';
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
          coordinates: 'R-16',
          description: null,
          subregions: [{ id: 2, name: subregionName }],
        },
      ],
    });

    component.startEditSystem({
      id: 3,
      name: systemName,
      coordinates: 'R-16',
      description: null,
      subregions: [{ id: 2, name: subregionName }],
    });
    expect(component.formSubregionIds()).toEqual([2]);
    component.formName.set(renamed);
    component.submitForm();

    const put = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url.endsWith(`${PLANET_SYSTEMS_URL}/3`),
    );
    expect(put.request.body).toEqual({
      name: renamed,
      coordinates: 'R-16',
      description: null,
      subregionIds: [2],
    });
    put.flush({
      id: 3,
      name: renamed,
      coordinates: null,
      description: null,
      subregions: [{ id: 2, name: subregionName }],
    });

    drainGalaxyRequests(httpMock, {
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
          name: renamed,
          coordinates: null,
          description: null,
          subregions: [{ id: 2, name: subregionName }],
        },
      ],
    });
    fixture.detectChanges();

    selectView(1);
    toggleRow(subregionName);
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
    expect(rowNames()).toContain(renamed);
  });

  it('replaces a subregion keeping its region links', () => {
    const regionName = 'Outer Rim';
    const subregionName = 'Ryloth Sector';
    const renamed = 'Ryloth Sector Prime';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: regionName, description: null, subregions: [] }],
      subregions: [
        {
          id: 2,
          name: subregionName,
          sectorType: null,
          description: null,
          regions: [{ id: 1, name: regionName }],
          planetSystems: [],
        },
      ],
      systems: [],
    });

    component.startEditSubregion({
      id: 2,
      name: subregionName,
      sectorType: null,
      description: null,
      regions: [{ id: 1, name: regionName }],
      planetSystems: [],
    });
    expect(component.formRegionIds()).toEqual([1]);
    component.formName.set(renamed);
    component.submitForm();

    const put = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url.endsWith(`${SUBREGIONS_URL}/2`),
    );
    expect(put.request.body).toEqual({
      name: renamed,
      sectorType: null,
      description: null,
      regionIds: [1],
    });
    put.flush({
      id: 2,
      name: renamed,
      sectorType: null,
      description: null,
      regions: [{ id: 1, name: regionName }],
      planetSystems: [],
    });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: regionName, description: null, subregions: [] }],
      systems: [],
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
  });

  it('replaces a planet when editing it', () => {
    const systemName = 'Ryloth system';
    const planetName = 'Ryloth';
    const renamed = 'Ryloth Prime';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [{ id: 3, name: systemName, coordinates: null, description: null, subregions: [] }],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [],
          },
        ],
      },
    });

    component.startEditPlanet({
      id: 4,
      name: planetName,
      description: null,
      planetSystemId: 3,
      planetSystemName: systemName,
      locations: [],
    });
    expect(component.formState()?.parentId).toBe(3);
    component.formName.set(renamed);
    component.submitForm();

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/planets/4'));
    expect(put.request.body).toEqual({ name: renamed, description: null });
    put.flush({
      id: 4,
      name: renamed,
      description: null,
      planetSystemId: 3,
      planetSystemName: systemName,
      locations: [],
    });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [{ id: 3, name: systemName, coordinates: null, description: null, subregions: [] }],
      planets: {
        3: [
          {
            id: 4,
            name: renamed,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [],
          },
        ],
      },
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
  });

  it('replaces a planet location when editing it', () => {
    const systemName = 'Ryloth system';
    const planetName = 'Ryloth';
    const locationName = 'Lessu';
    const renamed = 'Lessu City';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [{ id: 3, name: systemName, coordinates: null, description: null, subregions: [] }],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [{ id: 5, name: locationName }],
          },
        ],
      },
    });

    component.startEditLocation({ id: 5, name: locationName }, 4);
    expect(component.formState()?.kind).toBe('planet-location');
    component.formName.set(renamed);
    component.submitForm();

    const put = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url.endsWith('/api/planet-locations/5'),
    );
    expect(put.request.body).toEqual({
      name: renamed,
      type: 1,
      coordinates: null,
      description: null,
    });
    put.flush({
      id: 5,
      name: renamed,
      type: 1,
      coordinates: null,
      description: null,
      planetId: 4,
      planetName,
    });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [{ id: 3, name: systemName, coordinates: null, description: null, subregions: [] }],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [{ id: 5, name: renamed }],
          },
        ],
      },
    });
    fixture.detectChanges();

    expect(component.formState()).toBeNull();
  });

  it('deletes a planet location after inline confirmation', () => {
    const systemName = 'Ryloth system';
    const planetName = 'Ryloth';
    const locationName = 'Lessu';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [{ id: 3, name: systemName, coordinates: null, description: null, subregions: [] }],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [{ id: 5, name: locationName }],
          },
        ],
      },
    });

    component.requestDelete('planet-location', 5, locationName);
    fixture.detectChanges();
    component.confirmDelete();
    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/planet-locations/5'))
      .flush(null, { status: 204, statusText: 'No Content' });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [{ id: 3, name: systemName, coordinates: null, description: null, subregions: [] }],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: systemName,
            locations: [],
          },
        ],
      },
    });
    fixture.detectChanges();

    expect(component.deleteTarget()).toBeNull();
  });

  it('deletes a subregion after inline confirmation', () => {
    const subregionName = 'Ryloth Sector';
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
      systems: [],
    });

    component.requestDelete('subregion', 2, subregionName);
    fixture.detectChanges();
    expect(component.deleteTarget()?.kind).toBe('subregion');
    expect(fixture.nativeElement.textContent).toContain(`Delete \u201C${subregionName}\u201D`);

    component.confirmDelete();
    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith(`${SUBREGIONS_URL}/2`))
      .flush(null, { status: 204, statusText: 'No Content' });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      systems: [],
    });
    fixture.detectChanges();

    expect(component.deleteTarget()).toBeNull();
    expect(rowNames()).not.toContain(subregionName);
  });

  it('deletes a planet after inline confirmation', () => {
    const planetName = 'Ryloth';
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [
        {
          id: 3,
          name: 'Ryloth system',
          coordinates: null,
          description: null,
          subregions: [],
        },
      ],
      planets: {
        3: [
          {
            id: 4,
            name: planetName,
            description: null,
            planetSystemId: 3,
            planetSystemName: 'Ryloth system',
            locations: [],
          },
        ],
      },
    });

    component.requestDelete('planet', 4, planetName);
    fixture.detectChanges();
    component.confirmDelete();
    httpMock
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/planets/4'))
      .flush(null, { status: 204, statusText: 'No Content' });

    drainGalaxyRequests(httpMock, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [
        {
          id: 3,
          name: 'Ryloth system',
          coordinates: null,
          description: null,
          subregions: [],
        },
      ],
      planets: { 3: [] },
    });
    fixture.detectChanges();

    expect(component.deleteTarget()).toBeNull();
    expect(rowNames()).not.toContain(planetName);
  });

  it('cancels the inline form and the delete prompt', () => {
    component.openAddRegion();
    component.formName.set('Temporary');
    component.cancelForm();
    expect(component.formState()).toBeNull();

    component.requestDelete('region', 1, 'Outer Rim');
    component.cancelDelete();
    expect(component.deleteTarget()).toBeNull();
  });

  it('hides admin actions for non-admin users', () => {
    fixture.componentRef.setInput('isAdmin', false);
    fixture.detectChanges();
    seedGalaxy(galaxyService, httpMock, fixture, {
      regions: [{ id: 1, name: 'Outer Rim', description: null, subregions: [] }],
      subregions: [],
      systems: [],
    });

    expect(fixture.nativeElement.querySelector('.catalog-add-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.galaxy-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.galaxy-add-row')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Outer Rim');
  });
});
