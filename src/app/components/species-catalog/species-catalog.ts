import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, finalize, of } from 'rxjs';
import { CatalogService } from '../../services/catalog/catalog.service';
import { ApiSpecies } from '../../models/api-species';

/** Sentinel select value representing "no home planet selected". */
const NO_PLANET = '';

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

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.items();
    }
    return this.items().filter((item) => item.name.toLowerCase().includes(term));
  });

  readonly newName = signal('');
  readonly newHomePlanetId = signal(NO_PLANET);
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  readonly editId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editHomePlanetId = signal(NO_PLANET);
  readonly savingId = signal<string | null>(null);

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
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
    this.adding.set(true);
    this.catalogService
      .createSpecies(name, this.newHomePlanetId() || null)
      .pipe(
        catchError((err: Error) => {
          this.addError.set(err.message);
          return of(null);
        }),
        finalize(() => this.adding.set(false)),
      )
      .subscribe((item) => {
        if (item) {
          this.newName.set('');
          this.newHomePlanetId.set(NO_PLANET);
        }
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
    this.savingId.set(id);
    this.catalogService
      .updateSpecies(id, name, this.editHomePlanetId() || null)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(null);
        }),
        finalize(() => this.savingId.set(null)),
      )
      .subscribe((updated) => {
        if (updated) {
          this.cancelEdit();
        }
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
    this.deletingId.set(id);
    this.catalogService
      .deleteSpecies(id)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(undefined);
        }),
        finalize(() => this.deletingId.set(null)),
      )
      .subscribe(() => {
        if (this.actionError() === null) {
          this.confirmDeleteId.set(null);
        }
      });
  }
}
