import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { filter } from 'rxjs';
import { CANON_VIEWS, CanonView, matchesCanonView } from '../../../../shared/models/canon';
import {
  collectFacetOptions,
  createEmptyFilters,
  FacetKey,
  matchesFilters,
  SourceFilterChip,
  sourceChipsForEvent,
  TimelineFilters,
} from '../../models/timeline-filters';
import { CatalogEventService } from '../../../catalog/services/catalog-event.service';
import { CharacterService } from '../../../catalog/services/character.service';
import { GalaxyService } from '../../../catalog/services/galaxy.service';
import { VehicleService } from '../../../catalog/services/vehicle.service';
import { SourceMaterialService } from '../../../catalog/services/source-material.service';
import { NavPreferencesService } from '../../../../shared/services/nav-preferences/nav-preferences.service';
import { LoggerService } from '../../../../core/services/logging/logger.service';
import { TimelineEventsService } from '../../services/timeline-events.service';
import { depictionIsTracked, TrackedScopeMap } from '../../../../shared/models/tracking-selection';
import { ToggleFacetEvent } from '../timeline-event-item/timeline-event-item';

// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped
@Injectable()
export class TimelinePresenter {
  private readonly eventsService = inject(TimelineEventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly characterService = inject(CharacterService);
  private readonly galaxyService = inject(GalaxyService);
  private readonly vehicleService = inject(VehicleService);
  private readonly sourceMaterialService = inject(SourceMaterialService);
  private readonly catalogEvent = inject(CatalogEventService);
  private readonly logger = inject(LoggerService);
  private readonly navPrefs = inject(NavPreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sourceIds = signal<readonly number[] | null>(null);
  readonly trackedUnitScope = signal<TrackedScopeMap | null>(null);

  readonly filters = signal<TimelineFilters>(createEmptyFilters());
  readonly advancedOpen = signal(false);

  readonly events = computed(() => this.eventsService.events() ?? []);

  readonly sourceFilteredEvents = computed(() => {
    const ids = this.sourceIds();
    if (ids === null) {
      return this.events();
    }
    const scope = this.trackedUnitScope();
    return this.events().filter((event) =>
      event.sources.some(
        (source) =>
          source.sourceId !== undefined &&
          ids.includes(source.sourceId) &&
          (scope === null || depictionIsTracked(scope, source.sourceId, source.unit?.id)),
      ),
    );
  });

  readonly continuityEvents = computed(() =>
    this.sourceFilteredEvents().filter((event) =>
      matchesCanonView(event.canon, this.filters().canonView),
    ),
  );

  /**
   * Every galaxy-hierarchy place name (across all five levels), sorted and
   * deduplicated — the facet options for the location filter.
   */
  readonly galaxyNames = computed(() => {
    const names = new Set<string>();
    for (const region of this.galaxyService.regions() ?? []) {
      names.add(region.name);
    }
    for (const subregion of this.galaxyService.subregions() ?? []) {
      names.add(subregion.name);
    }
    for (const system of this.galaxyService.planetSystems() ?? []) {
      names.add(system.name);
    }
    for (const planet of this.galaxyService.planets() ?? []) {
      names.add(planet.name);
    }
    for (const location of this.galaxyService.planetLocations()) {
      names.add(location.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  });

  readonly facetOptions = computed(() => {
    const eventFacets = collectFacetOptions(
      this.continuityEvents(),
      (materialId, containerUnitId) => {
        const units = this.sourceMaterialService.getUnitCache(materialId).data() ?? [];
        const container = units.find((u) => u.id === containerUnitId);
        if (!container) {
          return undefined;
        }
        return container.title ?? `${container.unitType} ${container.number}`;
      },
    );
    const characters = this.characterService.characters();
    const vehicles = this.vehicleService.vehicles();
    return {
      ...eventFacets,
      characters: (characters ?? []).map((c) => ({ value: c.name, label: c.name })),
      locations: this.galaxyNames().map((name) => ({ value: name, label: name })),
      vehicles: (vehicles ?? []).map((v) => ({ value: v.name, label: v.name })),
    };
  });

  readonly sourceChipsByEvent = computed(() => {
    const sources = this.facetOptions().sources;
    const chips = new Map<number, readonly SourceFilterChip[]>();
    for (const event of this.continuityEvents()) {
      chips.set(event.id, sourceChipsForEvent(event, sources));
    }
    return chips;
  });

  readonly activeFacetCount = computed(() => {
    const filters = this.filters();
    return (
      (filters.sources.length > 0 ? 1 : 0) +
      (filters.locations.length > 0 ? 1 : 0) +
      (filters.characters.length > 0 ? 1 : 0) +
      (filters.vehicles.length > 0 ? 1 : 0)
    );
  });

  readonly filteredEvents = computed(() =>
    this.sourceFilteredEvents()
      .filter((event) => matchesFilters(event, this.filters()))
      .sort(
        (a, b) =>
          a.yearStart - b.yearStart || a.sequence - b.sequence || a.title.localeCompare(b.title),
      ),
  );

  readonly hasActiveFilters = computed(() => this.activeFacetCount() > 0);
  readonly isLoading = computed(() => this.eventsService.loading() && this.events().length === 0);
  readonly eventsError = computed(() => this.eventsService.error());

  constructor() {
    this.applyViewParam(this.route.snapshot.queryParamMap);

    this.eventsService.getEvents();

    this.route.queryParamMap
      .pipe(
        filter((params) => params !== this.route.snapshot.queryParamMap),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((params) => this.applyViewParam(params));

    this.catalogEvent.events$
      .pipe(
        filter((e) => e.entity === 'source-materials' || e.entity === 'source-material-units'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.eventsService.invalidate());

    effect(() => {
      this.characterService.fetchCharacters();
      this.galaxyService.fetchAll();
      this.vehicleService.fetchVehicles();
    });

    effect(() => {
      for (const event of this.continuityEvents()) {
        for (const source of event.sources) {
          if (source.sourceId !== undefined) {
            this.sourceMaterialService.getUnitCache(source.sourceId).fetch();
          }
        }
      }
    });

    this.logger.debug('[Timeline] Component initialized');
  }

  /**
   * Applies the canon-view filter from a query-parameter map.
   * @param params - Current route query parameters.
   */
  applyViewParam(params: ParamMap): void {
    const view = params.get('view');
    if (view && (CANON_VIEWS as readonly string[]).includes(view)) {
      this.filters.update((filters) => ({ ...filters, canonView: view as CanonView }));
      this.navPrefs.setTimelineView(view);
    }
  }

  /**
   * Switches the timeline to the given canon view and persists the preference.
   * @param view - Canon view to activate.
   */
  selectView(view: CanonView): void {
    this.filters.update((filters) => ({ ...filters, canonView: view }));
    this.navPrefs.setTimelineView(view);
    this.logger.info('[Timeline] View changed', { view });
  }

  /** Toggles the advanced-filter panel open or closed. */
  toggleAdvanced(): void {
    this.advancedOpen.update((isOpen) => !isOpen);
  }

  /**
   * Replaces the current values for a single facet filter.
   * @param key - Facet to update (e.g. sources, characters).
   * @param value - Selected values to apply.
   */
  updateFilter(key: FacetKey, value: readonly string[]): void {
    this.logger.debug('[Timeline] Filter updated', { key, count: value.length });
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  /**
   * Toggles the given facet values — adds them if absent, removes them if all present.
   * @param param0 - Destructured toggle event with key and values.
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

  /** Resets all facet filters to their empty defaults. */
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

  /** Invalidates cached events and triggers a fresh load. */
  retryLoad(): void {
    this.eventsService.invalidate();
  }
}
