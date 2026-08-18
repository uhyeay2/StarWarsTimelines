import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { LibraryItem } from '../../models/library-item';
import { User } from '../../models/user';
import { AuthService } from '../../services/auth/auth.service';
import { CatalogEventService, CatalogEvent } from '../../services/catalog-event.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
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
      { provide: TimelineEventsService, useValue: { getEvents: () => of([]) } },
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

function toggleButton(fixture: ComponentFixture<KnownTimelinePage>, label: string): HTMLElement {
  return [...fixture.nativeElement.querySelectorAll('.status-toggle')].find(
    (el) => (el as HTMLElement).textContent?.trim() === label,
  ) as HTMLElement;
}

describe('KnownTimelinePage', () => {
  it('shows a login prompt when logged out', async () => {
    const { fixture } = await setup(null);
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(Timeline))).toBeNull();
  });

  it('includes only Completed by default and passes the ids to the timeline', async () => {
    const { fixture, component } = await setup(USER);
    expect(component.includeCompleted()).toBe(true);
    expect(component.includeInProgress()).toBe(false);
    expect(component.includeWishListed()).toBe(false);
    expect(component.consumedIds()).toEqual(['material-episode-i']);
    expect(timelineSourceIds(fixture)).toEqual(['material-episode-i']);
  });

  it('adds In Progress items when that toggle is activated', async () => {
    const { fixture, component } = await setup(USER);
    toggleButton(fixture, 'In Progress').click();
    fixture.detectChanges();

    expect(component.consumedIds()).toEqual(['material-episode-i', 'material-episode-ii']);
    expect(timelineSourceIds(fixture)).toEqual(['material-episode-i', 'material-episode-ii']);
  });

  it('adds Wish Listed items when that toggle is activated', async () => {
    const { fixture, component } = await setup(USER);
    toggleButton(fixture, 'Wish Listed').click();
    fixture.detectChanges();

    expect(component.consumedIds()).toEqual(['material-episode-i', 'material-episode-ix']);
  });

  it('removes Completed items when the default toggle is deactivated', async () => {
    const { fixture, component } = await setup(USER);
    toggleButton(fixture, 'Completed').click();
    fixture.detectChanges();

    expect(component.consumedIds()).toEqual([]);
  });

  it('marks active status toggles with the active class', async () => {
    const { fixture } = await setup(USER);
    expect(toggleButton(fixture, 'Completed').classList.contains('status-toggle--active')).toBe(true);
    expect(toggleButton(fixture, 'In Progress').classList.contains('status-toggle--active')).toBe(false);
  });
});
