import { computed, DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ApiSourceMaterial } from '../../../../shared/models/api-source-material';
import { LibraryItem } from '../../../../shared/models/library-item';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import {
  findTrackedItem,
  groupTrackingStatus,
  groupUnitIsTracked,
  materialTrackingStatus,
  trackSelectOptions,
} from '../../../../shared/models/tracking-selection';
import { AuthService } from '../../../auth/services/auth.service';
import { LibraryService } from '../../../library/services/library.service';

/**
 * Encapsulates tracking logic for source materials and their group units
 * (seasons/volumes/books).
 *
 * Extracted from {@link SourceMaterialCatalog} to separate tracking business
 * logic from catalog UI state. The parent component delegates all tracking
 * decisions to this service.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped, provided by SourceMaterialCatalog
@Injectable()
export class TrackingFacade {
  private readonly authService = inject(AuthService);
  private readonly libraryService = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;

  readonly trackedItems = computed(() => this.libraryService.items());

  readonly trackedItemIds = computed(() => new Set(this.trackedItems().map((item) => item.id)));

  /** Loads tracked items for the given user into the library cache. */
  loadTracked(userId: string): void {
    this.libraryService.getTracked(userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /** Returns the tracked item for a material ID, or null if not tracked. */
  getTrackedItem(materialId: number): LibraryItem | null {
    return findTrackedItem(this.trackedItems(), materialId);
  }

  /** Tracking status options for a material-level dropdown. */
  getTrackingOptions(materialId: number): readonly string[] {
    return trackSelectOptions(this.getTrackedItem(materialId) !== null);
  }

  /** Tracking status options for a group (season/volume) unit dropdown. */
  getGroupTrackingOptions(materialId: number, unitId: number): readonly string[] {
    return trackSelectOptions(groupUnitIsTracked(this.getTrackedItem(materialId), unitId));
  }

  /** Current tracking status for a material, or null when untracked. */
  getMaterialCurrentStatus(materialId: number): TrackingStatus | null {
    return materialTrackingStatus(this.getTrackedItem(materialId));
  }

  /** Current tracking status for a group unit, or null when untracked. */
  getGroupCurrentStatus(materialId: number, unitId: number): TrackingStatus | null {
    return groupTrackingStatus(this.getTrackedItem(materialId), unitId);
  }

  /**
   * Handles a tracking status change for a material (non-unit level).
   * If status is 'remove', removes the item from the library;
   * otherwise, adds or updates the tracked item with the given status.
   */
  onTrackMaterial(
    materialId: number,
    status: string,
    material: ApiSourceMaterial | undefined,
  ): void {
    const userId = this.currentUser()?.id;
    if (!userId) return;

    if (status === 'remove' || status === '') {
      this.libraryService
        .removeTracked(userId, materialId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      return;
    }

    if (this.getTrackedItem(materialId)) {
      this.libraryService
        .setStatus(userId, materialId, status as TrackingStatus)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      return;
    }

    if (material) {
      this.libraryService
        .addTracked(
          userId,
          { id: material.id, title: material.title, medium: material.medium },
          status as TrackingStatus,
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }

  /**
   * Handles a tracking status change for a Season/Volume unit within a material.
   * If status is 'remove', removes the unit's progress;
   * otherwise, sets the unit's status.
   */
  onTrackGroupUnit(
    materialId: number,
    unitId: number,
    status: string,
    material: ApiSourceMaterial | undefined,
  ): void {
    const userId = this.currentUser()?.id;
    if (!userId) return;

    if (status === 'remove' || status === '') {
      this.libraryService
        .clearUnitProgress(userId, materialId, unitId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      return;
    }

    const trackedItem = this.getTrackedItem(materialId);
    if (!trackedItem && material) {
      this.libraryService
        .addTracked(
          userId,
          { id: material.id, title: material.title, medium: material.medium },
          status as TrackingStatus,
        )
        .pipe(
          switchMap(() =>
            this.libraryService.setStatus(userId, materialId, status as TrackingStatus, unitId),
          ),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
      return;
    }

    this.libraryService
      .setStatus(userId, materialId, status as TrackingStatus, unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
