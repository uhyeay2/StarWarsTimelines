import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpeciesService } from '../../services/species.service';
import { LocationService } from '../../services/location.service';
import { ApiSpecies } from '../../../../shared/models/api-species';
import { runOperation } from '../../../../shared/utils/async-operation';
import { filterByName } from '../../../../shared/utils/text-search';
import { SpeciesAddDialog } from '../species-add-dialog/species-add-dialog';

/** Sentinel select value representing "no home planet selected"; catalog ids start at 1. */
const NO_PLANET = 0;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-species-catalog',
  imports: [FormsModule, SpeciesAddDialog],
  templateUrl: './species-catalog.html',
  styleUrl: './species-catalog.scss',
})
export class SpeciesCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly speciesService = inject(SpeciesService);
  private readonly locationService = inject(LocationService);

  readonly searchTerm = signal('');

  readonly items = computed(() => this.speciesService.species() ?? []);
  readonly loading = computed(() => this.speciesService.speciesLoading());
  readonly loadError = computed(() => this.speciesService.speciesError());
  readonly locations = computed(() => this.locationService.locations() ?? []);

  /** Home planet options sorted by name so the dropdown is easy to scan. */
  readonly sortedLocations = computed(() =>
    [...this.locations()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly filteredItems = computed(() => filterByName(this.items(), this.searchTerm()));

  /** "No home planet" select sentinel, exposed for `[ngValue]` template bindings. */
  protected readonly noPlanet = NO_PLANET;

  readonly newName = signal('');
  readonly newHomePlanetId = signal(NO_PLANET);
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  /** Whether the add dialog is open. */
  readonly addOpen = signal(false);

  readonly editId = signal<number | null>(null);
  readonly editName = signal('');
  readonly editHomePlanetId = signal(NO_PLANET);
  readonly savingId = signal<number | null>(null);

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.speciesService.fetchSpecies();
    this.locationService.fetchLocations();
  }

  /** Opens the add dialog with a blank name. */
  openAdd(): void {
    this.addError.set(null);
    this.newName.set('');
    this.newHomePlanetId.set(NO_PLANET);
    this.addOpen.set(true);
  }

  cancelAdd(): void {
    this.addOpen.set(false);
  }

  submitAdd(): void {
    if (this.adding()) {
      return;
    }
    const name = this.newName().trim();
    if (!name) {
      this.addError.set('A name is required.');
      return;
    }

    this.addError.set(null);
    runOperation({
      busy: this.adding,
      busyValue: true,
      idleValue: false,
      error: this.addError,
      operation: this.speciesService.createSpecies(name, this.newHomePlanetId() || null),
      onSuccess: (item) => {
        if (item) {
          this.newName.set('');
          this.newHomePlanetId.set(NO_PLANET);
          this.addOpen.set(false);
        }
      },
    });
  }

  beginEdit(item: ApiSpecies): void {
    this.actionError.set(null);
    this.editId.set(item.id);
    this.editName.set(item.name);
    this.editHomePlanetId.set(item.homePlanetId ?? NO_PLANET);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editName.set('');
    this.editHomePlanetId.set(NO_PLANET);
  }

  saveEdit(): void {
    const id = this.editId();
    if (!id || this.savingId()) {
      return;
    }
    const name = this.editName().trim();
    if (!name) {
      this.actionError.set('A name is required.');
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.savingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.speciesService.updateSpecies(id, name, this.editHomePlanetId() || null),
      onSuccess: (updated) => {
        if (updated) {
          this.cancelEdit();
        }
      },
    });
  }

  requestDelete(item: ApiSpecies): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(item.id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id || this.deletingId()) {
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.deletingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.speciesService.deleteSpecies(id),
      onSuccess: () => this.confirmDeleteId.set(null),
    });
  }
}
