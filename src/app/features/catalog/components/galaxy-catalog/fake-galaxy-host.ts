import { vi } from 'vitest';
import { GalaxyCatalogHost } from '../../models/galaxy-catalog-models';

/**
 * Builds a fake {@link GalaxyCatalogHost} for unit-testing the extracted
 * galaxy list components in isolation. Every method is a `vi.fn()` spy;
 * pass `overrides` to control the default answers (nonzero expansion etc.).
 */
export function createFakeGalaxyHost(
  overrides: Partial<GalaxyCatalogHost> = {},
): GalaxyCatalogHost {
  return {
    isAdmin: vi.fn(() => true),
    isExpanded: vi.fn(() => false),
    toggleExpanded: vi.fn(),
    togglePlanet: vi.fn(),
    startEditRegion: vi.fn(),
    startEditSubregion: vi.fn(),
    startEditSystem: vi.fn(),
    startEditPlanet: vi.fn(),
    startEditLocation: vi.fn(),
    requestDelete: vi.fn(),
    openAddSubregion: vi.fn(),
    openAddSystem: vi.fn(),
    openAddPlanet: vi.fn(),
    openAddLocation: vi.fn(),
    ...overrides,
  };
}
