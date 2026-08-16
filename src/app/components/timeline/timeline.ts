import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { CANON_VIEWS, CanonView, matchesCanonView } from '../../models/canon';
import { LibraryItem } from '../../models/library-item';
import {
  collectFacetOptions,
  createEmptyFilters,
  FacetKey,
  matchesFilters,
  SourceFilterChip,
  sourceChipsForEvent,
  TimelineFilters,
} from '../../models/timeline-filters';
import { TrackingStatus } from '../../models/tracking-status';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { TimelineEvent } from '../../models/timeline-event';
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
  private readonly auth = inject(AuthService);
  private readonly libraryService = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly views = CANON_VIEWS;
  protected readonly events = toSignal(this.eventsService.getEvents(), { initialValue: [] });
  readonly filters = signal<TimelineFilters>(createEmptyFilters());
  private readonly user = toSignal(this.auth.currentUser$);
  private readonly tracked = signal<readonly LibraryItem[]>([]);

  readonly sourceIds = input<readonly string[] | null>(null);
  readonly heading = input('Galactic Timeline');
  readonly description = input(
    'Scroll through the history of the galaxy, filtered by continuity and your chosen events, sources, characters, and more.',
  );

  readonly isLoggedIn = computed(() => this.user() !== null);
  private readonly userId = computed(() => this.user()?.id ?? null);

  readonly sourceStatus = computed(() => {
    const statusBySourceId: Record<string, TrackingStatus> = {};
    for (const item of this.tracked()) {
      statusBySourceId[item.id] = item.status;
    }
    return statusBySourceId;
  });

  constructor() {
    this.applyViewParam(this.route.snapshot.queryParamMap);
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.applyViewParam(params));

    effect((onCleanup) => {
      const userId = this.user()?.id ?? null;
      if (!userId) {
        this.tracked.set([]);
        return;
      }
      const subscription = this.libraryService
        .getTracked(userId)
        .subscribe((items) => this.tracked.set(items));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  private applyViewParam(params: ParamMap): void {
    const view = params.get('view');
    if (view && (CANON_VIEWS as readonly string[]).includes(view)) {
      this.filters.update((filters) => ({ ...filters, canonView: view as CanonView }));
    }
  }

  protected readonly sourceFilteredEvents = computed(() => {
    const ids = this.sourceIds();
    if (ids === null || ids.length === 0) {
      return this.events();
    }
    return this.events().filter(
      (event) => event.source.sourceId !== undefined && ids.includes(event.source.sourceId),
    );
  });

  protected readonly continuityEvents = computed(() =>
    this.sourceFilteredEvents().filter((event) => matchesCanonView(event.canon, this.filters().canonView)),
  );

  protected readonly facetOptions = computed(() => collectFacetOptions(this.continuityEvents()));

  protected readonly sourceChipsByEvent = computed(() => {
    const sources = this.facetOptions().sources;
    const chips = new Map<string, readonly SourceFilterChip[]>();
    for (const event of this.continuityEvents()) {
      chips.set(event.id, sourceChipsForEvent(event, sources));
    }
    return chips;
  });

  protected readonly advancedOpen = signal(false);

  protected readonly activeFacetCount = computed(() => {
    const filters = this.filters();
    return (
      (filters.sources.length > 0 ? 1 : 0) +
      (filters.locations.length > 0 ? 1 : 0) +
      (filters.characters.length > 0 ? 1 : 0) +
      (filters.vehicles.length > 0 ? 1 : 0)
    );
  });

  protected readonly filteredEvents = computed(() =>
    this.sourceFilteredEvents()
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

  onToggleFacet({ key, values }: ToggleFacetEvent): void {
    this.filters.update((filters) => {
      const current = filters[key];
      const allSelected = values.every((value) => current.includes(value));
      const next = allSelected
        ? current.filter((value) => !values.includes(value))
        : [...new Set([...current, ...values])];
      return { ...filters, [key]: next };
    });
  }

  addToLibrary(event: TimelineEvent): void {
    const userId = this.userId();
    const sourceId = event.source.sourceId;
    if (!userId || !sourceId) {
      return;
    }
    this.libraryService
      .addTracked(userId, {
        id: sourceId,
        title: event.source.title,
        medium: event.source.medium,
      })
      .subscribe((items) => this.tracked.set(items));
  }

  updateStatus(event: TimelineEvent, status: TrackingStatus): void {
    const userId = this.userId();
    const sourceId = event.source.sourceId;
    if (!userId || !sourceId) {
      return;
    }
    this.libraryService
      .setStatus(userId, sourceId, status)
      .subscribe((items) => this.tracked.set(items));
  }

  clearFilters(): void {
    this.filters.update((filters) => ({
      ...filters,
      sources: [],
      locations: [],
      characters: [],
      vehicles: [],
    }));
  }
}
