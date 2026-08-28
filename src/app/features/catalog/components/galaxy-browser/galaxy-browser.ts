/**
 * @fileoverview Browser-only half of the galaxy catalog page: the header,
 * view tabs, search, nested trees, and empty-status footer. It owns the
 * browsing state (active view, search term, expansion) and reads the galaxy
 * service caches, but performs no mutations itself — every edit, add, and
 * delete request is re-emitted so the parent editor can own the forms.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GalaxyService } from '../../services/galaxy.service';
import {
  ApiPlanet,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../../shared/models/api-galaxy';
import {
  GalaxyCatalogHost,
  GalaxyDeleteTarget,
  GalaxyKind,
  GalaxyLocationEdit,
  GalaxyLocationNode,
  GalaxyPlanetNode,
  GalaxyRegionNode,
  GalaxySubregionNode,
  GalaxySystemNode,
  GalaxyView,
} from '../../models/galaxy-catalog-models';
import { GalaxyPlanetSystemList } from '../galaxy-planet-system-list/galaxy-planet-system-list';
import { GalaxyRegionList } from '../galaxy-region-list/galaxy-region-list';
import { GalaxySubregionList } from '../galaxy-subregion-list/galaxy-subregion-list';

/**
 * Presents the galaxy hierarchy as three browsing views — Regions, Subregions,
 * and Planet systems — each a searchable list of expandable rows:
 *
 * - **Regions**: Region -> Subregions -> Planet systems -> Planets -> Locations.
 * - **Subregions**: Subregion -> Planet systems -> Planets -> Locations, with
 *   the region links shown as chips.
 * - **Planet systems**: Planet system -> Planets -> Locations, with the
 *   subregion links shown as chips.
 *
 * The component holds the browsing state (active view, search term, expanded
 * rows) and renders the header, tabs, trees, and empty-status footer. Row
 * interactions are delegated through the {@link GalaxyCatalogHost} self-client
 * and re-emitted as outputs; the parent editor turns them into form state and
 * delete confirmations. The galaxy data itself comes from {@link GalaxyService}
 * caches that the parent already fetched.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-browser',
  imports: [FormsModule, GalaxyRegionList, GalaxySubregionList, GalaxyPlanetSystemList],
  templateUrl: './galaxy-browser.html',
  styleUrl: './galaxy-browser.scss',
})
export class GalaxyBrowser implements GalaxyCatalogHost {
  /** Whether the current viewer may edit the catalogs. */
  readonly admin = input(false);

  /** Whether a mutation is in flight, disabling the header Add button. */
  readonly busy = input(false);

  private readonly galaxy = inject(GalaxyService);

  /**
   * Typed self-reference passed as the `host` input to the extracted tree
   * lists so they can reach this component's browsing state without a large
   * binding API for every row interaction.
   */
  readonly api: GalaxyBrowser = this;

  /** The three top-level browsing views shown as a segmented control. */
  readonly views = [
    { key: 'regions', label: 'Regions', noun: 'region' },
    { key: 'subregions', label: 'Subregions', noun: 'subregion' },
    { key: 'systems', label: 'Planet systems', noun: 'planet system' },
  ] as const satisfies readonly { key: GalaxyView; label: string; noun: string }[];

  // ─── View state ──────────────────────────────────────────────────────────

  /** The active browsing view. */
  readonly activeView = signal<GalaxyView>('regions');

  /** Search term filtering the active view's rows. */
  readonly searchTerm = signal('');

  /** The metadata of the active view. */
  readonly activeMeta = computed(
    () => this.views.find((view) => view.key === this.activeView()) ?? this.views[0]!,
  );

  /** Header Add button label for the active view. */
  readonly addLabel = computed(() => `+ Add ${this.activeMeta().noun}`);

  // ─── Editor requests ─────────────────────────────────────────────────────

  /** Requests an add at the active view's root level. */
  readonly addRegion = output<void>();

  /** Requests an add-subregion, optionally pre-selecting the owning region. */
  readonly addSubregion = output<number | null>();

  /** Requests an add-planet-system, optionally pre-selecting the owning subregion. */
  readonly addSystem = output<number | null>();

  /** Requests an add-planet scoped under one planet system. */
  readonly addPlanet = output<number>();

  /** Requests an add-location scoped under one planet. */
  readonly addLocation = output<number>();

  /** Requests an edit form for a region row. */
  readonly editRegion = output<ApiRegion>();

  /** Requests an edit form for a subregion row. */
  readonly editSubregion = output<ApiSubregion>();

  /** Requests an edit form for a planet system row. */
  readonly editSystem = output<ApiPlanetSystem>();

  /** Requests an edit form for a planet row. */
  readonly editPlanet = output<ApiPlanet>();

  /** Requests an edit form for a planet location row. */
  readonly editLocation = output<GalaxyLocationEdit>();

  /** Requests a delete-confirmation prompt for one galaxy row. */
  readonly remove = output<GalaxyDeleteTarget>();

  // ─── Nested trees (one per root level) ───────────────────────────────────

  /**
   * Regions each nesting the subregions linked to them, each nesting the
   * planet systems linked to that subregion, each nesting its planets and
   * their locations.
   */
  private readonly regionTree = computed<readonly GalaxyRegionNode[]>(() =>
    (this.galaxy.regions() ?? [])
      .map((region) => ({
        region,
        subregions: (this.galaxy.subregions() ?? [])
          .filter((subregion) => subregion.regions.some((link) => link.id === region.id))
          .map((subregion) => this.buildSubregionNode(subregion))
          .sort((a, b) => a.subregion.name.localeCompare(b.subregion.name)),
      }))
      .sort((a, b) => a.region.name.localeCompare(b.region.name)),
  );

  /**
   * Subregions each nesting the planet systems linked to them, each nesting
   * its planets and their locations.
   */
  private readonly subregionTree = computed<readonly GalaxySubregionNode[]>(() =>
    (this.galaxy.subregions() ?? [])
      .map((subregion) => this.buildSubregionNode(subregion))
      .sort((a, b) => a.subregion.name.localeCompare(b.subregion.name)),
  );

  /** Planet systems each nesting their planets and those planets' locations. */
  private readonly systemTree = computed<readonly GalaxySystemNode[]>(() =>
    (this.galaxy.planetSystems() ?? [])
      .map((system) => this.buildSystemNode(system))
      .sort((a, b) => a.system.name.localeCompare(b.system.name)),
  );

  // ─── Search ──────────────────────────────────────────────────────────────

  private readonly term = computed(() => this.searchTerm().trim().toLowerCase());

  /**
   * Whether the term matches any of the given values. An empty term matches
   * everything.
   *
   * @param values  The nullable text fields to compare against.
   * @returns `true` when the term is empty or present in any value.
   */
  private matchesTerm(...values: readonly (string | null)[]): boolean {
    const term = this.term();
    if (term.length === 0) {
      return true;
    }
    return values.some((value) => value !== null && value.toLowerCase().includes(term));
  }

  /** True when the region row or any nested descendant matches the term. */
  private regionMatches(node: GalaxyRegionNode): boolean {
    return (
      this.matchesTerm(node.region.name, node.region.description) ||
      node.subregions.some((subregion) => this.subregionMatches(subregion))
    );
  }

  /** True when the subregion row or any nested descendant matches the term. */
  private subregionMatches(node: GalaxySubregionNode): boolean {
    return (
      this.matchesTerm(
        node.subregion.name,
        node.subregion.sectorType,
        node.subregion.description,
      ) ||
      node.subregion.regions.some((link) => this.matchesTerm(link.name)) ||
      node.systems.some((system) => this.systemMatches(system))
    );
  }

  /** True when the system row or any nested descendant matches the term. */
  private systemMatches(node: GalaxySystemNode): boolean {
    return (
      this.matchesTerm(node.system.name, node.system.coordinates, node.system.description) ||
      node.system.subregions.some((link) => this.matchesTerm(link.name)) ||
      node.planets.some((planet) => this.planetMatches(planet))
    );
  }

  /** True when the planet row or any surface location matches the term. */
  private planetMatches(node: GalaxyPlanetNode): boolean {
    return (
      this.matchesTerm(node.planet.name, node.planet.description) ||
      node.locations.some((location) => this.matchesTerm(location.name))
    );
  }

  /** Regions view rows, filtered by search term. */
  readonly filteredRegionRows = computed<readonly GalaxyRegionNode[]>(() =>
    this.regionTree().filter((node) => this.regionMatches(node)),
  );

  /** Subregions view rows, filtered by search term. */
  readonly filteredSubregionRows = computed<readonly GalaxySubregionNode[]>(() =>
    this.subregionTree().filter((node) => this.subregionMatches(node)),
  );

  /** Planet systems view rows, filtered by search term. */
  readonly filteredSystemRows = computed<readonly GalaxySystemNode[]>(() =>
    this.systemTree().filter((node) => this.systemMatches(node)),
  );

  /** Number of rows in the active view (unfiltered). */
  private readonly activeRowCount = computed(() => {
    switch (this.activeView()) {
      case 'subregions':
        return this.subregionTree().length;
      case 'systems':
        return this.systemTree().length;
      default:
        return this.regionTree().length;
    }
  });

  /** Footer message for empty results or an empty active view. */
  readonly statusMessage = computed<{ text: string; css: string; role: string } | null>(() => {
    const term = this.searchTerm().trim();
    const noun = this.activeMeta().noun;
    if (this.activeRowCount() > 0) {
      return null;
    }
    if (term) {
      return { text: `No ${noun}s match your search.`, css: 'form-status', role: 'status' };
    }
    return {
      text: `The galaxy catalog is empty. Add a ${noun} to begin.`,
      css: 'form-status',
      role: 'status',
    };
  });

  // ─── Expansion state ─────────────────────────────────────────────────────

  /** Row keys currently expanded, keyed as `"<level>-<id>"`. */
  readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** Whether a given tree node is currently expanded. */
  isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  /** Toggles one tree node's expanded state. */
  toggleExpanded(key: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /** Expands a planet row and warms its location cache for inline editing. */
  togglePlanet(planet: ApiPlanet): void {
    this.galaxy.getPlanetLocationCache(planet.id).fetch();
    this.toggleExpanded(`planet-${planet.id}`);
  }

  // ─── Tree builders ───────────────────────────────────────────────────────

  /** Builds a system node with its planets (and their locations). */
  private buildSystemNode(system: ApiPlanetSystem): GalaxySystemNode {
    const planets = this.galaxy.planets() ?? [];
    return {
      system,
      planets: [...planets]
        .filter((planet) => planet.planetSystemId === system.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((planet) => ({
          planet,
          locations: planet.locations.map((location) => ({
            id: location.id,
            name: location.name,
          })),
        })),
    };
  }

  /** Builds a subregion node with the systems linked to it. */
  private buildSubregionNode(subregion: ApiSubregion): GalaxySubregionNode {
    const systems = this.galaxy.planetSystems() ?? [];
    return {
      subregion,
      systems: [...systems]
        .filter((system) => system.subregions.some((link) => link.id === subregion.id))
        .map((system) => this.buildSystemNode(system))
        .sort((a, b) => a.system.name.localeCompare(b.system.name)),
    };
  }

  // ─── View switching ──────────────────────────────────────────────────────

  /** Selects the browsing view to render. */
  selectView(view: GalaxyView): void {
    this.activeView.set(view);
  }

  /** Emits the add request for the active view's root level. */
  addForActiveView(): void {
    if (this.activeView() === 'regions') {
      this.addRegion.emit();
    } else if (this.activeView() === 'subregions') {
      this.addSubregion.emit(null);
    } else {
      this.addSystem.emit(null);
    }
  }

  // ─── Host delegation ─────────────────────────────────────────────────────

  /** Whether the current viewer may edit the catalogs. */
  isAdmin(): boolean {
    return this.admin();
  }

  /** Forwards an edit request for a region row. */
  startEditRegion(region: ApiRegion): void {
    this.editRegion.emit(region);
  }

  /** Forwards an edit request for a subregion row. */
  startEditSubregion(subregion: ApiSubregion): void {
    this.editSubregion.emit(subregion);
  }

  /** Forwards an edit request for a planet system row. */
  startEditSystem(system: ApiPlanetSystem): void {
    this.editSystem.emit(system);
  }

  /** Forwards an edit request for a planet row. */
  startEditPlanet(planet: ApiPlanet): void {
    this.editPlanet.emit(planet);
  }

  /** Forwards an edit request for a planet location row. */
  startEditLocation(location: GalaxyLocationNode, planetId: number): void {
    this.editLocation.emit({ location, planetId });
  }

  /** Forwards a delete request for one galaxy row. */
  requestDelete(kind: GalaxyKind, id: number, name: string): void {
    this.remove.emit({ kind, id, name });
  }

  /** Forwards an add-subregion request, optionally pre-selecting a region. */
  openAddSubregion(regionId: number | null): void {
    this.addSubregion.emit(regionId);
  }

  /** Forwards an add-planet-system request, optionally pre-selecting a subregion. */
  openAddSystem(subregionId: number | null): void {
    this.addSystem.emit(subregionId);
  }

  /** Forwards an add-planet request scoped under one planet system. */
  openAddPlanet(systemId: number): void {
    this.addPlanet.emit(systemId);
  }

  /** Forwards an add-location request scoped under one planet. */
  openAddLocation(planetId: number): void {
    this.addLocation.emit(planetId);
  }
}
