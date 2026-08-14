import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { TimelineEvent } from '../../models/timeline-event';
import { LibraryItem } from '../../models/library-item';
import { TrackingStatus } from '../../models/tracking-status';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
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

  function setupTimeline(providers: unknown[]): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Timeline], providers });
    return TestBed.compileComponents();
  }

  beforeEach(async () => {
    routeQueryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    routerMock = { navigate: vi.fn() };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser$: of(null) } },
      { provide: LibraryService, useValue: { getTracked: () => of([]) } },
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

  it('highlights a chip on an event once its value is part of the filter', () => {
    component.updateFilter('locations', ['Naboo']);
    fixture.detectChanges();
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

  it('filters by medium', () => {
    component.updateFilter('mediums', ['Movie']);
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Canon Only']);
  });

  it('combines filters across categories', () => {
    component.updateFilter('mediums', ['Movie']);
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
    expect(fixture.nativeElement.querySelectorAll('app-filter-group').length).toBe(0);

    component.toggleAdvanced();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-filter-group').length).toBe(5);
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
    const user: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala' };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser$: of(user) } },
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
    const user: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala' };
    const trackedItems: LibraryItem[] = [];
    const libraryMock = {
      getTracked: vi.fn(() => of([...trackedItems])),
      addTracked: vi.fn((_userId: string, id: string) => {
        trackedItems.push({ id, title: 'Source', medium: 'Movie', status: 'Wish Listed', favorite: false });
        return of([...trackedItems]);
      }),
      setStatus: vi.fn((_userId: string, id: string, status: TrackingStatus) => {
        const index = trackedItems.findIndex((item) => item.id === id);
        trackedItems[index] = { ...trackedItems[index], status };
        return of([...trackedItems]);
      }),
    };
    await setupTimeline([
      { provide: TimelineEventsService, useValue: { getEvents: () => of(FIXTURE_EVENTS) } },
      { provide: AuthService, useValue: { currentUser$: of(user) } },
      { provide: LibraryService, useValue: libraryMock },
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

    expect(libraryMock.addTracked).toHaveBeenCalledWith('user-padme', 'material-c');
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
});
