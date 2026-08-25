import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { EventSource } from '../../models/timeline-event';
import { LibraryItem } from '../../../../shared/models/library-item';
import { TrackSelectOption, findTrackedItem, groupTrackingStatus, groupUnitIsTracked, materialTrackingStatus, trackSelectOptions } from '../../../../shared/models/tracking-selection';
import { TrackingStatus } from '../../../../shared/models/tracking-status';
import { AuthService } from '../../../auth/services/auth.service';
import { SourceMaterialService } from '../../../catalog/services/source-material.service';
import { LibraryService } from '../../../library/services/library.service';

// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped
@Injectable()
export class TrackingDropdownPresenter {
  private readonly authService = inject(AuthService);
  private readonly libraryService = inject(LibraryService);
  private readonly sourceMaterialService = inject(SourceMaterialService);
  private readonly destroyRef = inject(DestroyRef);

  /** The signed-in user, or `null` when anonymous (dropdown hidden). */
  readonly currentUser = this.authService.currentUser;

  /** The tracked library item for this source material, or null. */
  trackedItem(source: EventSource): LibraryItem | null {
    return source.sourceId === undefined ? null : findTrackedItem(this.libraryService.items(), source.sourceId);
  }

  /** Whether this source's medium tracks at season/volume/book group level. */
  isGroupedMedium(source: EventSource): boolean {
    if (
      source.medium === 'Comic' ||
      source.medium === 'Live Action Show' ||
      source.medium === 'Animated Show'
    ) {
      return true;
    }
    return source.medium === 'Book' && this.resolveContainerUnit(source) !== null;
  }

  /**
   * Resolves the Season/Volume/Book container unit for the source's pinned
   * unit directly from its `parentUnitId`, or `null` when unpinned.
   */
  resolveContainerUnit(source: EventSource): number | null {
    return source.unit?.parentUnitId ?? null;
  }

  /**
   * The Season/Volume/Book container unit ID governing tracking for grouped
   * sources, resolved from the pinned unit's parent link.
   */
  containerUnitId(source: EventSource): number | null {
    if (!this.isGroupedMedium(source)) {
      return null;
    }
    return this.resolveContainerUnit(source);
  }

  /** Whether the tracking dropdown should be rendered for this source. */
  showTracking(source: EventSource): boolean {
    if (this.currentUser() === null) {
      return false;
    }
    if (this.containerUnitId(source) !== null) {
      return true;
    }
    if (this.isGroupedMedium(source)) {
      return false;
    }
    return !this.materialTracksViaContainers(source);
  }

  /**
   * Whether the material's units nest inside container units (e.g. chapters
   * inside books).
   */
  materialTracksViaContainers(source: EventSource): boolean {
    if (source.sourceId === undefined) {
      return false;
    }
    const units = this.sourceMaterialService.getUnitCache(source.sourceId).data() ?? [];
    if (units.length === 0) {
      return false;
    }
    const ids = new Set(units.map((u) => u.id));
    return units.some((u) => u.parentUnitId != null && ids.has(u.parentUnitId));
  }

  /** Select options: statuses, plus 'Remove From Library' once tracked. */
  trackingOptions(source: EventSource): readonly TrackSelectOption[] {
    const unitId = this.containerUnitId(source);
    if (unitId !== null) {
      return trackSelectOptions(groupUnitIsTracked(this.trackedItem(source), unitId));
    }
    return trackSelectOptions(this.trackedItem(source) !== null);
  }

  /** The currently selected tracking status, or `null` (shows "Track…"). */
  currentStatus(source: EventSource): TrackingStatus | null {
    const unitId = this.containerUnitId(source);
    if (unitId !== null) {
      return groupTrackingStatus(this.trackedItem(source), unitId);
    }
    return materialTrackingStatus(this.trackedItem(source));
  }

  /**
   * Stable key for tracking an `@for` loop over an event's sources.
   */
  trackSource(source: EventSource): number | string {
    return source.sourceId ?? source.title;
  }

  /**
   * Handles a tracking status change from one source's dropdown.
   */
  onTrackChange(changeEvent: Event, source: EventSource): void {
    const status = (changeEvent.target as HTMLSelectElement).value as
      | TrackingStatus
      | 'remove'
      | '';
    const user = this.currentUser();
    if (!user || !status || source.sourceId === undefined) {
      return;
    }
    const userId = user.id;
    const material = {
      id: source.sourceId,
      title: source.title,
      medium: source.medium,
    };

    const unitId = this.containerUnitId(source);
    if (unitId !== null) {
      if (status === 'remove') {
        this.libraryService.clearUnitProgress(userId, material.id, unitId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();
        return;
      }
      if (!this.trackedItem(source)) {
        this.libraryService
          .addTracked(userId, material, status)
          .pipe(
            switchMap(() => this.libraryService.setStatus(userId, material.id, status, unitId)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe();
        return;
      }
      this.libraryService.setStatus(userId, material.id, status, unitId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      return;
    }

    if (this.isGroupedMedium(source) || this.materialTracksViaContainers(source)) {
      return;
    }

    if (status === 'remove') {
      this.libraryService.removeTracked(userId, material.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      return;
    }
    if (this.trackedItem(source)) {
      this.libraryService.setStatus(userId, material.id, status)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
      return;
    }
    this.libraryService.addTracked(userId, material, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /**
   * Prefetches unit caches for all depicted sources and ensures tracked items
   * are loaded.
   */
  prefetch(sources: readonly EventSource[]): void {
    const user = this.currentUser();
    if (!user) {
      return;
    }
    this.libraryService.ensureTracked(user.id);
    for (const source of sources) {
      if (source.sourceId !== undefined) {
        this.sourceMaterialService.getUnitCache(source.sourceId).fetch();
      }
    }
  }
}
