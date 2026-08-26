import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiSourceMaterial } from '../../../../shared/models/api-source-material';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { MEDIA, Medium } from '../../../../shared/models/medium';
import { UnitType, isContainerOrCollectionUnit } from '../../../../shared/models/unit-type';
import { UnitCrudFacade } from './unit-crud-facade';
import { UnitDataFacade } from './unit-data-facade';
import { SourceMaterialService } from '../../services/source-material.service';
import { nestedChildTypeFor as nestedChildTypeForFn } from './unit-type-utils';
import { removedFrom, removedWithPrefix, toggledIn } from '../../../../shared/utils/set-operations';

type LoadUnitsFn = (materialId: number) => void;

/** A season/volume/book group rendered in the expanded views. */
export interface MaterialDisplayGroup {
  readonly expandKey: string;
  readonly containerId: number | null;
  readonly containerType: UnitType | null;
  readonly label: string;
  readonly units: readonly ApiSourceMaterialUnit[];
}

type DisplayStrategy = 'grouped-season' | 'grouped-volume' | 'grouped-book' | 'flat';

/**
 * Encapsulates display/expansion state: medium groups, material expansion,
 * season expansion, display groups, and display strategy.
 *
 * Extracted from {@link SourceMaterialCatalog} to separate the UI state
 * management concern from data loading and CRUD operations.
 *
 * Owns: `expandedMedia`, `expandedMaterialId`, `userCollapsedIds`,
 * `expandedSeasonKeys`, and all display-related computed properties.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped, provided by SourceMaterialCatalog
@Injectable()
export class CatalogDisplayFacade {
  private readonly unitCrud = inject(UnitCrudFacade);
  private readonly unitData = inject(UnitDataFacade);
  private readonly sourceMaterialService = inject(SourceMaterialService);

  // ─── Signals ──────────────────────────────────────────────────────────

  readonly expandedMedia = signal(new Set<Medium>([...MEDIA]));
  readonly expandedMaterialId = signal<number | null>(null);
  /** Materials the user manually collapsed while they would otherwise be auto-expanded. */
  readonly userCollapsedIds = signal(new Set<number>());
  readonly expandedSeasonKeys = signal(new Set<string>());

  // ─── Computed ─────────────────────────────────────────────────────────

  readonly autoExpandedMaterialIds = computed(() => {
    const ids = new Set<number>();
    for (const [mid, unitList] of Object.entries(this.unitData.unitsByMaterial())) {
      if (this.hasDisplayGroups(unitList)) {
        ids.add(Number(mid));
      }
    }
    return ids;
  });

  readonly displayStrategy = computed(() => {
    const result: Record<number, DisplayStrategy> = {};
    const materials = this.sourceMaterialService.sourceMaterials() ?? [];
    for (const material of materials) {
      result[material.id] = this.getDisplayStrategy(material);
    }
    return result;
  });

  mediumGroups(
    filteredMaterials: readonly ApiSourceMaterial[],
  ): Array<{ medium: Medium; materials: ApiSourceMaterial[] }> {
    const map = new Map<Medium, ApiSourceMaterial[]>();
    for (const m of filteredMaterials) {
      let list = map.get(m.medium);
      if (!list) {
        list = [];
        map.set(m.medium, list);
      }
      list.push(m);
    }
    return MEDIA.filter((medium) => map.has(medium)).map((medium) => ({
      medium,
      materials: map.get(medium)!,
    }));
  }

  // ─── Expansion state management ───────────────────────────────────────

  toggleUnits(materialId: number, loadUnits: LoadUnitsFn): void {
    if (this.shouldShowUnits(materialId)) {
      if (this.expandedMaterialId() === materialId) {
        this.expandedMaterialId.set(null);
      } else {
        this.userCollapsedIds.update((set) => new Set(set).add(materialId));
      }
      this.clearSeasonKeys(materialId);
      return;
    }
    this.userCollapsedIds.update((set) => removedFrom(set, materialId));
    this.expandedMaterialId.set(materialId);
    loadUnits(materialId);
  }

  isMaterialExpanded(materialId: number): boolean {
    return this.shouldShowUnits(materialId);
  }

  shouldShowUnits(materialId: number): boolean {
    if (this.userCollapsedIds().has(materialId)) {
      return false;
    }
    return this.expandedMaterialId() === materialId || this.isAutoExpanded(materialId);
  }

  isAutoExpanded(materialId: number): boolean {
    return this.autoExpandedMaterialIds().has(materialId);
  }

  isMediumExpanded(medium: Medium): boolean {
    return this.expandedMedia().has(medium);
  }

  toggleMedium(medium: Medium): void {
    this.expandedMedia.update((set) => toggledIn(set, medium));
  }

  seasonKey(materialId: number, groupKey: number | string | null): string {
    return `${materialId}:${groupKey}`;
  }

  isSeasonExpanded(materialId: number, groupKey: number | string | null): boolean {
    return this.expandedSeasonKeys().has(this.seasonKey(materialId, groupKey));
  }

  toggleSeason(materialId: number, groupKey: number | string | null): void {
    const key = this.seasonKey(materialId, groupKey);
    this.expandedSeasonKeys.update((set) => toggledIn(set, key));
  }

  collapseMaterial(materialId: number): void {
    this.userCollapsedIds.update((set) => removedFrom(set, materialId));
    if (this.expandedMaterialId() === materialId) {
      this.expandedMaterialId.set(null);
      this.clearSeasonKeys(materialId);
    }
  }

  /** Resets all expansion state (called after material delete). */
  resetExpansionState(): void {
    this.expandedMaterialId.set(null);
    this.userCollapsedIds.set(new Set());
    this.expandedSeasonKeys.set(new Set());
  }

  // ─── Display helpers ──────────────────────────────────────────────────

  hasMaterialAdd(medium: Medium): boolean {
    return medium !== 'Movie' && medium !== 'Short Film';
  }

  nestedChildTypeFor(containerType: UnitType | null): UnitType {
    return nestedChildTypeForFn(containerType);
  }

  materialTracksViaContainers(materialId: number): boolean {
    const units = this.sourceMaterialService.getUnitCache(materialId).data() ?? [];
    if (units.length === 0) {
      return false;
    }
    const ids = new Set(units.map((u) => u.id));
    return units.some((u) => u.parentUnitId != null && ids.has(u.parentUnitId));
  }

  getDisplayGroups(materialId: number): readonly MaterialDisplayGroup[] {
    const units = this.unitData.unitsByMaterial()[materialId] ?? [];
    const containers = units.filter((u) => isContainerOrCollectionUnit(u.unitType));
    const details = units.filter((u) => !isContainerOrCollectionUnit(u.unitType));

    if (containers.length === 0) {
      if (details.length === 0) {
        return [];
      }
      const noun = details.some((u) => u.unitType === 'Issue')
        ? 'Volume'
        : details.some((u) => u.unitType === 'Episode')
          ? 'Season'
          : undefined;
      return [
        {
          expandKey: 'ungrouped',
          containerId: null,
          containerType: null,
          label: noun === undefined ? 'All units' : `All ${noun}s`,
          units: [...units].sort((a, b) => a.number - b.number),
        },
      ];
    }

    // The `Collection` unit is a book-collection's own root grouping; the
    // material row already represents it, so it never renders as a group of
    // itself. Its books are listed directly. Loose details parented to the
    // collection fall through to the "Ungrouped" group below.
    const displayContainers = containers.filter((c) => c.unitType !== 'Collection');
    const groups: MaterialDisplayGroup[] = displayContainers
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((container) => ({
        expandKey: String(container.id),
        containerId: container.id,
        containerType: container.unitType,
        label: this.unitCrud.groupUnitLabel(container),
        units: details.filter((u) => u.parentUnitId === container.id),
      }));

    const displayContainerIds = new Set(displayContainers.map((c) => c.id));
    const visibleOrphans = details.filter(
      (u) =>
        u.parentUnitId === null ||
        u.parentUnitId === undefined ||
        !displayContainerIds.has(u.parentUnitId),
    );
    if (visibleOrphans.length > 0) {
      groups.push({
        expandKey: 'ungrouped',
        containerId: null,
        containerType: null,
        label: 'Ungrouped',
        units: visibleOrphans,
      });
    }
    return groups;
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private clearSeasonKeys(materialId: number): void {
    this.expandedSeasonKeys.update(removedWithPrefix(`${materialId}:`));
  }

  private hasDisplayGroups(units: readonly ApiSourceMaterialUnit[]): boolean {
    return units.some((u) => isContainerOrCollectionUnit(u.unitType));
  }

  private getDisplayStrategy(material: ApiSourceMaterial): DisplayStrategy {
    switch (material.medium) {
      case 'Live Action Show':
      case 'Animated Show':
        return 'grouped-season';
      case 'Comic':
        return 'grouped-volume';
      case 'Book':
        return this.unitCrud.hasBookUnits(material.id, this.unitData.unitsByMaterial())
          ? 'grouped-book'
          : 'flat';
      default:
        return 'flat';
    }
  }
}
