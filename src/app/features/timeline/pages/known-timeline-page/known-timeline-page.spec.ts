import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { LibraryItem } from '../../../../shared/models/library-item';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import { User } from '../../../../shared/models/user';
import { AuthService } from '../../../auth/services/auth.service';
import { CatalogEventService, CatalogEvent } from '../../../library/services/catalog-event.service';
import { CharacterService } from '../../../catalog/services/character.service';
import { LocationService } from '../../../catalog/services/location.service';
import { VehicleService } from '../../../catalog/services/vehicle.service';
import { SourceMaterialService } from '../../../catalog/services/source-material.service';
import { LibraryService } from '../../../library/services/library.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { Timeline } from '../../components/timeline/timeline';
import { KnownTimelinePage } from './known-timeline-page';

const USER: User = {
  id: 'user-padme',
  username: 'padme',
  displayName: 'Padmé Amidala',
  email: 'padme@example.com',
  emailVerified: true,
  role: 'Standard',
};

const TRACKED: LibraryItem[] = [
  {
    id: 21,
    title: 'Star Wars: Episode I - The Phantom Menace',
    medium: 'Movie',
    status: 'Completed',
    favorite: true,
  },
  {
    id: 22,
    title: 'Star Wars: Episode II - Attack of the Clones',
    medium: 'Movie',
    status: 'In progress',
    favorite: false,
  },
  {
    id: 23,
    title: 'Star Wars: Episode IX - The Rise of Skywalker',
    medium: 'Movie',
    status: 'Wish Listed',
    favorite: false,
  },
];

async function setup(
  currentUser: User | null,
  tracked: LibraryItem[] = TRACKED,
): Promise<{
  fixture: ComponentFixture<KnownTimelinePage>;
  component: KnownTimelinePage;
}> {
  const routeQueryParams = new BehaviorSubject(convertToParamMap({}));
  await TestBed.configureTestingModule({
    imports: [KnownTimelinePage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(currentUser) } },
      {
        provide: LibraryService,
        useValue: { items: signal(tracked), ensureTracked: vi.fn(), clearCache: vi.fn() },
      },
      {
        provide: TimelineEventsService,
        useValue: {
          getEvents$: () => of([]),
          loading: signal(false),
          error: signal(null),
          events: signal([]),
          getEvents: vi.fn(),
          invalidate: vi.fn(),
        },
      },
      {
        provide: CharacterService,
        useValue: {
          fetchCharacters: () => {},
          characters: signal(null),
        },
      },
      {
        provide: LocationService,
        useValue: {
          fetchLocations: () => {},
          locations: signal(null),
        },
      },
      {
        provide: VehicleService,
        useValue: {
          fetchVehicles: () => {},
          vehicles: signal(null),
        },
      },
      {
        provide: SourceMaterialService,
        useValue: {
          getUnitCache: vi.fn(() => ({
            data: () => [],
            loading: () => false,
            fetch: vi.fn(),
          })),
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
    expect(component.consumedIds()).toEqual([21, 22, 23]);
    expect(timelineSourceIds(fixture)).toEqual([21, 22, 23]);
  });

  it('shows only Completed items when that status is selected', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'Completed');

    expect(component.statusSelection()).toEqual<TrackingStatus[]>(['Completed']);
    expect(component.consumedIds()).toEqual([21]);
  });

  it('shows only In Progress items when that status is selected', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'In progress');

    expect(component.statusSelection()).toEqual<TrackingStatus[]>(['In progress']);
    expect(component.consumedIds()).toEqual([22]);
    expect(timelineSourceIds(fixture)).toEqual([22]);
  });

  it('supports combining statuses such as In Progress and Wish Listed', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'In progress', 'Wish Listed');

    expect(component.statusSelection()).toEqual<TrackingStatus[]>(['In progress', 'Wish Listed']);
    expect(component.consumedIds()).toEqual([22, 23]);
    expect(timelineSourceIds(fixture)).toEqual([22, 23]);
  });

  it('returns to All when the last selected status is deselected', async () => {
    const { fixture, component } = await setup(USER);
    clickTabs(fixture, 'Completed');
    clickTabs(fixture, 'Completed');

    expect(component.statusSelection()).toEqual([]);
    expect(component.consumedIds().length).toBe(3);
  });

  it('scopes unit-tracked materials to their tracked units on the timeline', async () => {
    const { fixture, component } = await setup(USER, [
      ...TRACKED,
      {
        id: 30,
        title: 'Star Wars: The Clone Wars',
        medium: 'Animated Show',
        status: null,
        favorite: false,
        units: [
          { id: 101, unitType: 'Season', number: 1, status: 'Completed' },
          {
            id: 201,
            unitType: 'Episode',

            number: 1,
            status: null,
            parentUnitId: 101,
          },
        ],
      },
    ]);

    // The show is in scope, but only through its tracked units.
    expect(component.consumedIds()).toContain(30);
    expect(component.trackedUnitScope().get(30)).toEqual(new Set([101, 201]));

    const timeline = fixture.debugElement.query(By.directive(Timeline)).componentInstance;
    expect(timeline.trackedUnitScope().get(30)).toEqual(new Set([101, 201]));
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
