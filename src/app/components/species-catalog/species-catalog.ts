import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../services/catalog/catalog.service';
import { ApiSpecies } from '../../models/api-species';
import { runOperation } from '../../utils/async-operation';
import { filterByName } from '../../utils/text-search';

/** Sentinel select value representing "no home planet selected"; catalog ids start at 1. */
const NO_PLANET = 0;

@Component({
  selector: 'app-species-catalog',
  imports: [FormsModule],
  templateUrl: './species-catalog.html',
  styleUrl: './species-catalog.scss',
})
export class SpeciesCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly catalogService = inject(CatalogService);

  readonly searchTerm = signal('');

  readonly items = computed(() => this.catalogService.species() ?? []);
  readonly loading = computed(() => this.catalogService.speciesLoading());
  readonly loadError = computed(() => this.catalogService.speciesError());
  readonly locations = computed(() => this.catalogService.locations() ?? []);

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

  readonly editId = signal<number | null>(null);
  readonly editName = signal('');
  readonly editHomePlanetId = signal(NO_PLANET);
  readonly savingId = signal<number | null>(null);

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.catalogService.fetchSpecies();
    this.catalogService.fetchLocations();
  }

  add(): void {
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
      operation: this.catalogService.createSpecies(name, this.newHomePlanetId() || null),
      onSuccess: (item) => {
        if (item) {
          this.newName.set('');
          this.newHomePlanetId.set(NO_PLANET);
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
      operation: this.catalogService.updateSpecies(id, name, this.editHomePlanetId() || null),
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
      operation: this.catalogService.deleteSpecies(id),
      onSuccess: () => this.confirmDeleteId.set(null),
    });
  }
}
