import { __decorate } from "tslib";
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CANON_VIEWS, matchesCanonView } from '../../models/canon';
import { collectFacetOptions, createEmptyFilters, matchesFilters, } from '../../models/timeline-filters';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { TimelineEventItem } from '../timeline-event-item/timeline-event-item';
import { FilterGroup } from '../filter-group/filter-group';
let Timeline = class Timeline {
    eventsService = inject(TimelineEventsService);
    route = inject(ActivatedRoute);
    views = CANON_VIEWS;
    events = toSignal(this.eventsService.getEvents(), { initialValue: [] });
    filters = signal(createEmptyFilters());
    constructor() {
        this.applyViewParam(this.route.snapshot.queryParamMap);
        this.route.queryParamMap
            .pipe(takeUntilDestroyed())
            .subscribe((params) => this.applyViewParam(params));
    }
    applyViewParam(params) {
        const view = params.get('view');
        if (view && CANON_VIEWS.includes(view)) {
            this.filters.update((filters) => ({ ...filters, canonView: view }));
        }
    }
    continuityEvents = computed(() => this.events().filter((event) => matchesCanonView(event.canon, this.filters().canonView)));
    facetOptions = computed(() => collectFacetOptions(this.continuityEvents()));
    advancedOpen = signal(false);
    activeFacetCount = computed(() => {
        const filters = this.filters();
        return ((filters.mediums.length > 0 ? 1 : 0) +
            (filters.sources.length > 0 ? 1 : 0) +
            (filters.locations.length > 0 ? 1 : 0) +
            (filters.characters.length > 0 ? 1 : 0) +
            (filters.vehicles.length > 0 ? 1 : 0));
    });
    filteredEvents = computed(() => this.events()
        .filter((event) => matchesFilters(event, this.filters()))
        .sort((a, b) => a.year - b.year));
    hasActiveFilters = computed(() => this.activeFacetCount() > 0);
    selectView(view) {
        this.filters.update((filters) => ({ ...filters, canonView: view }));
    }
    toggleAdvanced() {
        this.advancedOpen.update((isOpen) => !isOpen);
    }
    updateFilter(key, value) {
        this.filters.update((filters) => ({ ...filters, [key]: value }));
    }
    onToggleFacet({ key, value }) {
        this.filters.update((filters) => {
            const current = filters[key];
            const next = current.includes(value)
                ? current.filter((selected) => selected !== value)
                : [...current, value];
            return { ...filters, [key]: next };
        });
    }
    clearFilters() {
        this.filters.update((filters) => ({
            ...filters,
            mediums: [],
            sources: [],
            locations: [],
            characters: [],
            vehicles: [],
        }));
    }
};
Timeline = __decorate([
    Component({
        selector: 'app-timeline',
        imports: [TimelineEventItem, FilterGroup],
        templateUrl: './timeline.html',
        styleUrl: './timeline.scss',
    })
], Timeline);
export { Timeline };
