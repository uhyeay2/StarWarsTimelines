/**
 * @fileoverview Tests for the hardened TimelineEventsService.
 *
 * Covers happy-path mapping, DTO validation, retry with exponential backoff,
 * domain-specific error handling, partial reloads, and signal cache behavior.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TimelineError, TimelineErrorCode } from '../../models/timeline/timeline-error';
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
    sourceMaterialUnit: {
      id: 'unit-1',
      unitType: 0,
      groupNumber: 1,
      number: 1,
      title: 'The Phantom Menace',
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

  // ── Happy-path mapping ────────────────────────────────────────────────

  describe('getEvents$ (Observable API)', () => {
    it('maps events from the API', async () => {
      const promise = firstValueFrom(service.getEvents$());
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
            unit: {
              id: 'unit-1',
              unitType: 'Episode',
              groupNumber: 1,
              number: 1,
              title: 'The Phantom Menace',
            },
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
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush([
        {
          ...EVENT_DTO[0],
          canonType: 0,
          displayDateEnd: '32 BBY',
          sourceMaterialUnit: null,
        },
      ]);

      const events = await promise;
      expect(events[0].canon).toEqual(['Canon']);
      expect(events[0].displayDateEnd).toBe('32 BBY');
      expect(events[0].source.unit).toBeUndefined();
    });

    it('populates the signal cache on success', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);
      await promise;

      expect(service.events()).toEqual([
        expect.objectContaining({ id: 'the-invasion-of-naboo' }),
      ]);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });
  });

  // ── Signal-based API ──────────────────────────────────────────────────

  describe('getEvents (signal API)', () => {
    it('populates the events signal', () => {
      expect(service.events()).toBeNull();

      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);

      expect(service.events()).toEqual([
        expect.objectContaining({ id: 'the-invasion-of-naboo' }),
      ]);
    });

    it('sets loading signal during fetch', () => {
      expect(service.loading()).toBe(false);

      service.getEvents();
      expect(service.loading()).toBe(true);

      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);
      expect(service.loading()).toBe(false);
    });

    it('sets error signal on failure', () => {
      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(service.error()).toBe('Failed to load timeline events');
      expect(service.events()).toBeNull();
    });
  });

  // ── DTO validation ────────────────────────────────────────────────────

  describe('DTO validation', () => {
    it('drops malformed events and keeps valid ones', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush([
        { id: '', title: null },
        EVENT_DTO[0],
      ]);

      const events = await promise;
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('the-invasion-of-naboo');
    });

    it('returns empty array when all DTOs are malformed', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush([{ id: '', title: null }]);

      const events = await promise;
      expect(events).toEqual([]);
    });

    it('drops entities with missing name fields', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush([
        {
          ...EVENT_DTO[0],
          characters: [{ id: 'c-1', name: '' }],
          locations: [{ id: 'l-1', name: 'Naboo' }],
        },
      ]);

      const events = await promise;
      expect(events[0].characters).toEqual([]);
      expect(events[0].locations).toEqual(['Naboo']);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('wraps 500 errors in TimelineError', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(promise).rejects.toMatchObject({
        name: 'TimelineError',
        code: TimelineErrorCode.ServerError,
      });
    });

    it('wraps network errors in TimelineError', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).error(new ProgressEvent('error'));

      await expect(promise).rejects.toMatchObject({
        name: 'TimelineError',
        code: TimelineErrorCode.NetworkError,
      });
    });

    it('wraps 400 errors as ServerError', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush(
        { detail: 'Bad request' },
        { status: 400, statusText: 'Bad Request' },
      );

      await expect(promise).rejects.toMatchObject({
        name: 'TimelineError',
        code: TimelineErrorCode.ServerError,
      });
    });

    it('reads ProblemDetails detail field for error message', async () => {
      vi.useFakeTimers();

      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush(
        { detail: 'The events endpoint is disabled.' },
        { status: 503, statusText: 'Service Unavailable' },
      );

      // 503 is transient so it retries 3 times before failing
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(500 * Math.pow(2, i));
        const retryReq = httpMock.expectOne(EVENTS_URL);
        retryReq.flush(
          { detail: 'The events endpoint is disabled.' },
          { status: 503, statusText: 'Service Unavailable' },
        );
      }

      await expect(promise).rejects.toMatchObject({
        name: 'TimelineError',
        message: 'The events endpoint is disabled.',
      });

      vi.useRealTimers();
    });
  });

  // ── Retry on transient errors ─────────────────────────────────────────

  describe('retry on transient errors', () => {
    it('retries on 503 and succeeds on the second attempt', async () => {
      vi.useFakeTimers();

      let result: unknown;
      service.getEvents$().subscribe({
        next: (events) => (result = events),
      });

      const firstReq = httpMock.expectOne(EVENTS_URL);
      firstReq.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });

      await vi.advanceTimersByTimeAsync(1000);

      const retryReq = httpMock.expectOne(EVENTS_URL);
      retryReq.flush(EVENT_DTO);

      expect(result).toEqual([expect.objectContaining({ id: 'the-invasion-of-naboo' })]);

      vi.useRealTimers();
    });

    it('retries on 504 and succeeds on the second attempt', async () => {
      vi.useFakeTimers();

      let result: unknown;
      service.getEvents$().subscribe({
        next: (events) => (result = events),
      });

      const firstReq = httpMock.expectOne(EVENTS_URL);
      firstReq.flush('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' });

      await vi.advanceTimersByTimeAsync(1000);

      const retryReq = httpMock.expectOne(EVENTS_URL);
      retryReq.flush(EVENT_DTO);

      expect(result).toEqual([expect.objectContaining({ id: 'the-invasion-of-naboo' })]);

      vi.useRealTimers();
    });

    it('does NOT retry on 500 (non-transient)', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(promise).rejects.toMatchObject({ code: TimelineErrorCode.ServerError });
    });

    it('does NOT retry on 400', async () => {
      const promise = firstValueFrom(service.getEvents$());
      httpMock.expectOne(EVENTS_URL).flush('Bad Request', {
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(promise).rejects.toMatchObject({ code: TimelineErrorCode.ServerError });
    });

    it('fails after exhausting all retries on repeated 503', async () => {
      vi.useFakeTimers();

      const promise = firstValueFrom(service.getEvents$());

      for (let i = 0; i <= 3; i++) {
        const req = httpMock.expectOne(EVENTS_URL);
        req.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
        if (i < 3) {
          await vi.advanceTimersByTimeAsync(500 * Math.pow(2, i));
        }
      }

      await expect(promise).rejects.toMatchObject({ code: TimelineErrorCode.NetworkError });

      vi.useRealTimers();
    });
  });

  // ── invalidate ────────────────────────────────────────────────────────

  describe('invalidate', () => {
    it('clears the cache and re-fetches', () => {
      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);
      expect(service.events()).toEqual([expect.objectContaining({ id: 'the-invasion-of-naboo' })]);

      service.invalidate();
      expect(service.events()).toBeNull();

      httpMock.expectOne(EVENTS_URL).flush([]);
      expect(service.events()).toEqual([]);
    });
  });

  // ── reloadEvent ───────────────────────────────────────────────────────

  describe('reloadEvent', () => {
    it('re-fetches a single event and merges it into the cache', async () => {
      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);

      const updatedDto = {
        ...EVENT_DTO[0],
        title: 'Updated: The Invasion of Naboo',
      };

      const promise = firstValueFrom(service.reloadEvent('the-invasion-of-naboo'));
      const req = httpMock.expectOne(`${EVENTS_URL}/the-invasion-of-naboo`);
      expect(req.request.method).toBe('GET');
      req.flush(updatedDto);

      await promise;

      const events = service.events();
      expect(events).toHaveLength(1);
      expect(events![0].title).toBe('Updated: The Invasion of Naboo');
    });

    it('removes the event from cache on 404', async () => {
      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);

      const promise = firstValueFrom(service.reloadEvent('the-invasion-of-naboo'));
      httpMock
        .expectOne(`${EVENTS_URL}/the-invasion-of-naboo`)
        .flush('Not Found', { status: 404, statusText: 'Not Found' });

      await expect(promise).rejects.toMatchObject({
        code: TimelineErrorCode.NotFound,
      });

      expect(service.events()).toEqual([]);
    });

    it('wraps validation errors when DTO is malformed', async () => {
      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);

      const promise = firstValueFrom(service.reloadEvent('the-invasion-of-naboo'));
      httpMock
        .expectOne(`${EVENTS_URL}/the-invasion-of-naboo`)
        .flush({ id: '', title: null });

      await expect(promise).rejects.toMatchObject({
        code: TimelineErrorCode.ValidationError,
      });

      // Original cache should remain unchanged
      expect(service.events()).toEqual([
        expect.objectContaining({ id: 'the-invasion-of-naboo' }),
      ]);
    });

    it('retries on 503 before failing', async () => {
      vi.useFakeTimers();

      service.getEvents();
      httpMock.expectOne(EVENTS_URL).flush(EVENT_DTO);

      const promise = firstValueFrom(service.reloadEvent('the-invasion-of-naboo'));

      const firstReq = httpMock.expectOne(`${EVENTS_URL}/the-invasion-of-naboo`);
      firstReq.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });

      await vi.advanceTimersByTimeAsync(1000);

      const retryReq = httpMock.expectOne(`${EVENTS_URL}/the-invasion-of-naboo`);
      retryReq.flush(EVENT_DTO[0]);

      await promise;

      expect(service.events()![0].title).toBe('The Invasion of Naboo');

      vi.useRealTimers();
    });

    it('does nothing when cache is empty', async () => {
      const promise = firstValueFrom(service.reloadEvent('the-invasion-of-naboo'));
      httpMock.expectOne(`${EVENTS_URL}/the-invasion-of-naboo`).flush(EVENT_DTO[0]);

      await promise;

      expect(service.events()).toBeNull();
    });
  });
});
