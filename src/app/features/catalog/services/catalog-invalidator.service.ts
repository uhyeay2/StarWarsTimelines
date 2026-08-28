/**
 * @fileoverview Coordinates cache invalidation across all catalog entity
 * types. Routes SSE-driven entity-type strings to the correct service's
 * invalidation method.
 */
import { inject, Injectable } from '@angular/core';
import { CharacterService } from './character.service';
import { GalaxyService } from './galaxy.service';
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
  private readonly galaxyService = inject(GalaxyService);
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
      case 'regions':
        this.galaxyService.invalidateRegions();
        break;
      case 'subregions':
        this.galaxyService.invalidateSubregions();
        break;
      case 'planet-systems':
        this.galaxyService.invalidatePlanetSystems();
        break;
      case 'planets':
        this.galaxyService.invalidatePlanets();
        // Character/species responses embed planet names, so a planet
        // rename/delete must refresh them too.
        this.characterService.invalidate();
        this.speciesService.invalidate();
        break;
      case 'planet-locations':
        this.galaxyService.invalidatePlanetLocations();
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
    this.galaxyService.invalidateRegions();
    this.galaxyService.invalidateSubregions();
    this.galaxyService.invalidatePlanetSystems();
    this.galaxyService.invalidatePlanets();
    this.vehicleService.invalidate();
    this.speciesService.invalidate();
    this.sourceMaterialService.invalidateMaterials();
    this.sourceMaterialService.invalidateAllUnitCaches();
  }
}
