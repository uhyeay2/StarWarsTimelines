import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { TimelineEventsService } from './timeline-events.service';
import { TimelineEventsAdminService } from './timeline-events-admin.service';
import { TimelineError, TimelineErrorCode } from '../models/timeline-error';

const API = `${environment.apiBaseUrl}/api/timeline-events`;

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Test Event',
    description: '',
    yearStart: -32,
    yearEnd: -32,
    sequence: 1,
    sourceMaterials: [],
    characters: [],
    locations: [],
    vehicles: [],
    ...overrides,
  };
}

describe('TimelineEventsAdminService', () => {
  let service: TimelineEventsAdminService;
  let httpMock: HttpTestingController;
  let eventsService: { invalidate: ReturnType<typeof vi.fn>; getEvents: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventsService = { invalidate: vi.fn(), getEvents: vi.fn() };
    logger = { error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        TimelineEventsAdminService,
        {
          provide: TimelineEventsService,
          useValue: {
            invalidate: eventsService.invalidate,
            getEvents: eventsService.getEvents,
            events: vi.fn().mockReturnValue([]),
            loading: vi.fn().mockReturnValue(false),
            error: vi.fn().mockReturnValue(null),
          },
        },
        { provide: LoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(TimelineEventsAdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createEvent', () => {
    it('POSTs to the events endpoint with the mapped payload', () => {
      const input = {
        title: 'New Event',
        description: 'desc',
        yearStart: -10,
        yearEnd: -5,
        sequence: 1,
        sourceMaterials: [{ sourceMaterialId: 1, sourceMaterialUnitId: null }],
        characterIds: [2],
        locationIds: [],
        vehicleIds: [],
      };

      service.createEvent(input).subscribe();

      const req = httpMock.expectOne(API);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        title: 'New Event',
        description: 'desc',
        yearStart: -10,
        yearEnd: -5,
        sequence: 1,
        sourceMaterials: [{ sourceMaterialId: 1, sourceMaterialUnitId: null }],
        characterIds: [2],
        locationIds: [],
        vehicleIds: [],
      });
      req.flush(makeDto());
    });

    it('invalidates and reloads events after successful creation', async () => {
      let resolved = false;
      service
        .createEvent({
          title: 'X',
          description: '',
          yearStart: 0,
          yearEnd: 0,
          sequence: 1,
          sourceMaterials: [],
          characterIds: [],
          locationIds: [],
          vehicleIds: [],
        })
        .subscribe({
          next: () => {
            resolved = true;
          },
          error: () => {
            resolved = true;
          },
        });

      httpMock.expectOne(API).flush(makeDto());
      await new Promise<void>((r) => setTimeout(r, 50));
      expect(resolved).toBe(true);
      expect(eventsService.invalidate).toHaveBeenCalled();
      expect(eventsService.getEvents).toHaveBeenCalled();
    });

    it('throws TimelineError on validation failure', async () => {
      let error: unknown;
      service
        .createEvent({
          title: 'X',
          description: '',
          yearStart: 0,
          yearEnd: 0,
          sequence: 1,
          sourceMaterials: [],
          characterIds: [],
          locationIds: [],
          vehicleIds: [],
        })
        .subscribe({ error: (e: unknown) => (error = e) });

      const req = httpMock.expectOne(API);
      req.flush({ invalid: true });

      await new Promise<void>((r) => setTimeout(r));
      expect(error).toBeInstanceOf(TimelineError);
    });
  });

  describe('updateEvent', () => {
    it('PUTs to the specific event endpoint', () => {
      const input = {
        title: 'Updated',
        description: '',
        yearStart: 5,
        yearEnd: 10,
        sequence: 2,
        sourceMaterials: [],
        characterIds: [],
        locationIds: [],
        vehicleIds: [],
      };

      service.updateEvent(42, input).subscribe();

      const req = httpMock.expectOne(`${API}/42`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        title: 'Updated',
        description: '',
        yearStart: 5,
        yearEnd: 10,
        sequence: 2,
        sourceMaterials: [],
        characterIds: [],
        locationIds: [],
        vehicleIds: [],
      });
      req.flush(makeDto({ id: 42, title: 'Updated' }));
    });
  });

  describe('deleteEvent', () => {
    it('DELETEs the specific event endpoint', () => {
      service.deleteEvent(99).subscribe();

      const req = httpMock.expectOne(`${API}/99`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('invalidates and reloads events after successful deletion', async () => {
      let resolved = false;
      service.deleteEvent(99).subscribe({
        next: () => {
          resolved = true;
        },
        error: () => {
          resolved = true;
        },
      });

      httpMock.expectOne(`${API}/99`).flush(null);
      await new Promise<void>((r) => setTimeout(r, 50));
      expect(resolved).toBe(true);
      expect(eventsService.invalidate).toHaveBeenCalled();
      expect(eventsService.getEvents).toHaveBeenCalled();
    });

    it('wraps HTTP errors as TimelineError', async () => {
      let error: unknown;
      service.deleteEvent(99).subscribe({ error: (e: unknown) => (error = e) });

      httpMock.expectOne(`${API}/99`).flush(null, { status: 500, statusText: 'Server Error' });

      await new Promise<void>((r) => setTimeout(r));
      expect(error).toBeInstanceOf(TimelineError);
      expect((error as TimelineError).code).toBe(TimelineErrorCode.ServerError);
    });
  });
});
