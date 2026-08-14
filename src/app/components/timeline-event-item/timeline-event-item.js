import { __decorate } from "tslib";
import { Component, input, output } from '@angular/core';
let TimelineEventItem = class TimelineEventItem {
    event = input.required();
    selectedLocations = input([]);
    selectedCharacters = input([]);
    selectedVehicles = input([]);
    toggleFacet = output();
    emitToggle(key, value) {
        this.toggleFacet.emit({ key, value });
    }
};
TimelineEventItem = __decorate([
    Component({
        selector: 'app-timeline-event-item',
        imports: [],
        templateUrl: './timeline-event-item.html',
        styleUrl: './timeline-event-item.scss',
    })
], TimelineEventItem);
export { TimelineEventItem };
