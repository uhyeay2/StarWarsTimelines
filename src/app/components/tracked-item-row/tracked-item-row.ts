import { Component, computed, input, output } from '@angular/core';
import { LibraryItem, LibraryUnit } from '../../models/library-item';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';
import { isContainerUnit } from '../../models/tracking-selection';
import { UnitType } from '../../models/unit-type';

interface UnitGroup {
  groupTitle: string;
  unitType: UnitType;
  units: readonly LibraryUnit[];
  containerId: number;
}

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
  readonly remove = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly dragStart = output<void>();
  readonly dragOver = output<DragEvent>();
  readonly dragEnd = output<void>();
  readonly drop = output<void>();
  readonly groupStatusChange = output<{ unitId: number; status: TrackingStatus }>();
  readonly groupRemove = output<{ unitId: number }>();

  readonly hasGroupUnits = computed(() => {
    const units = this.item().units ?? [];
    return units.some((u) => isContainerUnit(u.unitType));
  });

  readonly groupUnits = computed(() => {
    const units = this.item().units ?? [];
    if (!this.hasGroupUnits()) {
      return [];
    }

    const containerUnits = units.filter((u) => isContainerUnit(u.unitType));

    const detailUnits = units.filter(
      (u) => !isContainerUnit(u.unitType) && u.unitType !== 'Collection',
    );

    const trackedContainers = containerUnits.filter((u) => u.status !== null);
    const containersToDisplay = trackedContainers.length > 0 ? trackedContainers : containerUnits;

    return containersToDisplay.map((container): UnitGroup => {
      const children = detailUnits.filter((u) => u.parentUnitId === container.id);
      const label = container.title ?? `${container.unitType} ${container.number}`;
      return {
        groupTitle: label,
        unitType: container.unitType,
        units: children,
        containerId: container.id,
      };
    });
  });

  getGroupStatus(group: UnitGroup): TrackingStatus | null {
    const units = this.item().units ?? [];
    const container = units.find(
      (u) => u.id === group.containerId && isContainerUnit(u.unitType),
    );
    if (!container) {
      return this.deriveGroupStatus(group.units);
    }
    if (container.status !== null) {
      // The container has its own progress record; report it directly.
      return container.status;
    }
    if (!group.units.some((u) => u.status !== null)) {
      return null;
    }
    return this.deriveGroupStatus(group.units);
  }

  private deriveGroupStatus(units: readonly LibraryUnit[]): TrackingStatus {
    if (units.length === 0 || units.every((u) => u.status === null)) {
      return 'Wish Listed';
    }
    if (units.every((u) => u.status === 'Completed')) {
      return 'Completed';
    }
    return 'In progress';
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'remove') {
      this.remove.emit();
    } else {
      this.statusChange.emit(value as TrackingStatus);
    }
  }

  onGroupStatusChange(containerId: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'remove') {
      // Removing a season/volume clears only that unit's progress, not the
      // whole library entry.
      this.groupRemove.emit({ unitId: containerId });
      return;
    }
    this.groupStatusChange.emit({ unitId: containerId, status: value as TrackingStatus });
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
