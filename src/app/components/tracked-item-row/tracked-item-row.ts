import { Component, computed, input, output } from '@angular/core';
import { LibraryItem, LibraryUnit } from '../../models/library-item';
import { TRACKING_STATUSES, TrackingStatus } from '../../models/tracking-status';
import { UnitType } from '../../models/unit-type';

interface UnitGroup {
  groupNumber: number;
  groupTitle: string;
  unitType: UnitType;
  units: readonly LibraryUnit[];
  containerId: string;
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
  readonly groupStatusChange = output<{ unitId: string; status: TrackingStatus }>();
  readonly groupRemove = output<{ unitId: string }>();

  readonly hasGroupUnits = computed(() => {
    const units = this.item().units ?? [];
    return units.some((u) => u.unitType === 'Season' || u.unitType === 'Volume');
  });

  readonly groupUnits = computed(() => {
    const units = this.item().units ?? [];
    if (units.length === 0) {
      return [];
    }

    const seasonUnits = units.filter((u) => u.unitType === 'Season');
    const volumeUnits = units.filter((u) => u.unitType === 'Volume');

    const groupContainerUnits: readonly LibraryUnit[] = [...seasonUnits, ...volumeUnits];
    const detailUnits = units.filter(
      (u) => u.unitType !== 'Season' && u.unitType !== 'Volume',
    );

    if (groupContainerUnits.length === 0) {
      return this.groupByGroupNumber(detailUnits);
    }

    const trackedContainers = groupContainerUnits.filter((u) => u.isTracked === true);
    const containersToDisplay = trackedContainers.length > 0 ? trackedContainers : groupContainerUnits;

    return containersToDisplay.map((container): UnitGroup => {
      const children = detailUnits.filter(
        (u) => u.groupNumber === container.number,
      );
      const label = container.title ??
        (container.unitType === 'Season' ? `Season ${container.number}` : `Volume ${container.number}`);
      return {
        groupNumber: container.number,
        groupTitle: label,
        unitType: container.unitType,
        units: children,
        containerId: container.id,
      };
    });
  });

  private groupByGroupNumber(units: readonly LibraryUnit[]): UnitGroup[] {
    const map = new Map<number | null, LibraryUnit[]>();
    for (const unit of units) {
      const key = unit.groupNumber ?? null;
      const list = map.get(key) ?? [];
      list.push(unit);
      map.set(key, list);
    }

    return [...map.entries()].map(([groupNumber, groupUnits]) => {
      const unitType = (groupUnits[0]?.unitType ?? 'Episode') as UnitType;
      const groupName = unitType === 'Episode' ? 'Season' : unitType === 'Issue' ? 'Volume' : '';
      if (groupNumber === null) {
        return {
          groupNumber: 0,
          groupTitle: groupName ? `All ${groupName}s` : 'All Units',
          unitType,
          units: groupUnits,
          containerId: '',
        };
      }
      return {
        groupNumber: groupNumber,
        groupTitle: groupName ? `${groupName} ${groupNumber}` : `Group ${groupNumber}`,
        unitType,
        units: groupUnits,
        containerId: '',
      };
    });
  }

  getGroupStatus(group: UnitGroup): TrackingStatus | null {
    const units = this.item().units ?? [];
    const container = units.find(
      (u) => u.id === group.containerId && (u.unitType === 'Season' || u.unitType === 'Volume'),
    );
    if (!container) {
      return this.deriveGroupStatus(group.units);
    }
    if (container.isTracked === true) {
      // The container has its own progress record: an explicit non-completed
      // season means the user started it, so report 'In progress'.
      return container.isCompleted ? 'Completed' : 'In progress';
    }
    if (!group.units.some((u) => u.isTracked === true)) {
      return null;
    }
    return this.deriveGroupStatus(group.units);
  }

  private deriveGroupStatus(units: readonly LibraryUnit[]): TrackingStatus {
    if (units.length === 0) return 'Wish Listed';
    const completed = units.filter((u) => u.isCompleted);
    if (completed.length === units.length) return 'Completed';
    if (completed.length === 0) return 'Wish Listed';
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

  onGroupStatusChange(containerId: string, event: Event): void {
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
