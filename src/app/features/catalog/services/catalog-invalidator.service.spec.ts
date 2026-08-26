import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CatalogInvalidator } from './catalog-invalidator.service';
import { CharacterService } from './character.service';
import { LocationService } from './location.service';
import { VehicleService } from './vehicle.service';
import { SpeciesService } from './species.service';
import { SourceMaterialService } from './source-material.service';

describe('CatalogInvalidator', () => {
  let invalidator: CatalogInvalidator;
  let characterService: { invalidate: ReturnType<typeof vi.fn> };
  let locationService: { invalidate: ReturnType<typeof vi.fn> };
  let vehicleService: { invalidate: ReturnType<typeof vi.fn> };
  let speciesService: { invalidate: ReturnType<typeof vi.fn> };
  let sourceMaterialService: {
    invalidateMaterials: ReturnType<typeof vi.fn>;
    invalidateUnitCache: ReturnType<typeof vi.fn>;
    invalidateUnitById: ReturnType<typeof vi.fn>;
    invalidateAllUnitCaches: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    characterService = { invalidate: vi.fn() };
    locationService = { invalidate: vi.fn() };
    vehicleService = { invalidate: vi.fn() };
    speciesService = { invalidate: vi.fn() };
    sourceMaterialService = {
      invalidateMaterials: vi.fn(),
      invalidateUnitCache: vi.fn(),
      invalidateUnitById: vi.fn(),
      invalidateAllUnitCaches: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CatalogInvalidator,
        { provide: CharacterService, useValue: characterService },
        { provide: LocationService, useValue: locationService },
        { provide: VehicleService, useValue: vehicleService },
        { provide: SpeciesService, useValue: speciesService },
        { provide: SourceMaterialService, useValue: sourceMaterialService },
      ],
    });

    invalidator = TestBed.inject(CatalogInvalidator);
  });

  it('invalidates character caches for characters entity', () => {
    invalidator.invalidateEntity('characters');
    expect(characterService.invalidate).toHaveBeenCalledOnce();
  });

  it('invalidates location caches for locations entity', () => {
    invalidator.invalidateEntity('locations');
    expect(locationService.invalidate).toHaveBeenCalledOnce();
  });

  it('invalidates vehicle caches for vehicles entity', () => {
    invalidator.invalidateEntity('vehicles');
    expect(vehicleService.invalidate).toHaveBeenCalledOnce();
  });

  it('invalidates species caches for species entity', () => {
    invalidator.invalidateEntity('species');
    expect(speciesService.invalidate).toHaveBeenCalledOnce();
  });

  it('invalidates materials and optionally unit cache for source-materials', () => {
    invalidator.invalidateEntity('source-materials', 42);
    expect(sourceMaterialService.invalidateMaterials).toHaveBeenCalledOnce();
    expect(sourceMaterialService.invalidateUnitCache).toHaveBeenCalledWith(42);
  });

  it('invalidates only materials when no id for source-materials', () => {
    invalidator.invalidateEntity('source-materials');
    expect(sourceMaterialService.invalidateMaterials).toHaveBeenCalledOnce();
    expect(sourceMaterialService.invalidateUnitCache).not.toHaveBeenCalled();
  });

  it('invalidates unit by id for source-material-units', () => {
    invalidator.invalidateEntity('source-material-units', 10);
    expect(sourceMaterialService.invalidateUnitById).toHaveBeenCalledWith(10);
  });

  it('invalidates all unit caches for source-material-units without id', () => {
    invalidator.invalidateEntity('source-material-units');
    expect(sourceMaterialService.invalidateAllUnitCaches).toHaveBeenCalledOnce();
  });

  it('invalidateAll calls all services', () => {
    invalidator.invalidateAll();
    expect(characterService.invalidate).toHaveBeenCalledOnce();
    expect(locationService.invalidate).toHaveBeenCalledOnce();
    expect(vehicleService.invalidate).toHaveBeenCalledOnce();
    expect(speciesService.invalidate).toHaveBeenCalledOnce();
    expect(sourceMaterialService.invalidateMaterials).toHaveBeenCalledOnce();
    expect(sourceMaterialService.invalidateAllUnitCaches).toHaveBeenCalledOnce();
  });
});
