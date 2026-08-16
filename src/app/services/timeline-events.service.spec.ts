import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { TimelineEventsService } from './timeline-events.service';

const EVENTS_URL = `${environment.apiBaseUrl}/api/source-material-events`;
const EPISODE_ONE = '00000000-0000-0000-0000-000000000001';

const EVENT_DTO = [
  {
    id: 'the-invasion-of-naboo',
    title: 'The Invasion of Naboo',
    description: 'The Trade Federation blockades and invades Naboo.',
    canonType: 2,
    year: -32,
    displayDate: '32 BBY',
    displayDateEnd: null,
    sourceMaterial: {
      id: EPISODE_ONE,
      title: 'Star Wars: Episode I - The Phantom Menace',
      medium: 0,
      canonType: 2,
    },
    characters: [{ id: 'c-1', name: 'Darth Maul' }, { id: 'c-2', name: 'Qui-Gon Jinn' }],
    locations: [{ id: 'l-1', name: 'Naboo' }],
    vehicles: [{ id: 'v-1', name: 'Sith Infiltrator' }],
  },
];

describe('TimelineEventsService', () => {
  let service: TimelineEventsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()],
    });
    service = TestBed.inject(TimelineEventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps events from the API', async () => {
    const promise = firstValueFrom(service.getEvents());
    const request = httpMock.expectOne(EVENTS_URL);
    expect(request.request.method).toBe('GET');
    request.flush(EVENT_DTO);

    const events = await promise;
    expect(events).toEqual([
      {
        id: 'the-invasion-of-naboo',
        canon: ['Canon', 'Legends'],
        title: 'The Invasion of Naboo',
        description: 'The Trade Federation blockades and invades Naboo.',
        source: {
          title: 'Star Wars: Episode I - The Phantom Menace',
          medium: 'Movie',
          sourceId: EPISODE_ONE,
        },
        locations: ['Naboo'],
        characters: ['Darth Maul', 'Qui-Gon Jinn'],
        vehicles: ['Sith Infiltrator'],
        year: -32,
        displayDate: '32 BBY',
      },
    ]);
  });

  it('maps the display end date when present', async () => {
    const promise = firstValueFrom(service.getEvents());
    httpMock.expectOne(EVENTS_URL).flush([
      {
        ...EVENT_DTO[0],
        canonType: 0,
        displayDateEnd: '32 BBY',
      },
    ]);

    const events = await promise;
    expect(events[0].canon).toEqual(['Canon']);
    expect(events[0].displayDateEnd).toBe('32 BBY');
  });
});
