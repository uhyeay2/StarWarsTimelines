/**
 * @fileoverview Coordinates cache invalidation across all catalog entity
 * types. Routes SSE-driven entity-type strings to the correct service's
 * invalidation method.
 */
import { inject, Injectable } from '@angular/core';
import { CharacterService } from './character.service';
import { LocationService } from './location.service';
import { VehicleService } from './vehicle.service';
import { SpeciesService } from './species.service';
import { SourceMaterialService } from './source-material.service';
import { CatalogEntityType } from './catalog-constants';

/**
 * Coordinates cache invalidation across all catalog entity types.
 *
 * This is the single dispatch point for SSE-driven invalidation events.
 * Each per-entity service owns its own cache; this service knows how to
 * route an entity-type string to the correct service's invalidation method.
 */
@Injectable({ providedIn: 'root' })
export class CatalogInvalidator {
  private readonly characterService = inject(CharacterService);
  private readonly locationService = inject(LocationService);
  private readonly vehicleService = inject(VehicleService);
  private readonly speciesService = inject(SpeciesService);
  private readonly sourceMaterialService = inject(SourceMaterialService);

  /**
   * Invalidates caches affected by a change to the given entity type.
   *
   * When an `id` is provided, only the specific affected cache is invalidated
   * rather than the entire collection.
   */
  invalidateEntity(entity: CatalogEntityType, id?: number): void {
    switch (entity) {
      case 'characters':
        this.characterService.invalidate();
        break;
      case 'locations':
        this.locationService.invalidate();
        break;
      case 'vehicles':
        this.vehicleService.invalidate();
        break;
      case 'species':
        this.speciesService.invalidate();
        break;
      case 'source-materials':
        this.sourceMaterialService.invalidateMaterials();
        if (id) {
          this.sourceMaterialService.invalidateUnitCache(id);
        }
        break;
      case 'source-material-units':
        if (id) {
          this.sourceMaterialService.invalidateUnitById(id);
        } else {
          this.sourceMaterialService.invalidateAllUnitCaches();
        }
        break;
    }
  }

  /**
   * Invalidates all caches. Useful for full refresh scenarios.
   */
  invalidateAll(): void {
    this.characterService.invalidate();
    this.locationService.invalidate();
    this.vehicleService.invalidate();
    this.speciesService.invalidate();
    this.sourceMaterialService.invalidateMaterials();
    this.sourceMaterialService.invalidateAllUnitCaches();
  }
}
