import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, finalize, of } from 'rxjs';
import { ApiSourceMaterial } from '../../models/api-source-material';
import { ApiSourceMaterialUnit } from '../../models/api-source-material-unit';
import { CANON_TYPES, CanonType } from '../../models/canon-type';
import { MEDIA, Medium } from '../../models/medium';
import { UNIT_TYPES, UnitType } from '../../models/unit-type';
import {
  CatalogService,
  CreateSourceMaterialUnitInput,
} from '../../services/catalog.service';

interface UnitKey {
  materialId: string;
  unitId: string;
}

@Component({
  selector: 'app-source-material-admin',
  imports: [FormsModule],
  templateUrl: './source-material-admin.html',
  styleUrl: './source-material-admin.scss',
})
export class SourceMaterialAdmin implements OnInit {
  private readonly catalogService = inject(CatalogService);

  readonly media = MEDIA;
  readonly canonTypes = CANON_TYPES;
  readonly unitTypes = UNIT_TYPES;

  readonly materials = signal<readonly ApiSourceMaterial[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly searchTerm = signal('');

  readonly filteredMaterials = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.materials();
    }
    return this.materials().filter((m) => m.title.toLowerCase().includes(term));
  });

  readonly newTitle = signal('');
  readonly newMedium = signal<Medium>('Movie');
  readonly newCanonType = signal<CanonType>('Canon');
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  readonly editId = signal<string | null>(null);
  readonly editTitle = signal('');
  readonly editMedium = signal<Medium>('Movie');
  readonly editCanonType = signal<CanonType>('Canon');
  readonly savingId = signal<string | null>(null);

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);

  readonly expandedMaterialId = signal<string | null>(null);
  readonly unitsByMaterial = signal<Readonly<Record<string, readonly ApiSourceMaterialUnit[]>>>({});
  readonly unitsLoading = signal(false);
  readonly unitsError = signal<string | null>(null);

  readonly newUnitType = signal<UnitType>('Episode');
  readonly newUnitGroup = signal<number | null>(null);
  readonly newUnitNumber = signal<number | null>(null);
  readonly newUnitTitle = signal('');
  readonly addingUnitFor = signal<string | null>(null);
  readonly unitAddError = signal<string | null>(null);

  readonly unitEditKey = signal<UnitKey | null>(null);
  readonly unitEditType = signal<UnitType>('Episode');
  readonly unitEditGroup = signal<number | null>(null);
  readonly unitEditNumber = signal<number | null>(null);
  readonly unitEditTitle = signal('');
  readonly unitSavingKey = signal<UnitKey | null>(null);

  readonly unitConfirmDeleteKey = signal<UnitKey | null>(null);
  readonly unitDeletingKey = signal<UnitKey | null>(null);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  add(): void {
    if (this.adding()) {
      return;
    }
    const title = this.newTitle().trim();
    if (!title) {
      this.addError.set('A title is required.');
      return;
    }

    this.addError.set(null);
    this.adding.set(true);
    this.catalogService
      .createSourceMaterial({
        title,
        medium: this.newMedium(),
        canonType: this.newCanonType(),
      })
      .pipe(
        catchError((err: Error) => {
          this.addError.set(err.message);
          return of(null);
        }),
        finalize(() => this.adding.set(false)),
      )
      .subscribe((created) => {
        if (created) {
          this.newTitle.set('');
          this.load();
        }
      });
  }

  beginEdit(material: ApiSourceMaterial): void {
    this.actionError.set(null);
    this.editId.set(material.id);
    this.editTitle.set(material.title);
    this.editMedium.set(material.medium);
    this.editCanonType.set(material.canonType);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editTitle.set('');
  }

  saveEdit(): void {
    const id = this.editId();
    if (!id || this.savingId()) {
      return;
    }
    const title = this.editTitle().trim();
    if (!title) {
      this.actionError.set('A title is required.');
      return;
    }

    this.actionError.set(null);
    this.savingId.set(id);
    this.catalogService
      .updateSourceMaterial(id, {
        title,
        medium: this.editMedium(),
        canonType: this.editCanonType(),
      })
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
          this.editTitle.set('');
          this.load();
        }
      });
  }

  requestDelete(material: ApiSourceMaterial): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(material.id);
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
      .deleteSourceMaterial(id)
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

  toggleUnits(materialId: string): void {
    if (this.expandedMaterialId() === materialId) {
      this.expandedMaterialId.set(null);
      return;
    }
    this.expandedMaterialId.set(materialId);
    this.loadUnits(materialId);
  }

  addUnit(materialId: string): void {
    if (this.addingUnitFor()) {
      return;
    }
    const input = this.buildUnitInput(
      this.newUnitType(),
      this.newUnitGroup(),
      this.newUnitNumber(),
      this.newUnitTitle(),
    );
    if (!input) {
      this.unitAddError.set('A unit number of at least one is required.');
      return;
    }

    this.unitAddError.set(null);
    this.addingUnitFor.set(materialId);
    this.catalogService
      .createSourceMaterialUnit(materialId, input)
      .pipe(
        catchError((err: Error) => {
          this.unitAddError.set(err.message);
          return of(null);
        }),
        finalize(() => this.addingUnitFor.set(null)),
      )
      .subscribe((created) => {
        if (created) {
          this.newUnitType.set('Episode');
          this.newUnitGroup.set(null);
          this.newUnitNumber.set(null);
          this.newUnitTitle.set('');
          this.loadUnits(materialId);
        }
      });
  }

  beginUnitEdit(materialId: string, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitEditKey.set({ materialId, unitId: unit.id });
    this.unitEditType.set(unit.unitType);
    this.unitEditGroup.set(unit.groupNumber);
    this.unitEditNumber.set(unit.number);
    this.unitEditTitle.set(unit.title ?? '');
  }

  cancelUnitEdit(): void {
    this.unitEditKey.set(null);
    this.unitEditTitle.set('');
  }

  saveUnitEdit(): void {
    const key = this.unitEditKey();
    if (!key || this.unitSavingKey()) {
      return;
    }
    const input = this.buildUnitInput(
      this.unitEditType(),
      this.unitEditGroup(),
      this.unitEditNumber(),
      this.unitEditTitle(),
    );
    if (!input) {
      this.actionError.set('A unit number of at least one is required.');
      return;
    }

    this.actionError.set(null);
    this.unitSavingKey.set(key);
    this.catalogService
      .updateSourceMaterialUnit(key.materialId, key.unitId, input)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(null);
        }),
        finalize(() => this.unitSavingKey.set(null)),
      )
      .subscribe((updated) => {
        if (updated) {
          this.unitEditKey.set(null);
          this.unitEditTitle.set('');
          this.loadUnits(key.materialId);
        }
      });
  }

  requestUnitDelete(materialId: string, unit: ApiSourceMaterialUnit): void {
    this.actionError.set(null);
    this.unitConfirmDeleteKey.set({ materialId, unitId: unit.id });
  }

  cancelUnitDelete(): void {
    this.unitConfirmDeleteKey.set(null);
  }

  confirmUnitDelete(): void {
    const key = this.unitConfirmDeleteKey();
    if (!key || this.unitDeletingKey()) {
      return;
    }

    this.actionError.set(null);
    this.unitDeletingKey.set(key);
    this.catalogService
      .deleteSourceMaterialUnit(key.materialId, key.unitId)
      .pipe(
        catchError((err: Error) => {
          this.actionError.set(err.message);
          return of(undefined);
        }),
        finalize(() => this.unitDeletingKey.set(null)),
      )
      .subscribe(() => {
        if (this.actionError() === null) {
          this.unitConfirmDeleteKey.set(null);
          this.loadUnits(key.materialId);
        }
      });
  }

  unitLabel(unit: ApiSourceMaterialUnit): string {
    const group = unit.groupNumber !== null ? `${unit.groupNumber}.` : '';
    const title = unit.title ? ` — ${unit.title}` : '';
    return `${group}${unit.number}${title}`;
  }

  private buildUnitInput(
    unitType: UnitType,
    groupNumber: number | null,
    number: number | null,
    title: string,
  ): CreateSourceMaterialUnitInput | null {
    if (number === null || number < 1) {
      return null;
    }
    const trimmedTitle = title.trim();
    return {
      unitType,
      groupNumber,
      number,
      title: trimmedTitle || null,
    };
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.catalogService
      .getSourceMaterials()
      .pipe(
        catchError((err: Error) => {
          this.loadError.set(err.message);
          return of([]);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((materials) => {
        this.materials.set(materials);
        this.expandedMaterialId.set(null);
        this.unitsByMaterial.set({});
      });
  }

  private loadUnits(materialId: string): void {
    this.unitsLoading.set(true);
    this.unitsError.set(null);
    this.catalogService
      .getSourceMaterialUnits(materialId)
      .pipe(
        catchError((err: Error) => {
          this.unitsError.set(err.message);
          return of([]);
        }),
        finalize(() => this.unitsLoading.set(false)),
      )
      .subscribe((units) => {
        this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
      });
  }
}
