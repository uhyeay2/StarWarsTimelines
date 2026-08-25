import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { SourceMaterialService } from '../../services/source-material.service';
import { addedTo, removedFrom } from '../../../../shared/utils/set-operations';

type OnEmptyFn = (materialId: number) => void;

/**
 * Encapsulates unit data loading, probe lifecycle, and the unit cache.
 *
 * Extracted from {@link SourceMaterialCatalog} to separate the data-fetching
 * and caching concern from UI state management.
 *
 * Owns: `unitsByMaterial`, `materialsWithUnits`, `unitsLoading`, `unitsError`,
 * `probeLoading`, and the `hasUnits` computed projection.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- component-scoped, provided by SourceMaterialCatalog
@Injectable()
export class UnitDataFacade {
  private readonly sourceMaterialService = inject(SourceMaterialService);

  // ─── Signals ──────────────────────────────────────────────────────────

  readonly probeLoading = signal(true);
  readonly unitsByMaterial = signal<Readonly<Record<number, readonly ApiSourceMaterialUnit[]>>>({});
  readonly unitsLoading = signal(false);
  readonly unitsError = signal<string | null>(null);
  readonly materialsWithUnits = signal(new Set<number>());

  // ─── Computed ─────────────────────────────────────────────────────────

  readonly hasUnits = computed(() => {
    const known = this.materialsWithUnits();
    const materials = this.sourceMaterialService.sourceMaterials() ?? [];
    const result: Record<number, boolean> = {};
    for (const material of materials) {
      result[material.id] = known.has(material.id);
    }
    return result;
  });

  // ─── Probe lifecycle ──────────────────────────────────────────────────

  /** Initiates the unit probe. Call after materials are loaded. */
  probeUnitPresence(): void {
    this.probeLoading.set(true);
    this.sourceMaterialService.probeUnitPresence();
  }

  /** Synchronously completes the probe after HTTP requests are flushed. */
  completeProbe(): void {
    const withUnits = this.sourceMaterialService.checkProbeResults();
    if (withUnits !== null) {
      this.materialsWithUnits.set(new Set(withUnits));
      this.probeLoading.set(false);
    }
  }

  autoProbe(): void {
    const poll = setInterval(() => {
      if (this.sourceMaterialService.sourceMaterialsLoading()) {
        return;
      }
      const materials = this.sourceMaterialService.sourceMaterials();
      if (!materials || materials.length === 0) {
        clearInterval(poll);
        this.probeLoading.set(false);
        return;
      }
      clearInterval(poll);
      this.probeUnitPresence();
      for (const m of materials) {
        this.pollMaterialProbe(m.id);
      }
    }, 50);
  }

  private pollMaterialProbe(materialId: number): void {
    const probePoll = setInterval(() => {
      const cache = this.sourceMaterialService.getUnitCache(materialId);
      if (cache.loading()) {
        return;
      }
      clearInterval(probePoll);
      const units = cache.data();
      if (units && units.length > 0) {
        this.materialsWithUnits.update((set) => addedTo(set, materialId));
        this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
      }
      if (!this.sourceMaterialService.sourceMaterialsLoading()) {
        const materials = this.sourceMaterialService.sourceMaterials() ?? [];
        const allProbed = materials.every(
          (m) => this.sourceMaterialService.getUnitCache(m.id).loading() === false,
        );
        if (allProbed) {
          this.probeLoading.set(false);
        }
      }
    }, 50);
  }

  // ─── Unit data loading ────────────────────────────────────────────────

  /**
   * Fetches units for a material from the service cache, syncing the result
   * into `unitsByMaterial`. When a material has zero units after loading,
   * calls `onEmpty` so the host can collapse display state.
   */
  loadUnits(materialId: number, onEmpty?: OnEmptyFn): void {
    this.unitsLoading.set(true);
    this.unitsError.set(null);
    const cache = this.sourceMaterialService.getUnitCache(materialId);
    cache.fetch();
    // If data is already cached (e.g. from the probe), sync immediately.
    if (!cache.loading() && cache.data() !== null) {
      this.unitsLoading.set(false);
      const units = cache.data() ?? [];
      this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
      if (units.length > 0) {
        this.materialsWithUnits.update((set) => addedTo(set, materialId));
      }
      if (units.length === 0) {
        this.materialsWithUnits.update((set) => removedFrom(set, materialId));
        onEmpty?.(materialId);
      }
      return;
    }
    // Poll until the fetch completes, then sync the result into the local map.
    const poll = setInterval(() => {
      if (!cache.loading()) {
        clearInterval(poll);
        this.unitsLoading.set(false);
        if (cache.error()) {
          this.unitsError.set(cache.error());
        } else {
          const units = cache.data() ?? [];
          this.unitsByMaterial.update((map) => ({ ...map, [materialId]: units }));
          if (units.length > 0) {
            this.materialsWithUnits.update((set) => addedTo(set, materialId));
          }
          if (units.length === 0) {
            this.materialsWithUnits.update((set) => removedFrom(set, materialId));
            onEmpty?.(materialId);
          }
        }
      }
    }, 50);
  }
}
