/**
 * @fileoverview Main timeline component that renders a filterable, chronologically
 * ordered list or Star Wars timeline events.
 *
 * The component fetches events from {@link TimelineEventsService}, supports
 * real-time updates via SSE-driven refresh, and provides advanced filtering
 * by canon view, source material, location, characters, and vehicles.
 *
 * Consumed as `<app-timeline>` by {@link KnownTimelinePage} (per-source view)
 * and standalone for the full Galactic Timeline.
 *
 * @see {@link TimelineEventsService} for event data fetching and caching.
 * @see {@link FilterGroup} for the collapsible filter panel UI.
 * @see {@link TimelineEventItem} for individual event card rendering.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs';
import { CanonView } from '../../../../shared/models/canon';
import { FacetKey } from '../../models/timeline-filters';
import { FilterTreeNode } from '../../models/timeline-filters-types';
import { TrackedScopeMap } from '../../../../shared/models/tracking-selection';
import { TimelineEventItem, ToggleFacetEvent } from '../timeline-event-item/timeline-event-item';
import { FilterGroup } from '../../../../shared/components/filter-group/filter-group';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { TimelineSkeleton } from '../timeline-skeleton/timeline-skeleton';
import { TimelinePresenter } from './timeline-presenter';
import { CANON_VIEWS } from '../../../../shared/models/canon';

/** One renderable facet filter group in the advanced filters panel. */
interface FacetGroup {
  readonly key: FacetKey;
  readonly label: string;
  readonly options: readonly FilterTreeNode[];
  readonly selected: readonly string[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-timeline',
  imports: [TimelineEventItem, FilterGroup, ErrorState, TimelineSkeleton],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
  providers: [TimelinePresenter],
})
export class Timeline {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly presenter = inject(TimelinePresenter);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly views = CANON_VIEWS;

  readonly sourceIds = input<readonly number[] | null>(null);
  readonly trackedUnitScope = input<TrackedScopeMap | null>(null);
  readonly heading = input('Galactic Timeline');
  readonly description = input(
    'Scroll through the history of the galaxy, filtered by continuity and your chosen events, sources, characters, and more.',
  );

  readonly filters = this.presenter.filters;
  protected readonly advancedOpen = this.presenter.advancedOpen;
  protected readonly facetOptions = this.presenter.facetOptions;

  /** Non-empty facet filter groups rendered by the advanced filters panel. */
  protected readonly facetGroups = computed<readonly FacetGroup[]>(() => {
    const options = this.facetOptions();
    const selected = this.filters();
    return (
      [
        { key: 'sources', label: 'Source', options: options.sources, selected: selected.sources },
        {
          key: 'locations',
          label: 'Location',
          options: options.locations,
          selected: selected.locations,
        },
        {
          key: 'characters',
          label: 'Characters',
          options: options.characters,
          selected: selected.characters,
        },
        {
          key: 'vehicles',
          label: 'Vehicles',
          options: options.vehicles,
          selected: selected.vehicles,
        },
      ] as const
    ).filter((group) => group.options.length > 0);
  });

  protected readonly sourceChipsByEvent = this.presenter.sourceChipsByEvent;
  protected readonly activeFacetCount = this.presenter.activeFacetCount;
  protected readonly filteredEvents = this.presenter.filteredEvents;
  protected readonly hasActiveFilters = this.presenter.hasActiveFilters;
  protected readonly isLoading = this.presenter.isLoading;
  protected readonly eventsError = this.presenter.eventsError;

  constructor() {
    this.presenter.applyViewParam(this.route.snapshot.queryParamMap);

    this.route.queryParamMap
      .pipe(
        filter((params) => params !== this.route.snapshot.queryParamMap),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((params) => this.presenter.applyViewParam(params));

    effect(() => {
      this.presenter.sourceIds.set(this.sourceIds());
    });

    effect(() => {
      this.presenter.trackedUnitScope.set(this.trackedUnitScope());
    });
  }

  selectView(view: CanonView): void {
    this.presenter.selectView(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  toggleAdvanced(): void {
    this.presenter.toggleAdvanced();
  }

  updateFilter(key: FacetKey, value: readonly string[]): void {
    this.presenter.updateFilter(key, value);
  }

  onToggleFacet(event: ToggleFacetEvent): void {
    this.presenter.onToggleFacet(event);
  }

  clearFilters(): void {
    this.presenter.clearFilters();
  }

  retryLoad(): void {
    this.presenter.retryLoad();
  }
}
