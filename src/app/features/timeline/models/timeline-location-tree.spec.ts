import { describe, expect, it } from 'vitest';
import {
  ApiPlanetSystem,
  ApiRegion,
  ApiSubregion,
  ApiPlanet,
} from '../../../shared/models/api-galaxy';
import { buildLocationFilterTree, TimelineLocationTreeData } from './timeline-location-tree';

const MID_RIM: ApiRegion = {
  id: 1,
  name: 'Mid Rim',
  description: null,
  subregions: [{ id: 10, name: 'Chommell Sector' }],
};

const OUTER_RIM: ApiRegion = {
  id: 2,
  name: 'Outer Rim',
  description: null,
  subregions: [{ id: 20, name: 'Arkanis Sector' }],
};

const CHOMELL: ApiSubregion = {
  id: 10,
  name: 'Chommell Sector',
  sectorType: 'Sector',
  description: null,
  regions: [{ id: 1, name: 'Mid Rim' }],
  planetSystems: [{ id: 100, name: 'Naboo System' }],
};

const ARKANIS: ApiSubregion = {
  id: 20,
  name: 'Arkanis Sector',
  sectorType: 'Sector',
  description: null,
  regions: [{ id: 2, name: 'Outer Rim' }],
  planetSystems: [{ id: 200, name: 'Tatoo' }],
};

const NABOO_SYSTEM: ApiPlanetSystem = {
  id: 100,
  name: 'Naboo System',
  coordinates: null,
  description: null,
  subregions: [{ id: 10, name: 'Chommell Sector' }],
};

const TATOO_SYSTEM: ApiPlanetSystem = {
  id: 200,
  name: 'Tatoo',
  coordinates: null,
  description: null,
  subregions: [{ id: 20, name: 'Arkanis Sector' }],
};

const NABOO: ApiPlanet = {
  id: 1000,
  name: 'Naboo',
  description: null,
  planetSystemId: 100,
  planetSystemName: 'Naboo System',
  locations: [{ id: 9000, name: 'Theed' }],
};

const TATOOINE: ApiPlanet = {
  id: 2000,
  name: 'Tatooine',
  description: null,
  planetSystemId: 200,
  planetSystemName: 'Tatoo',
  locations: [
    { id: 9001, name: 'Lars Homestead' },
    { id: 9002, name: 'Mos Eisley' },
  ],
};

function data(overrides: Partial<TimelineLocationTreeData> = {}): TimelineLocationTreeData {
  return {
    regions: [MID_RIM, OUTER_RIM],
    subregions: [CHOMELL, ARKANIS],
    planetSystems: [NABOO_SYSTEM, TATOO_SYSTEM],
    planets: [NABOO, TATOOINE],
    ...overrides,
  };
}

describe('buildLocationFilterTree', () => {
  it('groups places as Region -> Subregion -> System -> Planet -> Location', () => {
    const tree = buildLocationFilterTree(data());
    expect(tree.map((n) => n.label)).toEqual(['Mid Rim', 'Outer Rim']);
    expect(tree[0]).toMatchObject({
      value: 'Mid Rim',
      ownLeaf: true,
      children: [
        {
          value: 'Chommell Sector',
          ownLeaf: true,
          children: [
            {
              value: 'Naboo System',
              ownLeaf: true,
              children: [
                {
                  value: 'Naboo',
                  ownLeaf: true,
                  children: [{ value: 'Theed' }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('sorts location children alphabetically', () => {
    const tatooine = buildLocationFilterTree(data())[1]!.children![0]!.children![0]!.children![0]!;
    expect(tatooine.value).toBe('Tatooine');
    expect(tatooine.children!.map((n) => n.value)).toEqual(['Lars Homestead', 'Mos Eisley']);
  });

  it('sorts regions and orphan fall-backs alphabetically', () => {
    const tree = buildLocationFilterTree(data({ regions: null }));
    expect(tree.map((n) => n.label)).toEqual([
      'Arkanis Sector',
      'Chommell Sector',
      'Naboo',
      'Naboo System',
      'Tatoo',
      'Tatooine',
    ]);
  });

  it('appends orphaned places that are not reachable from a region', () => {
    const unlinkedSystem: ApiPlanetSystem = {
      id: 300,
      name: 'Uncharted System',
      coordinates: null,
      description: null,
      subregions: [],
    };
    const tree = buildLocationFilterTree(
      data({ planetSystems: [NABOO_SYSTEM, TATOO_SYSTEM, unlinkedSystem] }),
    );
    const labels = tree.map((n) => n.label);
    expect(labels).toContain('Uncharted System');
  });

  it('returns an empty tree when no galaxy data is loaded', () => {
    expect(
      buildLocationFilterTree({
        regions: null,
        subregions: null,
        planetSystems: null,
        planets: null,
      }),
    ).toEqual([]);
  });
});
