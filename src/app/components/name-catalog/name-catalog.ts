import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { CatalogService } from '../../services/catalog/catalog.service';
import { runOperation } from '../../utils/async-operation';
import { filterByName } from '../../utils/text-search';
import { NameAddDialog } from '../name-add-dialog/name-add-dialog';

interface NameItem {
  id: number;
  name: string;
}

export type NameCatalogKind = 'locations' | 'vehicles';

@Component({
  selector: 'app-name-catalog',
  imports: [FormsModule, NameAddDialog],
  templateUrl: './name-catalog.html',
  styleUrl: './name-catalog.scss',
})
export class NameCatalog implements OnInit {
  readonly catalog = input.required<NameCatalogKind>();
  readonly title = input.required<string>();
  readonly noun = input.required<string>();
  readonly isAdmin = input<boolean>(false);

  private readonly catalogService = inject(CatalogService);

  readonly searchTerm = signal('');

  readonly items = computed(() => {
    switch (this.catalog()) {
      case 'locations':
        return this.catalogService.locations() ?? [];
      case 'vehicles':
        return this.catalogService.vehicles() ?? [];
    }
  });

  readonly loading = computed(() => {
    switch (this.catalog()) {
      case 'locations':
        return this.catalogService.locationsLoading();
      case 'vehicles':
        return this.catalogService.vehiclesLoading();
    }
  });

  readonly loadError = computed(() => {
    switch (this.catalog()) {
      case 'locations':
        return this.catalogService.locationsError();
      case 'vehicles':
        return this.catalogService.vehiclesError();
    }
  });

  readonly filteredItems = computed(() => filterByName(this.items(), this.searchTerm()));

  readonly newName = signal('');
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  /** Whether the add dialog is open. */
  readonly addOpen = signal(false);

  /** Dialog heading derived from the noun, e.g. "Add Vehicle". */
  readonly addHeading = computed(() => {
    const noun = this.noun();
    return 'Add ' + noun.charAt(0).toUpperCase() + noun.slice(1);
  });

  readonly editId = signal<number | null>(null);
  readonly editName = signal('');
  readonly savingId = signal<number | null>(null);

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    switch (this.catalog()) {
      case 'locations':
        this.catalogService.fetchLocations();
        break;
      case 'vehicles':
        this.catalogService.fetchVehicles();
        break;
    }
  }

  /** Opens the add dialog with a blank name. */
  openAdd(): void {
    this.addError.set(null);
    this.newName.set('');
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
      operation: this.create(name),
      onSuccess: (item) => {
        if (item) {
          this.newName.set('');
          this.addOpen.set(false);
        }
      },
    });
  }

  beginEdit(item: NameItem): void {
    this.actionError.set(null);
    this.editId.set(item.id);
    this.editName.set(item.name);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editName.set('');
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
      operation: this.update(id, name),
      onSuccess: (updated) => {
        if (updated) {
          this.editId.set(null);
          this.editName.set('');
        }
      },
    });
  }

  requestDelete(item: NameItem): void {
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
      operation: this.remove(id),
      onSuccess: () => this.confirmDeleteId.set(null),
    });
  }

  private create(name: string): Observable<NameItem | null> {
    switch (this.catalog()) {
      case 'locations':
        return this.catalogService.createLocation(name);
      case 'vehicles':
        return this.catalogService.createVehicle(name);
    }
  }

  private update(id: number, name: string): Observable<NameItem | null> {
    switch (this.catalog()) {
      case 'locations':
        return this.catalogService.updateLocation(id, name);
      case 'vehicles':
        return this.catalogService.updateVehicle(id, name);
    }
  }

  private remove(id: number): Observable<void> {
    switch (this.catalog()) {
      case 'locations':
        return this.catalogService.deleteLocation(id);
      case 'vehicles':
        return this.catalogService.deleteVehicle(id);
    }
  }
}
