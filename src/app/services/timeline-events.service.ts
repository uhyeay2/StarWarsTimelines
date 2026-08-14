import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TimelineEvent } from '../models/timeline-event';
import { TIMELINE_EVENTS } from './timeline-events.data';

@Injectable({ providedIn: 'root' })
export class TimelineEventsService {
  getEvents(): Observable<readonly TimelineEvent[]> {
    return of(TIMELINE_EVENTS);
  }
}
