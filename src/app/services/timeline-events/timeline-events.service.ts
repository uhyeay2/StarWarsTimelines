/**
 * @fileoverview Client-side service for loading timeline events.
 *
 * Provides signal-based caching, DTO validation, retry with exponential
 * backoff, and domain-specific error handling for the timeline events API.
 *
 * **Signal-based state:** The service exposes readonly signals (`events`,
 * `loading`, `error`) so that Angular components can read event state without
 * manual subscriptions. The cache is populated on demand and invalidated
 * automatically after the configured TTL.
 *
 * **Retry with backoff:** Transient server errors (503 / 504) are
 * automatically retried up to {@link MAX_RETRIES} times with exponential
 * backoff before failing.
 *
 * **DTO validation:** Raw API responses are validated defensively before
 * mapping. Malformed entries are logged and silently dropped rather than
 * causing the entire fetch to fail.
 *
 * **Partial reloads:** {@link reloadEvent} allows reloading a single event
 * from the server by ID, reducing network overhead when only one event
 * changes.
 *
 * **Cancellation:** The {@link getEvents$} overload accepts an optional
 * `DestroyRef` to auto-unsubscribe when the consuming component is destroyed,
 * preventing memory leaks.
 *
 * @see {@link Timeline} for the primary consumer of this service.
 * @see {@link KnownTimelinePage} for the per-source timeline view.
 */

import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  map,
  Observable,
  of,
  retry,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { readProblemDetail } from '../../utils/problem-detail';
import { SignalCache } from '../../utils/signal-cache';
import { TimelineEvent } from '../../models/timeline-event';
import {
  CreateTimelineEventInput,
  EventSourceLinkInput,
} from '../../models/catalog/create-timeline-event-input';
import { TimelineError, TimelineErrorCode } from '../../models/timeline/timeline-error';
import { LoggerService } from '../logging/logger.service';
import { TimelineEventDto } from './timeline-events.dto';
import {
  isValidTimelineEventDto,
  mapTimelineEvent,
} from './timeline-events.mapper';

/** Base URL for the timeline events API. */
const BASE = `${environment.apiBaseUrl}/api/timeline-events`;

/** Maximum number of automatic retries for transient server errors. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential retry backoff. */
const RETRY_BASE_DELAY_MS = 500;

/** 10-minute TTL for the events cache (resilience fallback). */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Client-side service for loading and caching timeline events.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 *
 * **Enum mapping:** The server returns numeric codes for the per-source
 * `canonType`, plus each material's `medium` and any pinned unit's
 * `unitType`. This service maps them to domain-level string unions using
 * the helpers in the corresponding model files.
 *
 * **Signal-based state:** The service exposes `events`, `loading`, and
 * `error` signals backed by a {@link SignalCache}. Call `getEvents()` to
 * populate the cache, or `invalidate()` to force a re-fetch.
 *
 * **Validation:** Every DTO in the response is validated via
 * {@link isValidTimelineEventDto} before mapping. Malformed entries are
 * dropped and logged.
 *
 * @example
 * ```ts
 * // Signal-based access
 * readonly events = this.eventsService.events;
 *
 * // Observable-based access
 * this.eventsService.getEvents$().subscribe(events => ...);
 *
 * // Partial reload after SSE event
 * this.eventsService.reloadEvent('event-id').subscribe();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class TimelineEventsService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // ─── Signal cache ───────────────────────────────────────────────────────

  private readonly eventsCache = new SignalCache<readonly TimelineEvent[]>(
    () => this.fetchEventsWithRetry(),
    (err: unknown) => this.mapError(err),
    CACHE_TTL_MS,
  );

  /** Timeline events currently loaded, or `null` if not yet fetched. */
  readonly events = this.eventsCache.data.asReadonly();

  /** Whether a fetch is currently in flight. */
  readonly loading = this.eventsCache.loading.asReadonly();

  /** The last error message, or `null` when there is no error. */
  readonly error = this.eventsCache.error.asReadonly();

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Returns an observable of all timeline events.
   *
   * Also populates the signal-based cache so that `this.events` is updated.
   * Ideal for use inside `switchMap` operators where an Observable is
   * required.
   *
   * @param destroyRef  Optional `DestroyRef` to auto-unsubscribe on
   *                    component destruction. Prevents memory leaks when
   *                    the observable is used in `effect()` or `subscribe()`.
   * @returns An observable of the mapped timeline events.
   */
  getEvents$(destroyRef?: DestroyRef): Observable<readonly TimelineEvent[]> {
    const cached = this.eventsCache.data();
    if (cached !== null) {
      return destroyRef ? of(cached).pipe(takeUntilDestroyed(destroyRef)) : of(cached);
    }

    const request$ = this.fetchEventsWithRetry().pipe(
      tap((events) => this.eventsCache.data.set(events)),
    );

    return destroyRef ? request$.pipe(takeUntilDestroyed(destroyRef)) : request$;
  }

  /**
   * Populates the signal cache with all timeline events.
   *
   * Safe to call multiple times — the {@link SignalCache} guards against
   * concurrent fetches. Use this for signal-based consumption.
   */
  getEvents(): void {
    this.eventsCache.fetch();
  }

  /**
   * Invalidates the cache and re-fetches all events.
   *
   * Use after SSE-driven invalidation or manual refresh requests.
   */
  invalidate(): void {
    this.eventsCache.invalidate();
  }

  /**
   * Reloads a single event by ID and merges it into the cached list.
   *
   * If the event is not found on the server (404), it is removed from the
   * cache. This reduces network overhead compared to re-fetching the full
   * list when only one event changes.
   *
   * @param eventId  The unique identifier of the event to reload.
   * @returns An observable that completes when the cache is updated.
   * @throws {TimelineError} When the reload fails with a non-transient error.
   */
  reloadEvent(eventId: number): Observable<void> {
    return this.http.get<TimelineEventDto>(`${BASE}/${eventId}`).pipe(
      retry({
        count: MAX_RETRIES,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          if (error instanceof HttpErrorResponse && [503, 504].includes(error.status)) {
            return timer(RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1));
          }
          return throwError(() => error);
        },
      }),
      map((dto) => {
        if (!isValidTimelineEventDto(dto)) {
          this.logger.warn('[TimelineEventsService] reloadEvent: Malformed event DTO', {
            eventId,
            dto,
          });
          throw new TimelineError(
            `Event ${eventId} returned invalid data from the server.`,
            TimelineErrorCode.ValidationError,
          );
        }
        return mapTimelineEvent(dto);
      }),
      tap((mapped) => {
        const current = this.eventsCache.data();
        if (current === null) {
          return;
        }
        const updated = current.map((ev: TimelineEvent) => (ev.id === eventId ? mapped : ev));
        this.eventsCache.data.set(updated);
      }),
      map(() => void 0),
      catchError((err: unknown) => {
        if (err instanceof TimelineError) {
          return throwError(() => err);
        }
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.removeEventFromCache(eventId);
          return throwError(() =>
            new TimelineError(
              `Event ${eventId} was not found and has been removed from the cache.`,
              TimelineErrorCode.NotFound,
            ),
          );
        }
        const message = this.mapError(err);
        return throwError(() => new TimelineError(message, this.classifyError(err)));
      }),
    );
  }

  // ─── Admin mutations ───────────────────────────────────────────────────

  /**
   * Creates a new timeline event (admin only).
   *
   * @param input  The event payload, including source-material links.
   * @returns An observable of the created event.
   */
  createEvent(input: CreateTimelineEventInput): Observable<TimelineEvent> {
    return this.mutate(
      this.http.post<TimelineEventDto>(BASE, toRequestPayload(input)),
      'Unable to create the timeline event. Please try again.',
      'createEvent',
    );
  }

  /**
   * Replaces an existing timeline event (admin only).
   *
   * All fields are sent on every call, so linked entities omitted from the
   * payload are cleared — mirroring the catalog update semantics.
   *
   * @param id     The ID of the event to replace.
   * @param input  The updated payload.
   * @returns An observable of the updated event.
   */
  updateEvent(id: number, input: CreateTimelineEventInput): Observable<TimelineEvent> {
    return this.mutate(
      this.http.put<TimelineEventDto>(`${BASE}/${id}`, toRequestPayload(input)),
      'Unable to update the timeline event. Please try again.',
      'updateEvent',
    );
  }

  /**
   * Deletes a timeline event (admin only).
   *
   * @param id  The ID of the event to delete.
   * @returns An observable that completes when the event has been deleted.
   */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`).pipe(
      catchError((err: unknown) =>
        this.fail(err, 'Unable to delete the timeline event. Please try again.', 'deleteEvent'),
      ),
      // Refresh lazily: clear the stale list, then re-fetch in place.
      tap(() => {
        this.eventsCache.invalidate();
        this.eventsCache.fetch();
      }),
    );
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  /**
   * Fetches all events from the API with retry and maps the response.
   *
   * Invalid DTOs are logged and silently dropped. This ensures a single
   * malformed event does not prevent the entire list from loading.
   *
   * @returns An observable of validated and mapped timeline events.
   */
  private fetchEventsWithRetry(): Observable<readonly TimelineEvent[]> {
    return this.http.get<readonly TimelineEventDto[]>(BASE).pipe(
      retry({
        count: MAX_RETRIES,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          if (error instanceof HttpErrorResponse && [503, 504].includes(error.status)) {
            this.logger.warn('[TimelineEventsService] Retrying after transient error', {
              status: error.status,
              attempt: retryCount,
            });
            return timer(RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1));
          }
          return throwError(() => error);
        },
      }),
      map((dtos) => {
        const valid: TimelineEvent[] = [];
        for (const dto of dtos) {
          if (isValidTimelineEventDto(dto)) {
            valid.push(mapTimelineEvent(dto));
          } else {
            this.logger.warn('[TimelineEventsService] Dropping malformed event DTO', { dto });
          }
        }
        return valid as readonly TimelineEvent[];
      }),
      catchError((err: unknown) => {
        if (err instanceof TimelineError) {
          return throwError(() => err);
        }
        const message = this.mapError(err);
        this.logger.error('[TimelineEventsService] Failed to load events', { error: message });
        return throwError(() => new TimelineError(message, this.classifyError(err)));
      }),
    );
  }

  /**
   * Removes a single event from the cache by ID.
   *
   * Used when a 404 is received during a partial reload.
   *
   * @param eventId  The ID of the event to remove.
   */
  private removeEventFromCache(eventId: number): void {
    const current = this.eventsCache.data();
    if (current === null) {
      return;
    }
    this.eventsCache.data.set(current.filter((ev: TimelineEvent) => ev.id !== eventId));
    this.logger.info('[TimelineEventsService] Removed event from cache', { eventId });
  }

  /**
   * Maps a raw error to a human-readable message.
   *
   * @param err  The caught error.
   * @returns A display-friendly error message.
   */
  private mapError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      return readProblemDetail(err, 'Failed to load timeline events');
    }
    if (err instanceof TimelineError) {
      return err.message;
    }
    return 'An unexpected error occurred while loading timeline events';
  }

  /**
   * Classifies a raw error into a {@link TimelineErrorCode}.
   *
   * @param err  The caught error.
   * @returns The appropriate error code.
   */
  private classifyError(err: unknown): TimelineErrorCode {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return TimelineErrorCode.NetworkError;
      }
      if (err.status === 404) {
        return TimelineErrorCode.NotFound;
      }
      if ([503, 504].includes(err.status)) {
        return TimelineErrorCode.NetworkError;
      }
      return TimelineErrorCode.ServerError;
    }
    return TimelineErrorCode.NetworkError;
  }

  /**
   * Runs a create/update mutation: validates the mapped response, refreshes
   * the events cache, and wraps failures in a {@link TimelineError}.
   *
   * @param request$  The HTTP request returning the event DTO.
   * @param fallback  A human-readable default when the server provides none.
   * @param context   A short label for log context.
   * @returns An observable of the validated and mapped event.
   */
  private mutate(
    request$: Observable<TimelineEventDto>,
    fallback: string,
    context: string,
  ): Observable<TimelineEvent> {
    return request$.pipe(
      map((dto) => {
        if (!isValidTimelineEventDto(dto)) {
          throw new TimelineError(fallback, TimelineErrorCode.ValidationError);
        }
        return mapTimelineEvent(dto);
      }),
      // Linked-entity edits can affect other cached events; refresh in place.
      tap(() => {
        this.eventsCache.invalidate();
        this.eventsCache.fetch();
      }),
      catchError((err: unknown) => this.fail(err, fallback, context)),
    );
  }

  /**
   * Wraps a mutation failure in a {@link TimelineError} after logging it.
   *
   * @param err       The caught error.
   * @param fallback  A human-readable default when the server provides none.
   * @param context   A short label for log context.
   */
  private fail(err: unknown, fallback: string, context: string): Observable<never> {
    if (err instanceof TimelineError) {
      this.logger.error(`[TimelineEventsService] ${context}: ${err.message}`, { error: err });
      return throwError(() => err);
    }
    const message =
      err instanceof HttpErrorResponse
        ? readProblemDetail(err, fallback)
        : fallback;
    this.logger.error(`[TimelineEventsService] ${context}: ${message}`, { error: err });
    return throwError(() => new TimelineError(message, this.classifyError(err)));
  }
}

/**
 * Converts a domain-level input into the wire format expected by the API:
 * nullable optionals become explicit `null`s and readonly arrays become
 * mutable lists.
 *
 * @param input  The domain-level event payload.
 * @returns The JSON request body.
 */
function toRequestPayload(input: CreateTimelineEventInput): Record<string, unknown> {
  const links = input.sourceMaterials.map(
    (link: EventSourceLinkInput) =>
      link.sourceMaterialUnitId !== null
        ? { sourceMaterialId: link.sourceMaterialId, sourceMaterialUnitId: link.sourceMaterialUnitId }
        : { sourceMaterialId: link.sourceMaterialId, sourceMaterialUnitId: null },
  );
  return {
    title: input.title,
    description: input.description,
    yearStart: input.yearStart,
    yearEnd: input.yearEnd,
    sequence: input.sequence,
    sourceMaterials: links,
    characterIds: [...input.characterIds],
    locationIds: [...input.locationIds],
    vehicleIds: [...input.vehicleIds],
  };
}
