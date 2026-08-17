import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, finalize, of } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';

interface NameItem {
  id: string;
  name: string;
}

export type NameCatalogKind = 'characters' | 'locations' | 'vehicles';

@Component({
  selector: 'app-name-catalog-admin',
  imports: [FormsModule],
  templateUrl: './name-catalog-admin.html',
  styleUrl: './name-catalog-admin.scss',
})
export class NameCatalogAdmin implements OnInit {
  readonly catalog = input.required<NameCatalogKind>();
  readonly title = input.required<string>();
  readonly noun = input.required<string>();

  private readonly catalogService = inject(CatalogService);

  readonly items = signal<readonly NameItem[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly searchTerm = signal('');

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.items();
    }
    return this.items().filter((item) => item.name.toLowerCase().includes(term));
  });

  readonly newName = signal('');
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  readonly editId = signal<string | null>(null);
  readonly editName = signal('');
  readonly savingId = signal<string | null>(null);

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
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
    this.create(name)
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
          this.load();
        }
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
    this.savingId.set(id);
    this.update(id, name)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(null);
        }),
        finalize(() => this.savingId.set(null)),
      )
      .subscribe((updated) => {
        if (updated) {
          this.editId.set(null);
          this.editName.set('');
          this.load();
        }
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
    this.deletingId.set(id);
    this.remove(id)
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
          this.load();
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.fetch()
      .pipe(
        catchError((err: Error) => {
          this.loadError.set(err.message);
          return of([]);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((items) => this.items.set(items));
  }

  private fetch(): Observable<readonly NameItem[]> {
    switch (this.catalog()) {
      case 'characters':
        return this.catalogService.getCharacters();
      case 'locations':
        return this.catalogService.getLocations();
      case 'vehicles':
        return this.catalogService.getVehicles();
    }
  }

  private create(name: string): Observable<NameItem | null> {
    switch (this.catalog()) {
      case 'characters':
        return this.catalogService.createCharacter(name);
      case 'locations':
        return this.catalogService.createLocation(name);
      case 'vehicles':
        return this.catalogService.createVehicle(name);
    }
  }

  private update(id: string, name: string): Observable<NameItem | null> {
    switch (this.catalog()) {
      case 'characters':
        return this.catalogService.updateCharacter(id, name);
      case 'locations':
        return this.catalogService.updateLocation(id, name);
      case 'vehicles':
        return this.catalogService.updateVehicle(id, name);
    }
  }

  private remove(id: string): Observable<void> {
    switch (this.catalog()) {
      case 'characters':
        return this.catalogService.deleteCharacter(id);
      case 'locations':
        return this.catalogService.deleteLocation(id);
      case 'vehicles':
        return this.catalogService.deleteVehicle(id);
    }
  }
}
