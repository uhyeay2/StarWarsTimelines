import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { CatalogEvent } from '../../../catalog/services/catalog-event.service';
import { TimelineEvent } from '../../models/timeline-event';
import { CatalogEventService } from '../../../catalog/services/catalog-event.service';
import { CharacterService } from '../../../catalog/services/character.service';
import { GalaxyService } from '../../../catalog/services/galaxy.service';
import { VehicleService } from '../../../catalog/services/vehicle.service';
import { SourceMaterialService } from '../../../catalog/services/source-material.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { Timeline } from './timeline';

const FIXTURE_EVENTS: readonly TimelineEvent[] = [
  {
    id: 1,
    canon: ['Canon'],
    title: 'Canon Only',
    description: '',
    sources: [{ title: 'Source A', medium: 'Movie', canon: ['Canon'], sourceId: 10 }],
    locations: ['Naboo'],
    locationRefs: [],
    characters: ['Padme Amidala'],
    vehicles: [],
    yearStart: 1,
    yearEnd: 1,
    sequence: 1,
  },
  {
    id: 2,
    canon: ['Legends'],
    title: 'Legends Only',
    description: '',
    sources: [{ title: 'Source B', medium: 'Book', canon: ['Legends'], sourceId: 20 }],
    locations: ['Coruscant'],
    locationRefs: [],
    characters: ['Darth Maul'],
    vehicles: ['Sith Infiltrator'],
    yearStart: 2,
    yearEnd: 2,
    sequence: 1,
  },
  {
    id: 3,
    canon: ['Canon', 'Legends'],
    title: 'Both',
    description: '',
    sources: [{ title: 'Source C', medium: 'Movie', canon: ['Canon', 'Legends'], sourceId: 30 }],
    locations: ['Naboo', 'Coruscant'],
    locationRefs: [],
    characters: ['Padme Amidala', 'Darth Maul'],
    vehicles: ['Sith Infiltrator'],
    yearStart: 0,
    yearEnd: 0,
    sequence: 1,
  },
];

describe('Timeline', () => {
  let component: Timeline;
  let fixture: ComponentFixture<Timeline>;
  let routeQueryParams: BehaviorSubject<ParamMap>;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let catalogEvents$: Subject<CatalogEvent>;

  function characterServiceMock(overrides?: { characters?: { id: number; name: string }[] }) {
    return {
      fetchCharacters: vi.fn(),
      characters: signal(overrides?.characters ?? null),
    };
  }

  function galaxyServiceMock(overrides?: {
    regions?: { id: number; name: string; subregions?: { id: number; name: string }[] }[];
    subregions?: {
      id: number;
      name: string;
      regions?: { id: number; name: string }[];
      planetSystems?: { id: number; name: string }[];
    }[];
    planetSystems?: { id: number; name: string; subregions?: { id: number; name: string }[] }[];
    planets?: {
      id: number;
      name: string;
      planetSystemId: number;
      locations?: { id: number; name: string }[];
    }[];
    planetLocations?: { id: number; name: string; planetId: number; planetName: string }[];
  }) {
    return {
      fetchAll: vi.fn(),
      regions: signal(overrides?.regions ?? null),
      subregions: signal(overrides?.subregions ?? null),
      planetSystems: signal(overrides?.planetSystems ?? null),
      planets: signal(overrides?.planets ?? null),
      planetLocations: signal(overrides?.planetLocations ?? []),
    };
  }

  function vehicleServiceMock(overrides?: { vehicles?: { id: number; name: string }[] }) {
    return {
      fetchVehicles: vi.fn(),
      vehicles: signal(overrides?.vehicles ?? null),
    };
  }

  function sourceMaterialServiceMock(overrides?: {
    units?: { id: number; title?: string; unitType: string; number: number }[];
  }) {
    return {
      getUnitCache: vi.fn(() => ({
        data: () => overrides?.units ?? [],
        loading: () => false,
        fetch: vi.fn(),
      })),
    };
  }

  function catalogProviders(overrides?: {
    characters?: { id: number; name: string }[];
    locations?: { id: number; name: string }[];
    vehicles?: { id: number; name: string }[];
    units?: { id: number; title?: string; unitType: string; number: number }[];
    galaxy?: {
      regions?: { id: number; name: string; subregions?: { id: number; name: string }[] }[];
      subregions?: {
        id: number;
        name: string;
        regions?: { id: number; name: string }[];
        planetSystems?: { id: number; name: string }[];
      }[];
      planetSystems?: { id: number; name: string; subregions?: { id: number; name: string }[] }[];
      planets?: {
        id: number;
        name: string;
        planetSystemId: number;
        locations?: { id: number; name: string }[];
      }[];
    };
  }) {
    const galaxy =
      overrides?.galaxy ??
      (overrides?.locations !== undefined
        ? {
            planetLocations: overrides.locations.map((location) => ({
              ...location,
              planetId: 0,
              planetName: '',
            })),
          }
        : {});
    return [
      {
        provide: CharacterService,
        useValue: characterServiceMock(
          overrides?.characters !== undefined ? { characters: overrides.characters } : {},
        ),
      },
      {
        provide: GalaxyService,
        useValue: galaxyServiceMock(galaxy),
      },
      {
        provide: VehicleService,
        useValue: vehicleServiceMock(
          overrides?.vehicles !== undefined ? { vehicles: overrides.vehicles } : {},
        ),
      },
      {
        provide: SourceMaterialService,
        useValue: sourceMaterialServiceMock(
          overrides?.units !== undefined ? { units: overrides.units } : {},
        ),
      },
    ];
  }

  function catalogEventMock() {
    catalogEvents$ = new Subject<CatalogEvent>();
    return { events$: catalogEvents$.asObservable(), connected: signal(false) };
  }

  function eventsServiceMock(
    events: readonly TimelineEvent[] = FIXTURE_EVENTS,
    overrides?: Record<string, unknown>,
  ) {
    return {
      getEvents$: () => of(events),
      loading: signal(false),
      error: signal(null),
      events: signal(events),
      getEvents: vi.fn(),
      invalidate: vi.fn(),
      ...overrides,
    };
  }

  function setupTimeline(providers: unknown[]): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Timeline],
      providers: [provideHttpClient(), provideHttpClientTesting(), ...providers],
    });
    return TestBed.compileComponents();
  }

  beforeEach(async () => {
    routeQueryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    routerMock = { navigate: vi.fn() };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },
      ...catalogProviders({
        characters: [
          { id: 7, name: 'Padme Amidala' },
          { id: 8, name: 'Darth Maul' },
        ],
        galaxy: {
          regions: [{ id: 1, name: 'Inner Rim', subregions: [{ id: 2, name: 'Core Sector' }] }],
          subregions: [
            {
              id: 2,
              name: 'Core Sector',
              regions: [{ id: 1, name: 'Inner Rim' }],
              planetSystems: [{ id: 3, name: 'Gallant System' }],
            },
          ],
          planetSystems: [
            { id: 3, name: 'Gallant System', subregions: [{ id: 2, name: 'Core Sector' }] },
          ],
          planets: [
            {
              id: 11,
              name: 'Naboo',
              planetSystemId: 3,
              locations: [{ id: 21, name: 'Theed' }],
            },
            {
              id: 12,
              name: 'Coruscant',
              planetSystemId: 3,
              locations: [{ id: 22, name: 'Galactic City' }],
            },
          ],
        },
        vehicles: [{ id: 13, name: 'Sith Infiltrator' }],
      }),
      { provide: CatalogEventService, useValue: catalogEventMock() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
      { provide: Router, useValue: routerMock },
    ]);

    fixture = TestBed.createComponent(Timeline);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const eventTitles = (): (string | null | undefined)[] =>
    [...fixture.nativeElement.querySelectorAll('.event-title')].map(
      (el) => (el as HTMLElement).textContent,
    );

  const cardFor = (title: string): HTMLElement => {
    const cards = [...fixture.nativeElement.querySelectorAll('app-timeline-event-item')];
    return cards.find((el) => (el as HTMLElement).textContent?.includes(title)) as HTMLElement;
  };

  const openDetails = (title: string): void => {
    const cards = [...fixture.nativeElement.querySelectorAll('app-timeline-event-item')];
    const card = cards.find((el) =>
      (el as HTMLElement).textContent?.includes(title),
    ) as HTMLElement;
    (card.querySelector('.details-toggle') as HTMLElement).click();
    fixture.detectChanges();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only canon events by default, sorted chronologically', () => {
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('shows only events from the given source ids', () => {
    fixture.componentRef.setInput('sourceIds', [10]);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Canon Only']);
  });

  it('shows all events when sourceIds is null', () => {
    fixture.componentRef.setInput('sourceIds', null);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('filters sources by season for unit-linked events', async () => {
    const seasonEvents: readonly TimelineEvent[] = [
      {
        id: 4,
        canon: ['Canon'],
        title: 'Heroes on Both Sides',
        description: '',
        sources: [
          {
            title: 'The Clone Wars',
            medium: 'Animated Show',
            canon: ['Canon'],
            sourceId: 50,
            unit: { unitType: 'Episode', parentUnitId: 102, number: 3 },
          },
        ],
        locations: [],
        locationRefs: [],
        characters: [],
        vehicles: [],
        yearStart: -21,
        yearEnd: -21,
        sequence: 1,
      },
      {
        id: 5,
        canon: ['Canon'],
        title: 'The Siege of Mandalore',
        description: '',
        sources: [
          {
            title: 'The Clone Wars',
            medium: 'Animated Show',
            canon: ['Canon'],
            sourceId: 50,
            unit: { unitType: 'Episode', parentUnitId: 107, number: 9 },
          },
        ],
        locations: [],
        locationRefs: [],
        characters: [],
        vehicles: [],
        yearStart: -19,
        yearEnd: -19,
        sequence: 1,
      },
    ];
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock(seasonEvents) },
      ...catalogProviders(),
      { provide: CatalogEventService, useValue: catalogEventMock() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
      { provide: Router, useValue: routerMock },
    ]);

    fixture = TestBed.createComponent(Timeline);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.updateFilter('sources', ['50:107']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['The Siege of Mandalore']);

    component.updateFilter('sources', ['50']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual([]);

    component.clearFilters();
    component.toggleAdvanced();
    fixture.detectChanges();
    const groups = [...fixture.nativeElement.querySelectorAll('app-filter-group')] as HTMLElement[];
    expect(groups.length).toBe(1);
    const sourceGroup = groups[0]!;
    (sourceGroup.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    const labels = [...sourceGroup.querySelectorAll('.filter-option-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['Animated Show']);
    const expanders = [...sourceGroup.querySelectorAll('.filter-option-expand')];
    (expanders[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(
      [...sourceGroup.querySelectorAll('.filter-option-label')].map((el) => el.textContent),
    ).toEqual(['Animated Show', 'The Clone Wars']);
  });

  it('renders the heading and description inputs', () => {
    fixture.componentRef.setInput('heading', 'Known Timeline');
    fixture.componentRef.setInput('description', 'My watched events.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Known Timeline');
    expect(fixture.nativeElement.textContent).toContain('My watched events.');
  });

  it('applies the canon view from the view query param', () => {
    routeQueryParams.next(convertToParamMap({ view: 'Legends' }));
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Legends Only']);
  });

  it('updates the view query param when the canon filter changes', () => {
    fixture.detectChanges();
    component.selectView('Legends');
    expect(routerMock.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { view: 'Legends' } }),
    );

    component.selectView('Canon & Legends');
    expect(routerMock.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { view: 'Canon & Legends' } }),
    );
  });

  it('shows only legends events when the Legends view is selected', () => {
    component.selectView('Legends');
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Legends Only']);
  });

  it('shows only events that apply to both timelines in the combined view', () => {
    component.selectView('Canon & Legends');
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both']);
  });

  it('filters by multiple selected characters using AND semantics', () => {
    component.updateFilter('characters', ['Padme Amidala', 'Darth Maul']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both']);
  });

  it('adds a value to a facet filter by clicking a chip on an event', () => {
    fixture.detectChanges();
    openDetails('Both');
    const darthMaul = [...fixture.nativeElement.querySelectorAll('button.chip')].find(
      (chip) => chip.textContent?.trim() === 'Darth Maul',
    ) as HTMLElement;
    darthMaul.click();
    fixture.detectChanges();
    expect(component.filters().characters).toEqual(['Darth Maul']);
    expect(eventTitles()).toEqual(['Both']);
  });

  it('removes a value from a facet filter by clicking its selected chip again', () => {
    fixture.detectChanges();
    openDetails('Both');
    const firstClick = [...fixture.nativeElement.querySelectorAll('button.chip')].find(
      (chip) => chip.textContent?.trim() === 'Darth Maul',
    ) as HTMLElement;
    firstClick.click();
    fixture.detectChanges();

    const secondClick = [...fixture.nativeElement.querySelectorAll('button.chip')].find(
      (chip) => chip.textContent?.trim() === 'Darth Maul',
    ) as HTMLElement;
    secondClick.click();
    fixture.detectChanges();

    expect(component.filters().characters).toEqual([]);
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('selects every source under a medium by clicking the medium chip', () => {
    fixture.detectChanges();
    const medium = cardFor('Both').querySelector('.source-chip--medium') as HTMLElement;
    medium.click();
    fixture.detectChanges();
    expect(component.filters().sources).toEqual(['10', '30']);
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('adds a source filter by clicking the source chip on an event', () => {
    fixture.detectChanges();
    const source = [...cardFor('Canon Only').querySelectorAll('.source-chip--source')].find(
      (chip) => chip.textContent?.trim() === 'Source A',
    ) as HTMLElement;
    source.click();
    fixture.detectChanges();
    expect(component.filters().sources).toEqual(['10']);
    expect(eventTitles()).toEqual(['Canon Only']);
  });

  it('removes a source filter by clicking its selected source chip again', () => {
    const sourceA = () =>
      [...cardFor('Canon Only').querySelectorAll('.source-chip--source')].find(
        (chip) => chip.textContent?.trim() === 'Source A',
      ) as HTMLElement;
    fixture.detectChanges();
    sourceA().click();
    fixture.detectChanges();
    sourceA().click();
    fixture.detectChanges();
    expect(component.filters().sources).toEqual([]);
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('highlights the medium chip once all its sources are part of the filter', () => {
    component.updateFilter('sources', ['10', '30']);
    fixture.detectChanges();
    const medium = cardFor('Both').querySelector('.source-chip--medium') as HTMLElement;
    expect(medium.classList.contains('chip--selected')).toBe(true);
    expect(medium.getAttribute('aria-pressed')).toBe('true');
  });

  it('highlights the source chip once its source is part of the filter', () => {
    component.updateFilter('sources', ['30']);
    fixture.detectChanges();
    const title = [...cardFor('Both').querySelectorAll('.source-chip--source')].find(
      (chip) => chip.textContent?.trim() === 'Source C',
    ) as HTMLElement;
    expect(title.classList.contains('chip--selected')).toBe(true);
    expect(title.getAttribute('aria-pressed')).toBe('true');
  });

  it('highlights a chip on an event once its value is part of the filter', () => {
    component.updateFilter('locations', ['Naboo']);
    fixture.detectChanges();
    openDetails('Both');
    const naboo = [...fixture.nativeElement.querySelectorAll('button.chip')].find(
      (chip) => chip.textContent?.trim() === 'Naboo',
    ) as HTMLElement;
    expect(naboo.classList.contains('chip--selected')).toBe(true);
  });

  it('filters by any selected location using OR semantics', () => {
    component.updateFilter('locations', ['Naboo', 'Coruscant']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('filters to events from any source under a medium', () => {
    component.updateFilter('sources', ['10', '30']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('combines filters across categories', () => {
    component.updateFilter('sources', ['10', '30']);
    component.updateFilter('characters', ['Darth Maul']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both']);
  });

  it('clearFilters resets facet selections while keeping the canon view', () => {
    component.selectView('Legends');
    component.updateFilter('characters', ['Anakin Skywalker']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual([]);

    component.clearFilters();
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Legends Only']);
  });

  it('shows an empty state when nothing matches', () => {
    component.updateFilter('vehicles', ['Death Star']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No events match your filters.');
  });

  it('hides advanced filters by default and reveals them on toggle', () => {
    fixture.detectChanges();
    const advancedFilters = fixture.nativeElement.querySelector('.advanced-filters') as HTMLElement;
    expect(advancedFilters.hasAttribute('hidden')).toBe(true);

    component.toggleAdvanced();
    fixture.detectChanges();
    expect(advancedFilters.hasAttribute('hidden')).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('app-filter-group').length).toBe(4);
  });

  it('retains the source tree expansion when the advanced filters are hidden and reopened', () => {
    const sourceGroup = (): HTMLElement =>
      (
        [...fixture.nativeElement.querySelectorAll('.filter-group-trigger')].find((trigger) =>
          trigger.textContent?.includes('Source'),
        ) as HTMLElement
      ).closest('.filter-group') as HTMLElement;
    const sourceLabels = (): string[] =>
      [...sourceGroup().querySelectorAll('.filter-option-label')].map(
        (el) => (el as HTMLElement).textContent ?? '',
      );
    const sourceExpanders = (): HTMLElement[] => [
      ...sourceGroup().querySelectorAll<HTMLElement>('.filter-option-expand'),
    ];

    component.selectView('Legends');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.advanced-toggle') as HTMLElement).click();
    fixture.detectChanges();
    (sourceGroup().querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    expect(sourceLabels()).toEqual(['Movie', 'Book']);

    sourceExpanders()[0]!.click();
    fixture.detectChanges();
    expect(sourceLabels()).toEqual(['Movie', 'Source C', 'Book']);

    (fixture.nativeElement.querySelector('.advanced-toggle') as HTMLElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.advanced-toggle') as HTMLElement).click();
    fixture.detectChanges();
    expect(sourceLabels()).toEqual(['Movie', 'Source C', 'Book']);
  });

  it('shows the active facet count on the advanced toggle', () => {
    component.updateFilter('characters', ['Padme Amidala']);
    component.updateFilter('locations', ['Naboo']);
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('.advanced-toggle-count');
    expect(count?.textContent?.trim()).toBe('2');
  });

  it('Clear all clears facet selections and hides the Clear all button', () => {
    component.updateFilter('characters', ['Padme Amidala']);
    fixture.detectChanges();
    const clearAll = fixture.nativeElement.querySelector('.clear-button') as HTMLElement;
    expect(clearAll).toBeTruthy();

    clearAll.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.clear-button')).toBeNull();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('shows catalog characters in the filter even if not in any events', async () => {
    const characterSvc = characterServiceMock({
      characters: [
        { id: 7, name: 'Padme Amidala' },
        { id: 8, name: 'Darth Maul' },
        { id: 9, name: 'Yoda' },
      ],
    });
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },
      { provide: CharacterService, useValue: characterSvc },
      { provide: GalaxyService, useValue: galaxyServiceMock() },
      { provide: VehicleService, useValue: vehicleServiceMock() },
      { provide: SourceMaterialService, useValue: sourceMaterialServiceMock() },
      { provide: CatalogEventService, useValue: catalogEventMock() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
      { provide: Router, useValue: routerMock },
    ]);

    fixture = TestBed.createComponent(Timeline);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.toggleAdvanced();
    fixture.detectChanges();
    const groups = [...fixture.nativeElement.querySelectorAll('app-filter-group')] as HTMLElement[];
    const characterGroup = groups.find((g) => g.textContent?.includes('Characters'))!;
    (characterGroup.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    const labels = [...characterGroup.querySelectorAll('.filter-option-label')].map((el) =>
      el.textContent?.trim(),
    );
    expect(labels).toContain('Yoda');
    expect(characterSvc.fetchCharacters).toHaveBeenCalled();
  });

  it('shows catalog locations in the filter even if not in any events', async () => {
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },
      ...catalogProviders({
        galaxy: {
          regions: [{ id: 1, name: 'Outer Rim' }],
          subregions: [
            {
              id: 2,
              name: 'Arkanis Sector',
              regions: [{ id: 1, name: 'Outer Rim' }],
              planetSystems: [{ id: 3, name: 'Tatoo' }],
            },
          ],
          planetSystems: [
            { id: 3, name: 'Tatoo', subregions: [{ id: 2, name: 'Arkanis Sector' }] },
          ],
          planets: [
            {
              id: 4,
              name: 'Tatooine',
              planetSystemId: 3,
              locations: [{ id: 5, name: 'Mos Eisley' }],
            },
          ],
        },
      }),
      { provide: CatalogEventService, useValue: catalogEventMock() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
      { provide: Router, useValue: routerMock },
    ]);

    fixture = TestBed.createComponent(Timeline);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.toggleAdvanced();
    fixture.detectChanges();
    const groups = [...fixture.nativeElement.querySelectorAll('app-filter-group')] as HTMLElement[];
    const locationGroup = groups.find((g) => g.textContent?.includes('Location'))!;
    (locationGroup.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    const labels = (): string[] =>
      [...locationGroup.querySelectorAll('.filter-option-label')].map(
        (el) => el.textContent?.trim() ?? '',
      );
    expect(labels()).toContain('Outer Rim');
    expect(labels()).not.toContain('Tatooine');

    (locationGroup.querySelector('.filter-option-expand') as HTMLElement).click();
    fixture.detectChanges();
    (locationGroup.querySelectorAll('.filter-option-expand')[1] as HTMLElement).click();
    fixture.detectChanges();
    (locationGroup.querySelectorAll('.filter-option-expand')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(labels()).toContain('Tatooine');

    (locationGroup.querySelectorAll('.filter-option-expand')[3] as HTMLElement).click();
    fixture.detectChanges();
    expect(labels()).toContain('Mos Eisley');
  });

  it('selecting a catalog character not in any events yields zero results', async () => {
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },
      ...catalogProviders({
        characters: [
          { id: 7, name: 'Padme Amidala' },
          { id: 8, name: 'Darth Maul' },
          { id: 9, name: 'Yoda' },
        ],
      }),
      { provide: CatalogEventService, useValue: catalogEventMock() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
      { provide: Router, useValue: routerMock },
    ]);

    fixture = TestBed.createComponent(Timeline);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.updateFilter('characters', ['Yoda']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual([]);
  });

  it('refreshes events when a source-material SSE event arrives', async () => {
    const eventsSig = signal<readonly TimelineEvent[]>(FIXTURE_EVENTS);
    const newEvent: TimelineEvent = {
      id: 6,
      canon: ['Canon'],
      title: 'New Event',
      description: '',
      sources: [{ title: 'Source D', medium: 'Book', canon: ['Canon'], sourceId: 40 }],
      locations: [],
      locationRefs: [],
      characters: [],
      vehicles: [],
      yearStart: 3,
      yearEnd: 3,
      sequence: 1,
    };
    const invalidateMock = vi.fn(() => {
      eventsSig.set([...FIXTURE_EVENTS, newEvent]);
    });
    await setupTimeline([
      {
        provide: TimelineEventsService,
        useValue: eventsServiceMock(FIXTURE_EVENTS, {
          events: eventsSig,
          invalidate: invalidateMock,
        }),
      },

      ...catalogProviders(),
      { provide: CatalogEventService, useValue: catalogEventMock() },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
      { provide: Router, useValue: routerMock },
    ]);

    fixture = TestBed.createComponent(Timeline);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(eventTitles()).toEqual(['Both', 'Canon Only']);

    catalogEvents$.next({ entity: 'source-materials' } as CatalogEvent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(invalidateMock).toHaveBeenCalled();
    expect(eventTitles()).toContain('New Event');
  });

  describe('sourceFilteredEvents', () => {
    it('returns all events when sourceIds is null', () => {
      fixture.componentRef.setInput('sourceIds', null);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);
    });

    it('returns no events when sourceIds is empty', () => {
      fixture.componentRef.setInput('sourceIds', []);
      fixture.detectChanges();
      expect(eventTitles()).toEqual([]);
    });

    it('filters events to only those with matching source IDs', () => {
      component.selectView('Legends');
      fixture.componentRef.setInput('sourceIds', [20]);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Legends Only']);
    });

    it('excludes events with undefined sourceId', async () => {
      const eventNoId: TimelineEvent = {
        id: 7,
        canon: ['Canon'],
        title: 'No Source ID',
        description: '',
        sources: [{ title: 'Unknown', medium: 'Book', canon: ['Canon'] }],
        locations: [],
        locationRefs: [],
        characters: [],
        vehicles: [],
        yearStart: 5,
        yearEnd: 5,
        sequence: 1,
      };
      await setupTimeline([
        {
          provide: TimelineEventsService,
          useValue: eventsServiceMock([...FIXTURE_EVENTS, eventNoId]),
        },

        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);

      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentRef.setInput('sourceIds', [7]);
      fixture.detectChanges();
      expect(eventTitles()).toEqual([]);
    });

    it('hides unit-pinned events outside the tracked unit scope', async () => {
      const seasonEvents: readonly TimelineEvent[] = [
        {
          id: 8,
          canon: ['Canon'],
          title: 'Season One Event',
          description: '',
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show',
              canon: ['Canon'],
              sourceId: 50,
              unit: { id: 101, unitType: 'Season', number: 1 },
            },
          ],
          locations: [],
          locationRefs: [],
          characters: [],
          vehicles: [],
          yearStart: -22,
          yearEnd: -22,
          sequence: 1,
        },
        {
          id: 9,
          canon: ['Canon'],
          title: 'Season Seven Event',
          description: '',
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show',
              canon: ['Canon'],
              sourceId: 50,
              unit: { id: 107, unitType: 'Season', number: 7 },
            },
          ],
          locations: [],
          locationRefs: [],
          characters: [],
          vehicles: [],
          yearStart: -19,
          yearEnd: -19,
          sequence: 1,
        },
        {
          id: 10,
          canon: ['Canon'],
          title: 'Whole Show Event',
          description: '',
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show',
              canon: ['Canon'],
              sourceId: 50,
            },
          ],
          locations: [],
          locationRefs: [],
          characters: [],
          vehicles: [],
          yearStart: -21,
          yearEnd: -21,
          sequence: 1,
        },
      ];
      await setupTimeline([
        { provide: TimelineEventsService, useValue: eventsServiceMock(seasonEvents) },
        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);

      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput('sourceIds', [50]);
      fixture.componentRef.setInput('trackedUnitScope', new Map([[50, new Set([101])]]));
      fixture.detectChanges();

      // Only the tracked season (and unpinned depictions of the show) is known.
      expect(eventTitles()).toEqual(['Season One Event', 'Whole Show Event']);
    });

    it('shows every pinned event when the material tracks at the material level', async () => {
      const bookEvents: readonly TimelineEvent[] = [
        {
          id: 11,
          canon: ['Canon'],
          title: 'Chapter Pinned Event',
          description: '',
          sources: [
            {
              title: 'A Novel',
              medium: 'Book',
              canon: ['Canon'],
              sourceId: 60,
              unit: { id: 501, unitType: 'Chapter', number: 3 },
            },
          ],
          locations: [],
          locationRefs: [],
          characters: [],
          vehicles: [],
          yearStart: -2,
          yearEnd: -2,
          sequence: 1,
        },
      ];
      await setupTimeline([
        { provide: TimelineEventsService, useValue: eventsServiceMock(bookEvents) },
        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);

      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput('sourceIds', [60]);
      fixture.componentRef.setInput('trackedUnitScope', new Map([[60, 'all']]));
      fixture.detectChanges();

      expect(eventTitles()).toEqual(['Chapter Pinned Event']);
    });
  });

  describe('continuityEvents', () => {
    it('filters by Canon view (default)', () => {
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);
    });

    it('filters by Legends view', () => {
      component.selectView('Legends');
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Legends Only']);
    });

    it('filters by Canon & Legends view (only shared events)', () => {
      component.selectView('Canon & Legends');
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both']);
    });
  });

  describe('filteredEvents', () => {
    it('sorts events chronologically by year', () => {
      fixture.detectChanges();
      const titles = eventTitles();
      expect(titles).toEqual(['Both', 'Canon Only']);
    });

    it('breaks year ties using the event sequence, then title', async () => {
      const tiedEvents: readonly TimelineEvent[] = [
        {
          ...FIXTURE_EVENTS[0]!,
          id: 12,
          title: 'Beta Event',
          sources: [{ title: 'Source A', medium: 'Movie', canon: ['Canon'], sourceId: 10 }],
          yearStart: 0,
          yearEnd: 0,
          sequence: 5,
        },
        {
          ...FIXTURE_EVENTS[0]!,
          id: 13,
          title: 'Alpha Event',
          sources: [{ title: 'Source A', medium: 'Movie', canon: ['Canon'], sourceId: 10 }],
          yearStart: 0,
          yearEnd: 0,
          sequence: 2,
        },
        {
          ...FIXTURE_EVENTS[0]!,
          id: 14,
          title: 'Alpha Event',
          sources: [{ title: 'Source A', medium: 'Movie', canon: ['Canon'], sourceId: 10 }],
          yearStart: 0,
          yearEnd: 0,
          sequence: 1,
        },
        {
          ...FIXTURE_EVENTS[0]!,
          id: 15,
          title: 'Gamma Event',
          sources: [{ title: 'Source A', medium: 'Movie', canon: ['Canon'], sourceId: 10 }],
          yearStart: 0,
          yearEnd: 1,
          sequence: 1,
        },
      ];
      await setupTimeline([
        { provide: TimelineEventsService, useValue: eventsServiceMock(tiedEvents) },
        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);
      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Sequence orders within the exact-year span (0..0): the two
      // sequence-1 events tie on (year, sequence) and fall back to title
      // comparison, placing 'Alpha Event' before 'Gamma Event'; the
      // spanning event (0..1) shares start year 0 and sequence 1, so its
      // position also comes down to its title.
      expect(eventTitles()).toEqual(['Alpha Event', 'Gamma Event', 'Alpha Event', 'Beta Event']);
    });

    it('matches a multi-source event when any of its sources is selected', async () => {
      const dualEvent: TimelineEvent = {
        ...FIXTURE_EVENTS[0]!,
        id: 16,
        title: 'Dual Source',
        sources: [
          { title: 'Source A', medium: 'Movie', canon: ['Canon'], sourceId: 10 },
          { title: 'Source B', medium: 'Book', canon: ['Legends'], sourceId: 20 },
        ],
        canon: ['Canon', 'Legends'],
      };
      await setupTimeline([
        {
          provide: TimelineEventsService,
          useValue: eventsServiceMock([...FIXTURE_EVENTS, dualEvent]),
        },
        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);
      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      await fixture.whenStable();
      fixture.componentRef.setInput('sourceIds', [20]);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Dual Source']);
    });

    it('applies character AND semantics', () => {
      component.updateFilter('characters', ['Padme Amidala']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);

      component.updateFilter('characters', ['Padme Amidala', 'Darth Maul']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both']);
    });

    it('applies location OR semantics', () => {
      component.updateFilter('locations', ['Naboo']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);

      component.updateFilter('locations', ['Naboo', 'Coruscant']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);
    });

    it('applies vehicle AND semantics', () => {
      component.selectView('Legends');
      component.updateFilter('vehicles', ['Sith Infiltrator']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Legends Only']);
    });

    it('combines canon view with facet filters', () => {
      component.selectView('Legends');
      component.updateFilter('characters', ['Darth Maul']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Legends Only']);

      component.updateFilter('characters', ['Padme Amidala', 'Darth Maul']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both']);
    });

    it('returns empty when filters exclude all events', () => {
      component.updateFilter('characters', ['Nonexistent Character']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual([]);
      expect(fixture.nativeElement.textContent).toContain('No events match your filters.');
    });
  });

  describe('loading and error states', () => {
    it('shows skeleton loading when events are loading initially', async () => {
      await setupTimeline([
        {
          provide: TimelineEventsService,
          useValue: eventsServiceMock([], { loading: signal(true), events: signal([]) }),
        },

        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);

      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const skeleton = fixture.nativeElement.querySelector('.skeleton-list');
      expect(skeleton).toBeTruthy();
      expect(skeleton.querySelectorAll('.skeleton-item').length).toBe(5);
    });

    it('shows error state when events fail to load', async () => {
      await setupTimeline([
        {
          provide: TimelineEventsService,
          useValue: eventsServiceMock([], {
            events: signal(null),
            error: signal('Failed to load timeline events'),
          }),
        },

        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);

      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Unable to load timeline events');
      expect(errorState.textContent).toContain('Failed to load timeline events');
      expect(errorState.querySelector('.error-state-retry')).toBeTruthy();
    });
  });

  describe('retryLoad', () => {
    it('retriggers event loading via invalidate', async () => {
      const invalidateMock = vi.fn();
      await setupTimeline([
        {
          provide: TimelineEventsService,
          useValue: eventsServiceMock(FIXTURE_EVENTS, { invalidate: invalidateMock }),
        },

        ...catalogProviders(),
        { provide: CatalogEventService, useValue: catalogEventMock() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
        { provide: Router, useValue: routerMock },
      ]);

      fixture = TestBed.createComponent(Timeline);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      component.retryLoad();
      expect(invalidateMock).toHaveBeenCalled();
    });
  });
});
