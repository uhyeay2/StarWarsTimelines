import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LibraryItem, LibraryUnit } from '../../../../shared/models/library-item';
import {
  TRACKING_STATUSES,
  TrackingStatus,
  STATUS_WISH_LISTED,
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
} from '../../../../shared/models/tracking-status';
import { isContainerOrCollectionUnit, UnitType } from '../../../../shared/models/unit-type';

interface UnitGroup {
  groupTitle: string;
  unitType: UnitType;
  units: readonly LibraryUnit[];
  containerId: number;
  /** Effective tracking status shown for the group's select. */
  status: TrackingStatus | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    return units.some((u) => isContainerOrCollectionUnit(u.unitType));
  });

  readonly groupUnits = computed(() => {
    const units = this.item().units ?? [];
    if (!this.hasGroupUnits()) {
      return [];
    }

    const containerUnits = units.filter((u) => isContainerOrCollectionUnit(u.unitType));

    const detailUnits = units.filter((u) => !isContainerOrCollectionUnit(u.unitType));

    const trackedContainers = containerUnits.filter((u) => u.status !== null);
    const containersToDisplay = trackedContainers.length > 0 ? trackedContainers : containerUnits;

    return containersToDisplay.map((container): UnitGroup => {
      const children = detailUnits.filter((u) => u.parentUnitId === container.id);
      const label = container.title ?? `${container.unitType} ${container.number}`;
      const childTracked = children.some((u) => u.status !== null);
      return {
        groupTitle: label,
        unitType: container.unitType,
        units: children,
        containerId: container.id,
        // The container's own progress wins; otherwise derive from children.
        status: container.status ?? (childTracked ? this.deriveGroupStatus(children) : null),
      };
    });
  });

  private deriveGroupStatus(units: readonly LibraryUnit[]): TrackingStatus {
    if (units.length === 0 || units.every((u) => u.status === null)) {
      return STATUS_WISH_LISTED;
    }
    if (units.every((u) => u.status === STATUS_COMPLETED)) {
      return STATUS_COMPLETED;
    }
    return STATUS_IN_PROGRESS;
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
