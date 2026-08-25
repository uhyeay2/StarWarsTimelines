import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { ApiSourceMaterial } from '../../../../shared/models/api-source-material';
import { CANON_TYPES, CanonType } from '../../../../shared/models/canon-type';
import { MEDIA, Medium } from '../../../../shared/models/medium';
import { SourceMaterialService } from '../../services/source-material.service';
import { runOperation } from '../../../../shared/utils/async-operation';

type CloseAllPopupsFn = () => void;
type AfterDeleteFn = () => void;

/**
 * Encapsulates material CRUD state and operations (add/edit/delete).
 *
 * Extracted from {@link SourceMaterialCatalog} to isolate the material
 * management workflow as a single responsibility.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped, provided by SourceMaterialCatalog
@Injectable()
export class MaterialCrudFacade {
  private readonly sourceMaterialService = inject(SourceMaterialService);

  readonly media = MEDIA;
  readonly canonTypes = CANON_TYPES;

  // ─── Add-material popup state ─────────────────────────────────────────

  readonly addMaterialMedium = signal<Medium | null>(null);
  readonly newTitle = signal('');
  readonly newCanonType = signal<CanonType>('Canon');
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  // ─── Edit-material form state ─────────────────────────────────────────

  readonly editId = signal<number | null>(null);
  readonly editTitle = signal('');
  readonly editMedium = signal<Medium>('Movie');
  readonly editCanonType = signal<CanonType>('Canon');
  readonly savingId = signal<number | null>(null);

  // ─── Delete-material confirmation state ───────────────────────────────

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);

  // ─── Add material ─────────────────────────────────────────────────────

  openAddMaterial(
    medium: Medium,
    actionError: WritableSignal<string | null>,
    closeAllPopups: CloseAllPopupsFn,
  ): void {
    actionError.set(null);
    closeAllPopups();
    this.addMaterialMedium.set(medium);
    this.newTitle.set('');
    this.newCanonType.set('Canon');
    this.addError.set(null);
  }

  cancelAddMaterial(): void {
    this.addMaterialMedium.set(null);
    this.addError.set(null);
  }

  submitAddMaterial(): void {
    const medium = this.addMaterialMedium();
    if (!medium || this.adding()) {
      return;
    }
    const title = this.newTitle().trim();
    if (!title) {
      this.addError.set('A title is required.');
      return;
    }

    this.addError.set(null);
    runOperation({
      busy: this.adding,
      busyValue: true,
      idleValue: false,
      error: this.addError,
      operation: this.sourceMaterialService.createSourceMaterial({
        title,
        medium,
        canonType: this.newCanonType(),
      }),
      onSuccess: (created) => {
        if (created) {
          this.newTitle.set('');
          this.cancelAddMaterial();
        }
      },
    });
  }

  // ─── Edit material ────────────────────────────────────────────────────

  beginEdit(material: ApiSourceMaterial, actionError: WritableSignal<string | null>): void {
    actionError.set(null);
    this.editId.set(material.id);
    this.editTitle.set(material.title);
    this.editMedium.set(material.medium);
    this.editCanonType.set(material.canonType);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editTitle.set('');
  }

  saveEdit(actionError: WritableSignal<string | null>): void {
    const id = this.editId();
    if (!id || this.savingId()) {
      return;
    }
    const title = this.editTitle().trim();
    if (!title) {
      actionError.set('A title is required.');
      return;
    }

    actionError.set(null);
    runOperation({
      busy: this.savingId,
      busyValue: id,
      idleValue: null,
      error: actionError,
      operation: this.sourceMaterialService.updateSourceMaterial(id, {
        title,
        medium: this.editMedium(),
        canonType: this.editCanonType(),
      }),
      onSuccess: (updated) => {
        if (updated) {
          this.editId.set(null);
          this.editTitle.set('');
        }
      },
    });
  }

  // ─── Delete material ──────────────────────────────────────────────────

  requestDelete(material: ApiSourceMaterial, actionError: WritableSignal<string | null>): void {
    actionError.set(null);
    this.confirmDeleteId.set(material.id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(actionError: WritableSignal<string | null>, afterDelete: AfterDeleteFn): void {
    const id = this.confirmDeleteId();
    if (!id || this.deletingId()) {
      return;
    }

    actionError.set(null);
    runOperation({
      busy: this.deletingId,
      busyValue: id,
      idleValue: null,
      error: actionError,
      operation: this.sourceMaterialService.deleteSourceMaterial(id),
      onSuccess: () => {
        this.confirmDeleteId.set(null);
        afterDelete();
      },
    });
  }

  /** Closes the add-material popup. */
  closePopups(): void {
    this.addMaterialMedium.set(null);
  }
}
