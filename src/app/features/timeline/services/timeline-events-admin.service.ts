/**
 * @fileoverview Handles admin-only mutations (create, update, delete) for
 * timeline events. Delegates cache invalidation to TimelineEventsService
 * after each successful mutation.
 */
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TimelineEvent } from '../models/timeline-event';
import {
  CreateTimelineEventInput,
  EventSourceLinkInput,
} from '../models/create-timeline-event-input';
import { TimelineError, TimelineErrorCode } from '../models/timeline-error';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { TimelineEventDto, CreateTimelineEventRequest } from './timeline-events.dto';
import { isValidTimelineEventDto, mapTimelineEvent } from './timeline-events.mapper';
import { locationHierarchyTypeToApiCode } from '../../../shared/models/location-hierarchy-type';
import { TimelineEventsService } from './timeline-events.service';
import { classifyTimelineError, mapTimelineError } from './timeline-error-handler';

const BASE = `${environment.apiBaseUrl}/api/timeline-events`;

/**
 * Handles admin-only mutations (create, update, delete) for timeline events.
 *
 * Delegates cache invalidation to {@link TimelineEventsService} after each
 * successful mutation so the read side stays consistent.
 */
@Injectable({ providedIn: 'root' })
export class TimelineEventsAdminService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly eventsService = inject(TimelineEventsService);

  /**
   * Creates a new timeline event.
   * @param input - The event data including title, years, and linked source materials.
   * @returns An observable of the created timeline event.
   */
  createEvent(input: CreateTimelineEventInput): Observable<TimelineEvent> {
    return this.mutate(
      this.http.post<TimelineEventDto>(BASE, toRequestPayload(input)),
      'Unable to create the timeline event. Please try again.',
      'createEvent',
    );
  }

  /**
   * Updates an existing timeline event.
   * @param id - The ID of the event to update.
   * @param input - The updated event data.
   * @returns An observable of the updated timeline event.
   */
  updateEvent(id: number, input: CreateTimelineEventInput): Observable<TimelineEvent> {
    return this.mutate(
      this.http.put<TimelineEventDto>(`${BASE}/${id}`, toRequestPayload(input)),
      'Unable to update the timeline event. Please try again.',
      'updateEvent',
    );
  }

  /**
   * Deletes a timeline event by ID.
   * @param id - The ID of the event to delete.
   * @returns An observable that completes when the event is deleted.
   */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`).pipe(
      catchError((err: unknown) =>
        this.fail(err, 'Unable to delete the timeline event. Please try again.', 'deleteEvent'),
      ),
      tap(() => {
        this.eventsService.invalidate();
        this.eventsService.getEvents();
      }),
    );
  }

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
      tap(() => {
        this.eventsService.invalidate();
        this.eventsService.getEvents();
      }),
      catchError((err: unknown) => this.fail(err, fallback, context)),
    );
  }

  private fail(err: unknown, fallback: string, context: string): Observable<never> {
    if (err instanceof TimelineError) {
      this.logger.error(`[TimelineEventsAdminService] ${context}: ${err.message}`, { error: err });
      return throwError(() => err);
    }
    const message = mapTimelineError(err, fallback);
    this.logger.error(`[TimelineEventsAdminService] ${context}: ${message}`, { error: err });
    return throwError(() => new TimelineError(message, classifyTimelineError(err)));
  }
}

function toRequestPayload(input: CreateTimelineEventInput): CreateTimelineEventRequest {
  const links = input.sourceMaterials.map((link: EventSourceLinkInput) =>
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
    locations: input.locations.map((ref) => ({
      locationHierarchyType: locationHierarchyTypeToApiCode(ref.locationHierarchyType),
      locationId: ref.locationId,
    })),
    vehicleIds: [...input.vehicleIds],
  };
}
