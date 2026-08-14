import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { CANON_VIEWS, CanonView, matchesCanonView } from '../../models/canon';
import {
  collectFacetOptions,
  createEmptyFilters,
  FacetKey,
  matchesFilters,
  TimelineFilters,
} from '../../models/timeline-filters';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { TimelineEventItem, ToggleFacetEvent } from '../timeline-event-item/timeline-event-item';
import { FilterGroup } from '../filter-group/filter-group';

@Component({
  selector: 'app-timeline',
  imports: [TimelineEventItem, FilterGroup],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class Timeline {
  private readonly eventsService = inject(TimelineEventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly views = CANON_VIEWS;
  protected readonly events = toSignal(this.eventsService.getEvents(), { initialValue: [] });
  readonly filters = signal<TimelineFilters>(createEmptyFilters());

  constructor() {
    this.applyViewParam(this.route.snapshot.queryParamMap);
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.applyViewParam(params));
  }

  private applyViewParam(params: ParamMap): void {
    const view = params.get('view');
    if (view && (CANON_VIEWS as readonly string[]).includes(view)) {
      this.filters.update((filters) => ({ ...filters, canonView: view as CanonView }));
    }
  }

  protected readonly continuityEvents = computed(() =>
    this.events().filter((event) => matchesCanonView(event.canon, this.filters().canonView)),
  );

  protected readonly facetOptions = computed(() => collectFacetOptions(this.continuityEvents()));

  protected readonly advancedOpen = signal(false);

  protected readonly activeFacetCount = computed(() => {
    const filters = this.filters();
    return (
      (filters.mediums.length > 0 ? 1 : 0) +
      (filters.sources.length > 0 ? 1 : 0) +
      (filters.locations.length > 0 ? 1 : 0) +
      (filters.characters.length > 0 ? 1 : 0) +
      (filters.vehicles.length > 0 ? 1 : 0)
    );
  });

  protected readonly filteredEvents = computed(() =>
    this.events()
      .filter((event) => matchesFilters(event, this.filters()))
      .sort((a, b) => a.year - b.year),
  );

  protected readonly hasActiveFilters = computed(() => this.activeFacetCount() > 0);

  selectView(view: CanonView): void {
    this.filters.update((filters) => ({ ...filters, canonView: view }));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  toggleAdvanced(): void {
    this.advancedOpen.update((isOpen) => !isOpen);
  }

  updateFilter(key: FacetKey, value: readonly string[]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  onToggleFacet({ key, value }: ToggleFacetEvent): void {
    this.filters.update((filters) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((selected) => selected !== value)
        : [...current, value];
      return { ...filters, [key]: next };
    });
  }

  clearFilters(): void {
    this.filters.update((filters) => ({
      ...filters,
      mediums: [],
      sources: [],
      locations: [],
      characters: [],
      vehicles: [],
    }));
  }
}
