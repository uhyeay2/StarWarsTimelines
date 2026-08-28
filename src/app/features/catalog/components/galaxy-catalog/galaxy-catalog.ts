import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { GalaxyService } from '../../services/galaxy.service';
import {
  ApiPlanet,
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
} from '../../../../shared/models/api-galaxy';
import { PlanetLocationType } from '../../../../shared/models/planet-location-type';
import { runOperation } from '../../../../shared/utils/async-operation';
import {
  GalaxyDeleteTarget,
  GalaxyItemFormState,
  GalaxyKind,
  GalaxyLocationNode,
} from '../../models/galaxy-catalog-models';
import { GalaxyBrowser } from '../galaxy-browser/galaxy-browser';
import { GalaxyItemDialog } from '../galaxy-item-dialog/galaxy-item-dialog';

/**
 * Admin catalog tab for the galaxy hierarchy. Renders the {@link GalaxyBrowser}
 * for browsing regions, subregions, and planet systems, and owns the page's
 * editor concerns on top of it:
 *
 * - the loading and error banner,
 * - the add/edit modal dialog projected over the browser,
 * - the delete-confirmation prompt,
 * - the galaxy mutations that surface server-side validation and conflict
 *   messages inline.
 *
 * The browser re-emits every row interaction and the header Add button as
 * outputs; the handlers here translate them into form state. Non-admins see
 * the read-only browsing lists.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-catalog',
  imports: [GalaxyBrowser, GalaxyItemDialog],
  templateUrl: './galaxy-catalog.html',
  styleUrl: './galaxy-catalog.scss',
})
export class GalaxyCatalog {
  readonly isAdmin = input<boolean>(false);

  private readonly galaxy = inject(GalaxyService);

  // ─── Loading state ───────────────────────────────────────────────────────

  readonly loading = computed(
    () =>
      this.galaxy.regionsLoading() ||
      this.galaxy.subregionsLoading() ||
      this.galaxy.planetSystemsLoading() ||
      this.galaxy.planetsLoading(),
  );

  readonly loadError = computed(
    () =>
      this.galaxy.regionsError() ??
      this.galaxy.subregionsError() ??
      this.galaxy.planetSystemsError() ??
      this.galaxy.planetsError(),
  );

  // ─── Form state ──────────────────────────────────────────────────────────

  readonly formState = signal<GalaxyItemFormState | null>(null);
  readonly formName = signal('');
  readonly formDescription = signal('');
  readonly formSectorType = signal('');
  readonly formCoordinates = signal('');
  readonly formType = signal<PlanetLocationType>('City');
  readonly formRegionIds = signal<readonly number[]>([]);
  readonly formSubregionIds = signal<readonly number[]>([]);
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);

  readonly sortedRegions = computed(() =>
    [...(this.galaxy.regions() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly sortedSubregions = computed(() =>
    [...(this.galaxy.subregions() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** The noun label of the level the inline form is editing or adding. */
  readonly formKindLabel = computed(() => {
    switch (this.formState()?.kind) {
      case 'region':
        return 'region';
      case 'subregion':
        return 'subregion';
      case 'planet-system':
        return 'planet system';
      case 'planet':
        return 'planet';
      case 'planet-location':
        return 'planet location';
      default:
        return '';
    }
  });

  /** Context sentence naming pre-selected link parents on a new row. */
  readonly formContextLabel = computed(() => {
    const state = this.formState();
    if (!state) {
      return '';
    }
    if (state.kind === 'subregion' && this.formRegionIds().length > 0) {
      return ` Linked to ${this.displayNames(this.formRegionIds(), this.sortedRegions())}.`;
    }
    if (state.kind === 'planet-system' && this.formSubregionIds().length > 0) {
      return ` Linked to ${this.displayNames(this.formSubregionIds(), this.sortedSubregions())}.`;
    }
    return '';
  });

  // ─── Add openers ─────────────────────────────────────────────────────────

  /** Opens the add-region form. */
  openAddRegion(): void {
    this.openForm({ kind: 'region', id: null, parentId: null });
  }

  /**
   * Opens the add-subregion form, optionally pre-selecting the region it is
   * added from so the many-to-many link is already attached.
   *
   * @param regionId  The region to pre-select, or `null` for an unlinked one.
   */
  openAddSubregion(regionId: number | null): void {
    this.openForm({ kind: 'subregion', id: null, parentId: regionId });
    if (regionId !== null) {
      this.formRegionIds.set([regionId]);
    }
  }

  /**
   * Opens the add-planet-system form, optionally pre-selecting the subregion
   * it is added from so the many-to-many link is already attached.
   *
   * @param subregionId  The subregion to pre-select, or `null` for an unlinked one.
   */
  openAddSystem(subregionId: number | null): void {
    this.openForm({ kind: 'planet-system', id: null, parentId: subregionId });
    if (subregionId !== null) {
      this.formSubregionIds.set([subregionId]);
    }
  }

  /** Opens the add-planet form scoped under one planet system. */
  openAddPlanet(systemId: number): void {
    this.openForm({ kind: 'planet', id: null, parentId: systemId });
  }

  /** Opens the add-location form scoped under one planet. */
  openAddLocation(planetId: number): void {
    this.openForm({ kind: 'planet-location', id: null, parentId: planetId });
  }

  // ─── Edit openers ────────────────────────────────────────────────────────

  /** Opens the edit form for a region. */
  startEditRegion(region: ApiRegion): void {
    this.openForm({ kind: 'region', id: region.id, parentId: null });
    this.formName.set(region.name);
    this.formDescription.set(region.description ?? '');
  }

  /** Opens the edit form for a subregion, preserving its region links. */
  startEditSubregion(subregion: ApiSubregion): void {
    this.openForm({ kind: 'subregion', id: subregion.id, parentId: null });
    this.formName.set(subregion.name);
    this.formSectorType.set(subregion.sectorType ?? '');
    this.formDescription.set(subregion.description ?? '');
    this.formRegionIds.set(subregion.regions.map((link) => link.id));
  }

  /** Opens the edit form for a planet system, preserving its subregion links. */
  startEditSystem(system: ApiPlanetSystem): void {
    this.openForm({ kind: 'planet-system', id: system.id, parentId: null });
    this.formName.set(system.name);
    this.formCoordinates.set(system.coordinates ?? '');
    this.formDescription.set(system.description ?? '');
    this.formSubregionIds.set(system.subregions.map((link) => link.id));
  }

  /** Opens the edit form for a planet. */
  startEditPlanet(planet: ApiPlanet): void {
    this.openForm({ kind: 'planet', id: planet.id, parentId: planet.planetSystemId });
    this.formName.set(planet.name);
    this.formDescription.set(planet.description ?? '');
  }

  /** Opens the edit form for a planet location. */
  startEditLocation(location: GalaxyLocationNode, planetId: number): void {
    this.openForm({ kind: 'planet-location', id: location.id, parentId: planetId });
    this.formName.set(location.name);
    const cached = this.galaxy
      .getPlanetLocationCache(planetId)
      .data()
      ?.find((entry) => entry.id === location.id);
    if (cached) {
      this.formType.set(cached.type);
      this.formCoordinates.set(cached.coordinates ?? '');
      this.formDescription.set(cached.description ?? '');
    }
  }

  // ─── Form plumbing ───────────────────────────────────────────────────────

  /** Resets every form signal and activates the given form state. */
  private openForm(state: GalaxyItemFormState): void {
    this.formError.set(null);
    this.formName.set('');
    this.formDescription.set('');
    this.formSectorType.set('');
    this.formCoordinates.set('');
    this.formType.set('City');
    this.formRegionIds.set([]);
    this.formSubregionIds.set([]);
    this.formState.set(state);
  }

  /** Dismisses the inline add/edit form. */
  cancelForm(): void {
    this.formState.set(null);
    this.formError.set(null);
  }

  /** The display names of the given ids, in the order of the given links. */
  private displayNames(
    ids: readonly number[],
    list: readonly { id: number; name: string }[],
  ): string {
    return ids
      .map((id) => list.find((entry) => entry.id === id)?.name)
      .filter((name): name is string => name !== undefined)
      .join(', ');
  }

  /** Validates the form and creates or replaces the active row. */
  submitForm(): void {
    const state = this.formState();
    if (!state || this.busy()) {
      return;
    }
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('A name is required.');
      return;
    }
    this.formError.set(null);
    const description = this.formDescription().trim() || null;
    const sectorType = this.formSectorType().trim() || null;
    const coordinates = this.formCoordinates().trim() || null;

    switch (state.kind) {
      case 'region':
        this.persist(
          state.id === null
            ? this.galaxy.createRegion(name, description)
            : this.galaxy.updateRegion(state.id, name, description),
        );
        break;
      case 'subregion':
        this.persist(
          state.id === null
            ? this.galaxy.createSubregion(name, sectorType, description, this.formRegionIds())
            : this.galaxy.updateSubregion(
                state.id,
                name,
                sectorType,
                description,
                this.formRegionIds(),
              ),
        );
        break;
      case 'planet-system':
        this.persist(
          state.id === null
            ? this.galaxy.createPlanetSystem(
                name,
                coordinates,
                description,
                this.formSubregionIds(),
              )
            : this.galaxy.updatePlanetSystem(
                state.id,
                name,
                coordinates,
                description,
                this.formSubregionIds(),
              ),
        );
        break;
      case 'planet':
        if (state.id === null && state.parentId === null) {
          return;
        }
        this.persist(
          state.id === null
            ? this.galaxy.createPlanet(state.parentId!, name, description)
            : this.galaxy.updatePlanet(state.id, name, description),
        );
        break;
      case 'planet-location':
        if (state.id === null && state.parentId === null) {
          return;
        }
        this.persist(
          state.id === null
            ? this.galaxy.createPlanetLocation(
                state.parentId!,
                name,
                this.formType(),
                coordinates,
                description,
              )
            : this.galaxy.updatePlanetLocation(
                state.id,
                name,
                this.formType(),
                coordinates,
                description,
              ),
        );
        break;
    }
  }

  /** Runs the active mutation and closes the form on success. */
  private persist<T>(operation: Observable<T>): void {
    runOperation({
      busy: this.busy,
      busyValue: true,
      idleValue: false,
      error: this.formError,
      operation,
      onSuccess: () => this.cancelForm(),
    });
  }

  // ─── Delete flow ─────────────────────────────────────────────────────────

  readonly deleteTarget = signal<GalaxyDeleteTarget | null>(null);

  /** Prompts the user to confirm deleting one galaxy row. */
  requestDelete(kind: GalaxyKind, id: number, name: string): void {
    this.formError.set(null);
    this.deleteTarget.set({ kind, id, name });
  }

  /** Dismisses the delete-confirmation prompt. */
  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.formError.set(null);
  }

  /** Deletes the row currently awaiting confirmation. */
  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.busy()) {
      return;
    }
    this.formError.set(null);
    runOperation({
      busy: this.busy,
      busyValue: true,
      idleValue: false,
      error: this.formError,
      operation: this.deleteOperation(target.kind, target.id),
      onSuccess: () => this.deleteTarget.set(null),
    });
  }

  /** Routes a confirmed delete to the matching galaxy service call. */
  private deleteOperation(kind: GalaxyKind, id: number): Observable<void> {
    switch (kind) {
      case 'region':
        return this.galaxy.deleteRegion(id);
      case 'subregion':
        return this.galaxy.deleteSubregion(id);
      case 'planet-system':
        return this.galaxy.deletePlanetSystem(id);
      case 'planet':
        return this.galaxy.deletePlanet(id);
      case 'planet-location':
        return this.galaxy.deletePlanetLocation(id);
    }
  }

  ngOnInit(): void {
    this.galaxy.fetchAll();
  }
}
