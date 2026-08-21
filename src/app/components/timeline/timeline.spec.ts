import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { CatalogEvent } from '../../services/catalog-event.service';
import { TimelineEvent } from '../../models/timeline-event';
import { CatalogEventService } from '../../services/catalog-event.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { TimelineEventsService } from '../../services/timeline-events/timeline-events.service';
import { Timeline } from './timeline';

const FIXTURE_EVENTS: readonly TimelineEvent[] = [
  {
    id: 'canon-event',
    canon: ['Canon'],
    title: 'Canon Only',
    description: '',
    source: { title: 'Source A', medium: 'Movie', sourceId: 'material-a' },
    locations: ['Naboo'],
    characters: ['Padme Amidala'],
    vehicles: [],
    year: 1,
    displayDate: '1 ABY',
  },
  {
    id: 'legends-event',
    canon: ['Legends'],
    title: 'Legends Only',
    description: '',
    source: { title: 'Source B', medium: 'Book', sourceId: 'material-b' },
    locations: ['Coruscant'],
    characters: ['Darth Maul'],
    vehicles: ['Sith Infiltrator'],
    year: 2,
    displayDate: '2 ABY',
  },
  {
    id: 'shared-event',
    canon: ['Canon', 'Legends'],
    title: 'Both',
    description: '',
    source: { title: 'Source C', medium: 'Movie', sourceId: 'material-c' },
    locations: ['Naboo', 'Coruscant'],
    characters: ['Padme Amidala', 'Darth Maul'],
    vehicles: ['Sith Infiltrator'],
    year: 0,
    displayDate: '0 BBY',
  },
];

describe('Timeline', () => {
  let component: Timeline;
  let fixture: ComponentFixture<Timeline>;
  let routeQueryParams: BehaviorSubject<ParamMap>;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let catalogEvents$: Subject<CatalogEvent>;

  function catalogMock(overrides?: {
    characters?: { id: string; name: string }[];
    locations?: { id: string; name: string }[];
    vehicles?: { id: string; name: string }[];
  }) {
    return {
      fetchCharacters: vi.fn(),
      fetchLocations: vi.fn(),
      fetchVehicles: vi.fn(),
      characters: signal(overrides?.characters ?? null),
      locations: signal(overrides?.locations ?? null),
      vehicles: signal(overrides?.vehicles ?? null),
    };
  }

  function catalogEventMock() {
    catalogEvents$ = new Subject<CatalogEvent>();
    return { events$: catalogEvents$.asObservable(), connected: signal(false) };
  }

  function eventsServiceMock(events: readonly TimelineEvent[] = FIXTURE_EVENTS, overrides?: Record<string, unknown>) {
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
      {
        provide: CatalogService,
        useValue: catalogMock({
          characters: [
            { id: 'c1', name: 'Padme Amidala' },
            { id: 'c2', name: 'Darth Maul' },
          ],
          locations: [
            { id: 'l1', name: 'Naboo' },
            { id: 'l2', name: 'Coruscant' },
          ],
          vehicles: [{ id: 'v1', name: 'Sith Infiltrator' }],
        }),
      },
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
    const card = cards.find(
      (el) => (el as HTMLElement).textContent?.includes(title),
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
    fixture.componentRef.setInput('sourceIds', ['material-a']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Canon Only']);
  });

  it('shows all events when no source ids are provided', () => {
    fixture.componentRef.setInput('sourceIds', null);
    fixture.componentRef.setInput('sourceIds', []);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('filters sources by season for unit-linked events', async () => {
    const seasonEvents: readonly TimelineEvent[] = [
      {
        id: 's2e3',
        canon: ['Canon'],
        title: 'Heroes on Both Sides',
        description: '',
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show',
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 2, number: 3 },
        },
        locations: [],
        characters: [],
        vehicles: [],
        year: -21,
        displayDate: '21 BBY',
      },
      {
        id: 's7e9',
        canon: ['Canon'],
        title: 'The Siege of Mandalore',
        description: '',
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show',
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
        },
        locations: [],
        characters: [],
        vehicles: [],
        year: -19,
        displayDate: '19 BBY',
      },
    ];
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock(seasonEvents) },
      { provide: CatalogService, useValue: catalogMock() },
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

    component.updateFilter('sources', ['material-tcw:7']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['The Siege of Mandalore']);

    component.updateFilter('sources', ['material-tcw']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual([]);

    component.clearFilters();
    component.toggleAdvanced();
    fixture.detectChanges();
    const groups = [...fixture.nativeElement.querySelectorAll('app-filter-group')] as HTMLElement[];
    expect(groups.length).toBe(1);
    const sourceGroup = groups[0];
    (sourceGroup.querySelector('.filter-group-trigger') as HTMLElement).click();
    fixture.detectChanges();
    const labels = [...sourceGroup.querySelectorAll('.filter-option-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['Animated Show']);
    const expanders = [...sourceGroup.querySelectorAll('.filter-option-expand')];
    (expanders[0] as HTMLElement).click();
    fixture.detectChanges();
    expect([...sourceGroup.querySelectorAll('.filter-option-label')].map((el) => el.textContent)).toEqual(
      ['Animated Show', 'The Clone Wars'],
    );
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
    expect(component.filters().sources).toEqual(['material-a', 'material-c']);
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('adds a source filter by clicking the source chip on an event', () => {
    fixture.detectChanges();
    const source = [...cardFor('Canon Only').querySelectorAll('.source-chip--source')].find(
      (chip) => chip.textContent?.trim() === 'Source A',
    ) as HTMLElement;
    source.click();
    fixture.detectChanges();
    expect(component.filters().sources).toEqual(['material-a']);
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
    component.updateFilter('sources', ['material-a', 'material-c']);
    fixture.detectChanges();
    const medium = cardFor('Both').querySelector('.source-chip--medium') as HTMLElement;
    expect(medium.classList.contains('chip--selected')).toBe(true);
    expect(medium.getAttribute('aria-pressed')).toBe('true');
  });

  it('highlights the source chip once its source is part of the filter', () => {
    component.updateFilter('sources', ['material-c']);
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

  it('filters by multiple selected locations using AND semantics', () => {
    component.updateFilter('locations', ['Naboo', 'Coruscant']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both']);
  });

  it('filters to events from any source under a medium', () => {
    component.updateFilter('sources', ['material-a', 'material-c']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('combines filters across categories', () => {
    component.updateFilter('sources', ['material-a', 'material-c']);
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
        [
          ...fixture.nativeElement.querySelectorAll('.filter-group-trigger'),
        ].find((trigger) => trigger.textContent?.includes('Source')) as HTMLElement
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

    sourceExpanders()[0].click();
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
    const catalog = catalogMock({
      characters: [
        { id: 'c1', name: 'Padme Amidala' },
        { id: 'c2', name: 'Darth Maul' },
        { id: 'c3', name: 'Yoda' },
      ],
    });
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },

      { provide: CatalogService, useValue: catalog },
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
    const labels = [...characterGroup.querySelectorAll('.filter-option-label')].map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toContain('Yoda');
    expect(catalog.fetchCharacters).toHaveBeenCalled();
  });

  it('shows catalog locations in the filter even if not in any events', async () => {
    const catalog = catalogMock({
      locations: [
        { id: 'l1', name: 'Naboo' },
        { id: 'l2', name: 'Tatooine' },
      ],
    });
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },

      { provide: CatalogService, useValue: catalog },
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
    const labels = [...locationGroup.querySelectorAll('.filter-option-label')].map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toContain('Tatooine');
  });

  it('selecting a catalog character not in any events yields zero results', async () => {
    const catalog = catalogMock({
      characters: [
        { id: 'c1', name: 'Padme Amidala' },
        { id: 'c2', name: 'Darth Maul' },
        { id: 'c3', name: 'Yoda' },
      ],
    });
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock() },

      { provide: CatalogService, useValue: catalog },
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
      id: 'new-event',
      canon: ['Canon'],
      title: 'New Event',
      description: '',
      source: { title: 'Source D', medium: 'Book', sourceId: 'material-d' },
      locations: [],
      characters: [],
      vehicles: [],
      year: 3,
      displayDate: '3 ABY',
    };
    const invalidateMock = vi.fn(() => {
      eventsSig.set([...FIXTURE_EVENTS, newEvent]);
    });
    await setupTimeline([
      { provide: TimelineEventsService, useValue: eventsServiceMock(FIXTURE_EVENTS, { events: eventsSig, invalidate: invalidateMock }) },

      { provide: CatalogService, useValue: catalogMock() },
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

    it('returns all events when sourceIds is empty', () => {
      fixture.componentRef.setInput('sourceIds', []);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);
    });

    it('filters events to only those with matching source IDs', () => {
      component.selectView('Legends');
      fixture.componentRef.setInput('sourceIds', ['material-b']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Legends Only']);
    });

    it('excludes events with undefined sourceId', async () => {
      const eventNoId: TimelineEvent = {
        id: 'no-source-id',
        canon: ['Canon'],
        title: 'No Source ID',
        description: '',
        source: { title: 'Unknown', medium: 'Book' },
        locations: [],
        characters: [],
        vehicles: [],
        year: 5,
        displayDate: '5 ABY',
      };
      await setupTimeline([
        { provide: TimelineEventsService, useValue: eventsServiceMock([...FIXTURE_EVENTS, eventNoId]) },


        { provide: CatalogService, useValue: catalogMock() },
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
      fixture.componentRef.setInput('sourceIds', ['no-source-id']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual([]);
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

    it('applies character AND semantics', () => {
      component.updateFilter('characters', ['Padme Amidala']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);

      component.updateFilter('characters', ['Padme Amidala', 'Darth Maul']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both']);
    });

    it('applies location AND semantics', () => {
      component.updateFilter('locations', ['Naboo']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both', 'Canon Only']);

      component.updateFilter('locations', ['Naboo', 'Coruscant']);
      fixture.detectChanges();
      expect(eventTitles()).toEqual(['Both']);
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
        { provide: TimelineEventsService, useValue: eventsServiceMock([], { loading: signal(true), events: signal([]) }) },


        { provide: CatalogService, useValue: catalogMock() },
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
        { provide: TimelineEventsService, useValue: eventsServiceMock([], { events: signal(null), error: signal('Failed to load timeline events') }) },


        { provide: CatalogService, useValue: catalogMock() },
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
        { provide: TimelineEventsService, useValue: eventsServiceMock(FIXTURE_EVENTS, { invalidate: invalidateMock }) },


        { provide: CatalogService, useValue: catalogMock() },
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
