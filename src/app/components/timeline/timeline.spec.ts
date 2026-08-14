import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TimelineEvent } from '../../models/timeline-event';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { Timeline } from './timeline';

const FIXTURE_EVENTS: readonly TimelineEvent[] = [
  {
    id: 'canon-event',
    canon: ['Canon'],
    title: 'Canon Only',
    description: '',
    source: { title: 'Source A', medium: 'Movie' },
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
    source: { title: 'Source B', medium: 'Book' },
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
    source: { title: 'Source C', medium: 'Movie' },
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

  beforeEach(async () => {
    routeQueryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [Timeline],
      providers: [
        { provide: TimelineEventsService, useValue: { getEvents: () => of(FIXTURE_EVENTS) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParamMap: routeQueryParams,
          },
        },
      ],
    }).compileComponents();

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

  it('applies the canon view from the view query param', () => {
    routeQueryParams.next(convertToParamMap({ view: 'Legends' }));
    fixture.detectChanges();
    expect(eventTitles()).toEqual(['Both', 'Legends Only']);
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
});
