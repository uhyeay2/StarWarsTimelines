import { Component, input, output } from '@angular/core';
import { LibraryItem, LibraryUnit } from '../../models/library-item';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';

@Component({
  selector: 'app-tracked-item-row',
  imports: [],
  templateUrl: './tracked-item-row.html',
  styleUrl: './tracked-item-row.scss',
})
export class TrackedItemRow {
  readonly item = input.required<LibraryItem>();
  readonly showReorder = input(false);
  readonly first = input(false);
  readonly last = input(false);
  readonly dragging = input(false);
  readonly statuses = TRACKING_STATUSES;

  readonly statusChange = output<TrackingStatus>();
  readonly favoriteChange = output<void>();
  readonly remove = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly dragStart = output<void>();
  readonly dragOver = output<DragEvent>();
  readonly dragEnd = output<void>();
  readonly drop = output<void>();
  readonly unitProgressChange = output<{ unitId: string; isCompleted: boolean }>();

  onStatusChange(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as TrackingStatus);
  }

  onUnitChange(unitId: string, event: Event): void {
    this.unitProgressChange.emit({
      unitId,
      isCompleted: (event.target as HTMLInputElement).checked,
    });
  }

  unitLabel(unit: LibraryUnit): string {
    return unit.title
      ? `${unit.unitType} ${unit.number}: ${unit.title}`
      : `${unit.unitType} ${unit.number}`;
  }

  toggleFavorite(): void {
    this.favoriteChange.emit();
  }

  emitRemove(): void {
    this.remove.emit();
  }

  emitMoveUp(): void {
    this.moveUp.emit();
  }

  emitMoveDown(): void {
    this.moveDown.emit();
  }

  emitDragStart(): void {
    this.dragStart.emit();
  }

  emitDragOver(event: DragEvent): void {
    this.dragOver.emit(event);
  }

  emitDragEnd(): void {
    this.dragEnd.emit();
  }

  emitDrop(): void {
    this.drop.emit();
  }
}
