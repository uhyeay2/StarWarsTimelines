import { __decorate } from "tslib";
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { TIMELINE_EVENTS } from './timeline-events.data';
let TimelineEventsService = class TimelineEventsService {
    getEvents() {
        return of(TIMELINE_EVENTS);
    }
};
TimelineEventsService = __decorate([
    Injectable({ providedIn: 'root' })
], TimelineEventsService);
export { TimelineEventsService };
