import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { LibraryItem } from '../../models/library-item';
import { TrackingStatus } from '../../models/tracking-status';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth/auth.service';
import { CatalogEventService, CatalogEvent } from '../../services/catalog-event.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';
import { TimelineEventsService } from '../../services/timeline-events/timeline-events.service';
import { StatusFilter } from '../status-filter/status-filter';
import { Timeline } from '../timeline/timeline';
import { KnownTimelinePage } from './known-timeline-page';

const USER: User = { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', email: 'padme@example.com', emailVerified: true, role: 'Standard' };

const TRACKED: LibraryItem[] = [
  {
    id: 'material-episode-i',
    title: 'Star Wars: Episode I - The Phantom Menace',
    medium: 'Movie',
    status: 'Completed',
    favorite: true,
  },
  {
    id: 'material-episode-ii',
    title: 'Star Wars: Episode II - Attack of the Clones',
    medium: 'Movie',
    status: 'In progress',
    favorite: false,
  },
  {
    id: 'material-episode-ix',
    title: 'Star Wars: Episode IX - The Rise of Skywalker',
    medium: 'Movie',
    status: 'Wish Listed',
    favorite: false,
  },
];

async function setup(currentUser: User | null): Promise<{
  fixture: ComponentFixture<KnownTimelinePage>;
  component: KnownTimelinePage;
}> {
  const routeQueryParams = new BehaviorSubject(convertToParamMap({}));
  await TestBed.configureTestingModule({
    imports: [KnownTimelinePage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(currentUser) } },
      { provide: LibraryService, useValue: { getTracked: () => of(TRACKED) } },
      { provide: TimelineEventsService, useValue: { getEvents$: () => of([]), loading: signal(false), error: signal(null), events: signal([]), getEvents: vi.fn(), invalidate: vi.fn() } },
      {
        provide: CatalogService,
        useValue: {
          fetchCharacters: () => {},
          fetchLocations: () => {},
          fetchVehicles: () => {},
          characters: signal(null),
          locations: signal(null),
          vehicles: signal(null),
        },
      },
      {
        provide: CatalogEventService,
        useValue: { events$: new Subject<CatalogEvent>().asObservable(), connected: signal(false) },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({}) },
          queryParamMap: routeQueryParams,
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(KnownTimelinePage);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, component };
}

function timelineSourceIds(fixture: ComponentFixture<KnownTimelinePage>): readonly string[] | null {
  const debugElement = fixture.debugElement.query(By.directive(Timeline));
  return debugElement?.componentInstance.sourceIds() ?? null;
}

function filterTab(fixture: ComponentFixture<KnownTimelinePage>, label: string): HTMLElement {
  return [...fixture.nativeElement.querySelectorAll('.filter-tab')].find(
    (el) => (el as HTMLElement).textContent?.trim() === label,
  ) as HTMLElement;
}

function clickTabs(fixture: ComponentFixture<KnownTimelinePage>, ...labels: string[]): void {
  for (const label of labels) {
    filterTab(fixture, label).click();
    fixture.detectChanges();
  }
}

describe('KnownTimelinePage', () => {
  it('shows a login prompt when logged out', async () => {
    const { fixture } = await setup(null);
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(Timeline))).toBeNull();
  });

  it('includes all tracked statuses by default and passes the ids to the timeline', async () => {
    const { fixture, component } = await setup(USER);
    expect(component.statusSelection()).toEqual([]);
    expect(component.consumedIds()).toEqual([
      'material-episode-i',
      'material-episode-ii',
      'material-episode-ix',
    ]);
    expect(timelineSourceIds(fixture)).toEqual([
      'material-episode-i',
      'material-episode-ii',
      'material-episode-ix',
    ]);
  });

  it('shows only Completed items when that status is selected', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'Completed');

    expect(component.statusSelection()).toEqual<TrackingStatus[]>(['Completed']);
    expect(component.consumedIds()).toEqual(['material-episode-i']);
  });

  it('shows only In Progress items when that status is selected', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'In progress');

    expect(component.statusSelection()).toEqual<TrackingStatus[]>(['In progress']);
    expect(component.consumedIds()).toEqual(['material-episode-ii']);
    expect(timelineSourceIds(fixture)).toEqual(['material-episode-ii']);
  });

  it('supports combining statuses such as In Progress and Wish Listed', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'In progress', 'Wish Listed');

    expect(component.statusSelection()).toEqual<TrackingStatus[]>(['In progress', 'Wish Listed']);
    expect(component.consumedIds()).toEqual(['material-episode-ii', 'material-episode-ix']);
    expect(timelineSourceIds(fixture)).toEqual(['material-episode-ii', 'material-episode-ix']);
  });

  it('returns to All when the last selected status is deselected', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'Completed');
    clickTabs(fixture, 'Completed');

    expect(component.statusSelection()).toEqual([]);
    expect(component.consumedIds().length).toBe(3);
  });

  it('marks active status filters with the active class', async () => {
    const { fixture } = await setup(USER);
    expect(filterTab(fixture, 'All').classList.contains('filter-tab--active')).toBe(true);
    expect(filterTab(fixture, 'Completed').classList.contains('filter-tab--active')).toBe(false);

    clickTabs(fixture, 'Completed');

    expect(filterTab(fixture, 'All').classList.contains('filter-tab--active')).toBe(false);
    expect(filterTab(fixture, 'Completed').classList.contains('filter-tab--active')).toBe(true);
  });
});
