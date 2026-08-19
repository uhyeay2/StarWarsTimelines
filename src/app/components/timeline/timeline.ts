/**
 * @fileoverview Main timeline component that renders a filterable, chronologically
 * ordered list of Star Wars timeline events.
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

import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { catchError, debounceTime, filter, of, startWith, Subject, switchMap } from 'rxjs';
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
import { AuthService } from '../../services/auth/auth.service';
import { CatalogEventService } from '../../services/catalog-event.service';
import { CatalogService } from '../../services/catalog/catalog.service';
import { LibraryService } from '../../services/library/library.service';
import { LoggerService } from '../../services/logging/logger.service';
import { TimelineEventsService } from '../../services/timeline-events/timeline-events.service';
import { TimelineEvent } from '../../models/timeline-event';
import { TimelineEventItem, ToggleFacetEvent } from '../timeline-event-item/timeline-event-item';
import { FilterGroup } from '../filter-group/filter-group';

/** Debounce interval (ms) for SSE-driven event refreshes. */
const SSE_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-timeline',
  imports: [TimelineEventItem, FilterGroup],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class Timeline {
  // ─── Injected services ──────────────────────────────────────────────────

  /** Service for fetching and caching timeline events. */
  private readonly eventsService = inject(TimelineEventsService);

  /** Authentication service for the current user. */
  private readonly auth = inject(AuthService);

  /** Library service for tracking/untracking source materials. */
  private readonly libraryService = inject(LibraryService);

  /** Active route for reading/writing the `view` query param. */
  private readonly route = inject(ActivatedRoute);

  /** Router for navigating with query params. */
  private readonly router = inject(Router);

  /** Catalog service for characters, locations, and vehicles. */
  private readonly catalog = inject(CatalogService);

  /** SSE service for real-time catalog change notifications. */
  private readonly catalogEvent = inject(CatalogEventService);

  /** Centralized logger for analytics and diagnostics. */
  private readonly logger = inject(LoggerService);

  // ─── Constants ──────────────────────────────────────────────────────────

  /** Available canon view options for the view toggle. */
  protected readonly views = CANON_VIEWS;

  // ─── Event data ─────────────────────────────────────────────────────────

  /**
   * Subject that triggers an event reload when nexted.
   *
   * SSE events and manual refreshes push to this subject. The pipeline
   * debounces rapid emissions to avoid redundant network requests.
   */
  private readonly refreshTrigger$ = new Subject<void>();

  /**
   * Reactive signal of all timeline events from the server.
   *
   * Initialized from the refresh pipeline which debounces SSE-driven
   * reloads. Errors are caught and result in an empty list.
   */
  protected readonly events = toSignal(
    this.refreshTrigger$.pipe(
      debounceTime(SSE_DEBOUNCE_MS),
      startWith(null as null),
      switchMap(() =>
        this.eventsService.getEvents$().pipe(catchError(() => of([] as readonly TimelineEvent[]))),
      ),
    ),
    { initialValue: [] },
  );

  // ─── Filter state ───────────────────────────────────────────────────────

  /** Current filter configuration including canon view and facet selections. */
  readonly filters = signal<TimelineFilters>(createEmptyFilters());

  // ─── Auth / user state ──────────────────────────────────────────────────

  /** The currently authenticated user, or `null`. */
  private readonly user = this.auth.currentUser;

  /**
   * The tracked library items for the current user.
   *
   * Updated optimistically on add/update operations and reconciled
   * with the server response.
   */
  private readonly tracked = signal<readonly LibraryItem[]>([]);

  // ─── Component inputs ───────────────────────────────────────────────────

  /**
   * When provided, only events whose source ID is in this list are shown.
   * Used by {@link KnownTimelinePage} to display a per-source timeline.
   * `null` or empty means show all events.
   */
  readonly sourceIds = input<readonly string[] | null>(null);

  /** Page heading displayed above the timeline. */
  readonly heading = input('Galactic Timeline');

  /** Page description paragraph displayed below the heading. */
  readonly description = input(
    'Scroll through the history of the galaxy, filtered by continuity and your chosen events, sources, characters, and more.',
  );

  // ─── Computed state ─────────────────────────────────────────────────────

  /** Whether the user is currently authenticated. */
  readonly isLoggedIn = computed(() => this.user() !== null);

  /** The current user's ID, or `null` if not logged in. */
  private readonly userId = computed(() => this.user()?.id ?? null);

  /**
   * Map of source material ID to its tracking status.
   *
   * Used to display status badges and selects on event cards.
   */
  readonly sourceStatus = computed(() => {
    const statusBySourceId: Record<string, TrackingStatus> = {};
    for (const item of this.tracked()) {
      statusBySourceId[item.id] = item.status;
    }
    return statusBySourceId;
  });

  /**
   * Events filtered by source IDs (when in Known Timeline mode).
   *
   * Returns all events when `sourceIds` is null/empty, otherwise
   * filters to only events from matching source materials.
   */
  protected readonly sourceFilteredEvents = computed(() => {
    const ids = this.sourceIds();
    if (ids === null || ids.length === 0) {
      return this.events();
    }
    return this.events().filter(
      (event) => event.source.sourceId !== undefined && ids.includes(event.source.sourceId),
    );
  });

  /**
   * Events filtered through the canon view selector.
   *
   * Further narrows `sourceFilteredEvents` to only include events
   * that match the currently selected canon view (Canon, Legends, or both).
   */
  protected readonly continuityEvents = computed(() =>
    this.sourceFilteredEvents().filter((event) => matchesCanonView(event.canon, this.filters().canonView)),
  );

  /**
   * Facet options derived from the current event set plus catalog data.
   *
   * Combines source, location, character, and vehicle facets from events
   * with full catalog data so that catalog-only entries (not in any event)
   * are still filterable. Cached to avoid recomputation when inputs are
   * unchanged.
   */
  protected readonly facetOptions = computed(() => {
    const eventFacets = collectFacetOptions(this.continuityEvents());
    const characters = this.catalog.characters();
    const locations = this.catalog.locations();
    const vehicles = this.catalog.vehicles();
    return {
      ...eventFacets,
      characters: (characters ?? []).map((c) => ({ value: c.name, label: c.name })),
      locations: (locations ?? []).map((l) => ({ value: l.name, label: l.name })),
      vehicles: (vehicles ?? []).map((v) => ({ value: v.name, label: v.name })),
    };
  });

  /**
   * Map of event ID to its source filter chips.
   *
   * Each event gets a list of {@link SourceFilterChip} objects representing
   * the medium, material, and optional group-level filter chips.
   */
  protected readonly sourceChipsByEvent = computed(() => {
    const sources = this.facetOptions().sources;
    const chips = new Map<string, readonly SourceFilterChip[]>();
    for (const event of this.continuityEvents()) {
      chips.set(event.id, sourceChipsForEvent(event, sources));
    }
    return chips;
  });

  /** Whether the advanced filter panel is expanded. */
  protected readonly advancedOpen = signal(false);

  /** Number of active facet filter categories (non-canon). */
  protected readonly activeFacetCount = computed(() => {
    const filters = this.filters();
    return (
      (filters.sources.length > 0 ? 1 : 0) +
      (filters.locations.length > 0 ? 1 : 0) +
      (filters.characters.length > 0 ? 1 : 0) +
      (filters.vehicles.length > 0 ? 1 : 0)
    );
  });

  /**
   * Final filtered and sorted event list.
   *
   * Applies source filtering, canon view, and all facet filters, then
   * sorts chronologically by in-universe year.
   */
  protected readonly filteredEvents = computed(() =>
    this.sourceFilteredEvents()
      .filter((event) => matchesFilters(event, this.filters()))
      .sort((a, b) => a.year - b.year),
  );

  /** Whether any facet filter is currently active. */
  protected readonly hasActiveFilters = computed(() => this.activeFacetCount() > 0);

  /** Whether the events list is currently loading (initial load). */
  protected readonly isLoading = computed(() => this.eventsService.loading() && this.events().length === 0);

  /** The current error message from the events service, or `null`. */
  protected readonly eventsError = computed(() => this.eventsService.error());

  // ─── Constructor / effects ──────────────────────────────────────────────

  constructor() {
    // Read the initial `view` query param and set the canon filter.
    this.applyViewParam(this.route.snapshot.queryParamMap);

    // Subscribe to ongoing query param changes for the view filter.
    this.route.queryParamMap
      .pipe(
        filter((params) => params !== this.route.snapshot.queryParamMap),
      )
      .subscribe((params) => this.applyViewParam(params));

    // Subscribe to SSE-driven catalog change notifications for source
    // materials and trigger a debounced event refresh.
    this.catalogEvent.events$
      .pipe(
        filter((e) => e.entity === 'source-materials' || e.entity === 'source-material-units'),
      )
      .subscribe(() => this.refreshTrigger$.next());

    // Fetch catalog data when the user changes (or on initial load).
    effect(() => {
      this.user();
      this.catalog.fetchCharacters();
      this.catalog.fetchLocations();
      this.catalog.fetchVehicles();
    });

    // Subscribe to tracked library items for the current user.
    this.trackTrackedItems();

    this.logger.debug('[Timeline] Component initialized');
  }

  // ─── Public methods ─────────────────────────────────────────────────────

  /**
   * Applies the canon view from a query param map.
   *
   * @param params  The current route query parameters.
   */
  private applyViewParam(params: ParamMap): void {
    const view = params.get('view');
    if (view && (CANON_VIEWS as readonly string[]).includes(view)) {
      this.filters.update((filters) => ({ ...filters, canonView: view as CanonView }));
    }
  }

  /**
   * Selects a canon view and updates the URL query parameter.
   *
   * @param view  The canon view to apply.
   */
  selectView(view: CanonView): void {
    this.filters.update((filters) => ({ ...filters, canonView: view }));
    this.logger.info('[Timeline] View changed', { view });
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Toggles the advanced filter panel open/closed. */
  toggleAdvanced(): void {
    this.advancedOpen.update((isOpen) => !isOpen);
  }

  /**
   * Updates a facet filter category with the given values.
   *
   * @param key    The facet category to update.
   * @param value  The new selected values for that category.
   */
  updateFilter(key: FacetKey, value: readonly string[]): void {
    this.logger.debug('[Timeline] Filter updated', { key, count: value.length });
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  /**
   * Handles a toggle event from a facet chip on an event card.
   *
   * Adds values to the filter if not all are currently selected,
   * or removes them if all are already selected.
   *
   * @param event  The toggle facet event payload.
   */
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

  /**
   * Adds an event's source material to the user's library.
   *
   * Optimistically updates the tracked signal with a temporary item
   * for instant UI feedback, then reconciles with the server response.
   *
   * @param event  The timeline event whose source to add.
   */
  addToLibrary(event: TimelineEvent): void {
    const userId = this.userId();
    const sourceId = event.source.sourceId;
    if (!userId || !sourceId) {
      return;
    }

    // Optimistic update: immediately add a temporary tracked item
    const tempItem: LibraryItem = {
      id: sourceId,
      title: event.source.title,
      medium: event.source.medium,
      status: 'Wish Listed',
      favorite: false,
    };
    this.tracked.update((items) => [...items, tempItem]);
    this.logger.info('[Timeline] Adding to library', { sourceId });

    this.libraryService
      .addTracked(userId, {
        id: sourceId,
        title: event.source.title,
        medium: event.source.medium,
      })
      .subscribe({
        next: (items) => this.tracked.set(items),
        error: () => {
          // Revert optimistic update on failure
          this.tracked.update((items) => items.filter((i) => i.id !== sourceId));
        },
      });
  }

  /**
   * Updates the tracking status of an event's source material.
   *
   * Optimistically updates the tracked signal for instant feedback,
   * then reconciles with the server response.
   *
   * @param event   The timeline event whose status to update.
   * @param status  The new tracking status.
   */
  updateStatus(event: TimelineEvent, status: TrackingStatus): void {
    const userId = this.userId();
    const sourceId = event.source.sourceId;
    if (!userId || !sourceId) {
      return;
    }

    // Optimistic update: immediately change status locally
    const previousItems = this.tracked();
    this.tracked.update((items) =>
      items.map((item) => (item.id === sourceId ? { ...item, status } : item)),
    );
    this.logger.info('[Timeline] Status updated', { sourceId, status });

    this.libraryService
      .setStatus(userId, sourceId, status)
      .subscribe({
        next: (items) => this.tracked.set(items),
        error: () => {
          // Revert optimistic update on failure
          this.tracked.set(previousItems);
        },
      });
  }

  /** Clears all facet filters while preserving the canon view selection. */
  clearFilters(): void {
    this.logger.info('[Timeline] Filters cleared');
    this.filters.update((filters) => ({
      ...filters,
      sources: [],
      locations: [],
      characters: [],
      vehicles: [],
    }));
  }

  /** Retries loading events after an error. */
  retryLoad(): void {
    this.refreshTrigger$.next();
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  /**
   * Subscribes to tracked library items for the current user.
   *
   * Uses the effect's `onCleanup` callback for automatic cleanup when
   * the user ID changes or the component is destroyed.
   */
  private trackTrackedItems(): void {
    effect((onCleanup) => {
      const userId = this.userId();
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
}
