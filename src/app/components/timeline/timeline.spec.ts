import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { CatalogEvent } from '../../services/catalog-event.service';
import { TimelineEvent } from '../../models/timeline-event';
import { LibraryItem } from '../../models/library-item';
import { Medium } from '../../models/medium';
import { TrackingStatus } from '../../models/tracking-status';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth/auth.service';
import { CatalogEventService } from '../../services/catalog-event.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';
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

  function setupTimeline(providers: unknown[]): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Timeline], providers });
    return TestBed.compileComponents();
  }

  beforeEach(async () => {
    routeQueryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    routerMock = { navigate: vi.fn() };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(seasonEvents) } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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

  it('does not show tracking controls when logged out', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.status-badge').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.add-to-library-button').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.status-select').length).toBe(0);
  });

  it('shows the tracking status select on events when the user is logged in', async () => {
    const user: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser: signal(user) } },
      {
        provide: LibraryService,
        useValue: {
          getTracked: () =>
            of([
              {
                id: 'material-a',
                title: 'Source A',
                medium: 'Movie',
                status: 'In progress',
                favorite: false,
              },
            ]),
        },
      },
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

    const selects = [...fixture.nativeElement.querySelectorAll('.status-select')] as HTMLSelectElement[];
    expect(selects.length).toBe(1);
    expect(selects[0].value).toBe('In progress');
    expect(fixture.nativeElement.querySelectorAll('.add-to-library-button').length).toBe(1);
  });

  it('adds an event source to the library and updates its status when logged in', async () => {
    const user: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' };
    const trackedItems: LibraryItem[] = [];
    const libraryMock = {
      getTracked: vi.fn(() => of([...trackedItems])),
      addTracked: vi.fn((_userId: string, material: { id: string; title: string; medium: Medium }) => {
        trackedItems.push({
          id: material.id,
          title: material.title,
          medium: material.medium,
          status: 'Wish Listed',
          favorite: false,
        });
        return of([...trackedItems]);
      }),
      setStatus: vi.fn((_userId: string, id: string, status: TrackingStatus) => {
        const index = trackedItems.findIndex((item) => item.id === id);
        trackedItems[index] = { ...trackedItems[index], status };
        return of([...trackedItems]);
      }),
    };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser: signal(user) } },
      { provide: LibraryService, useValue: libraryMock },
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

    expect(fixture.nativeElement.querySelectorAll('.status-select').length).toBe(0);

    const addButtons = [...fixture.nativeElement.querySelectorAll('.add-to-library-button')] as HTMLElement[];
    expect(addButtons.length).toBe(2);
    addButtons[0].click();
    fixture.detectChanges();

    expect(libraryMock.addTracked).toHaveBeenCalledWith('user-padme', {
      id: 'material-c',
      title: 'Source C',
      medium: 'Movie',
    });
    const selects = [...fixture.nativeElement.querySelectorAll('.status-select')] as HTMLSelectElement[];
    expect(selects.length).toBe(1);
    expect(selects[0].value).toBe('Wish Listed');

    selects[0].value = 'Completed';
    selects[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(libraryMock.setStatus).toHaveBeenCalledWith('user-padme', 'material-c', 'Completed');
    expect((fixture.nativeElement.querySelector('.status-select') as HTMLSelectElement).value).toBe(
      'Completed',
    );
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
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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
      { provide: TimelineEventsService, useValue: { getEvents$: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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
    const eventsSubject = new BehaviorSubject<readonly TimelineEvent[]>(FIXTURE_EVENTS);
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents$: () => eventsSubject } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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
    eventsSubject.next([...FIXTURE_EVENTS, newEvent]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(eventTitles()).toContain('New Event');
  });
});
