import { Canon } from '../../../shared/models/canon';
import { SourceMaterialUnit } from '../../../shared/models/source-material';
import { TimelineEvent } from './timeline-event';
import {
  collectFacetOptions,
  collectTreeLeaves,
  createEmptyFilters,
  eventSourceFacetKeys,
  matchesFacetFilters,
  matchesFilters,
  sourceChipsForEvent,
  sourceFacetKey,
  TimelineFilters,
} from './timeline-filters';

const EVENT: TimelineEvent = {
  id: 1,
  canon: ['Canon'],
  title: 'Test Event',
  description: 'Description',
  sources: [{ title: 'A New Hope', medium: 'Movie', canon: ['Canon'] as readonly Canon[] }],
  locations: ['Naboo', 'Coruscant'],
  characters: ['Padme Amidala', 'Darth Maul'],
  vehicles: ['Sith Infiltrator'],
  yearStart: 0,
  yearEnd: 0,
  sequence: 1,
};

const OTHER_EVENT: TimelineEvent = {
  id: 2,
  canon: ['Canon', 'Legends'],
  title: 'Other Event',
  description: 'Description',
  sources: [
    { title: 'The Clone Wars', medium: 'Animated Show' as const, canon: ['Canon', 'Legends'] },
  ],
  locations: ['Mandalore'],
  characters: ['Ahsoka Tano'],
  vehicles: [],
  yearStart: -19,
  yearEnd: -19,
  sequence: 2,
};

describe('matchesFacetFilters', () => {
  it('matches when all selected characters are present', () => {
    const filters = { ...createEmptyFilters(), characters: ['Padme Amidala', 'Darth Maul'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(true);
  });

  it('rejects when only some selected characters are present', () => {
    const filters = { ...createEmptyFilters(), characters: ['Padme Amidala', 'Anakin Skywalker'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(false);
  });

  it('matches when all selected locations are present', () => {
    const filters = { ...createEmptyFilters(), locations: ['Naboo', 'Coruscant'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(true);
  });

  it('rejects when a selected location is missing', () => {
    const filters = { ...createEmptyFilters(), locations: ['Naboo', 'Endor'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(false);
  });

  it('matches when any of the event sources is among the selected sources', () => {
    const filters = { ...createEmptyFilters(), sources: ['A New Hope', 'The Clone Wars'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(true);
    expect(matchesFacetFilters(OTHER_EVENT, filters)).toBe(true);
  });

  it('rejects when none of the event sources are selected', () => {
    const filters = { ...createEmptyFilters(), sources: ['Rebels'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(false);
  });

  it('rejects when a selected vehicle is missing', () => {
    const filters = { ...createEmptyFilters(), vehicles: ['Sith Infiltrator', 'Death Star'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(false);
  });

  it('returns true when no facet filters are active', () => {
    expect(matchesFacetFilters(EVENT, createEmptyFilters())).toBe(true);
  });

  it('matches a season source key against a unit-linked event', () => {
    const seasonEvent: TimelineEvent = {
      ...EVENT,
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          canon: ['Canon'],
          sourceId: 20,
          unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
        },
      ],
    };
    expect(matchesFacetFilters(seasonEvent, { ...createEmptyFilters(), sources: ['20:77'] })).toBe(true);
  });

  it('rejects a season source key that does not match the event season', () => {
    const seasonEvent: TimelineEvent = {
      ...EVENT,
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          canon: ['Canon'],
          sourceId: 20,
          unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
        },
      ],
    };
    expect(matchesFacetFilters(seasonEvent, { ...createEmptyFilters(), sources: ['20:22'] })).toBe(false);
    expect(matchesFacetFilters(seasonEvent, { ...createEmptyFilters(), sources: ['20'] })).toBe(false);
  });

  it('matches an ungrouped event by its source id key', () => {
    const event: TimelineEvent = {
      ...EVENT,
      sources: [
        { title: 'A New Hope', medium: 'Movie', canon: ['Canon'], sourceId: 10 },
      ],
    };
    expect(matchesFacetFilters(event, { ...createEmptyFilters(), sources: ['10'] })).toBe(true);
  });

  it('matches an issue source key against a comic event', () => {
    const issueEvent: TimelineEvent = {
      ...EVENT,
      sources: [
        {
          title: 'Dawn of the Jedi',
          medium: 'Comic',
          canon: ['Legends'],
          sourceId: 30,
          unit: { unitType: 'Issue', id: 31, parentUnitId: 72, number: 1 },
        },
      ],
    };
    expect(
      matchesFacetFilters(issueEvent, { ...createEmptyFilters(), sources: ['30:72:31'] }),
    ).toBe(true);
    expect(
      matchesFacetFilters(issueEvent, { ...createEmptyFilters(), sources: ['30:72:32'] }),
    ).toBe(false);
  });

  it('matches a chapter source key against a book event', () => {
    const chapterEvent: TimelineEvent = {
      ...EVENT,
      sources: [
        {
          title: 'Shatterpoint',
          medium: 'Book' as const,
          canon: ['Legends'],
          sourceId: 40,
          unit: { unitType: 'Chapter', id: 42, number: 2 },
        },
      ],
    };
    expect(
      matchesFacetFilters(chapterEvent, {
        ...createEmptyFilters(),
        sources: ['40:u42'],
      }),
    ).toBe(true);
    expect(
      matchesFacetFilters(chapterEvent, {
        ...createEmptyFilters(),
        sources: ['40:u41'],
      }),
    ).toBe(false);
    expect(matchesFacetFilters(chapterEvent, { ...createEmptyFilters(), sources: ['40'] })).toBe(
      false,
    );
  });

  it('matches a nested book key only for events pinned to that book', () => {
    const bookEvent: TimelineEvent = {
      ...EVENT,
      sources: [
        {
          title: 'Thrawn Ascendancy Trilogy',
          medium: 'Book' as const,
          canon: ['Canon'],
          sourceId: 23,
          unit: { id: 74, unitType: 'Book', parentUnitId: 73, number: 1, title: 'Chaos Rising' },
        },
      ],
    };
    expect(
      matchesFacetFilters(bookEvent, { ...createEmptyFilters(), sources: ['23:u74'] }),
    ).toBe(true);
    expect(
      matchesFacetFilters(bookEvent, { ...createEmptyFilters(), sources: ['23:u78'] }),
    ).toBe(false);
    expect(matchesFacetFilters(bookEvent, { ...createEmptyFilters(), sources: ['23'] })).toBe(
      false,
    );
  });

  it('matches a multi-source event when only one of its sources is selected', () => {
    const dualEvent: TimelineEvent = {
      ...EVENT,
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          canon: ['Canon'],
          sourceId: 20,
          unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
        },
        { title: 'Shatterpoint', medium: 'Book' as const, canon: ['Legends'], sourceId: 50 },
      ],
    };
    expect(
      matchesFacetFilters(dualEvent, { ...createEmptyFilters(), sources: ['50'] }),
    ).toBe(true);
    expect(
      matchesFacetFilters(dualEvent, { ...createEmptyFilters(), sources: ['60'] }),
    ).toBe(false);
  });
});

describe('matchesFilters', () => {
  it('applies the canon view on top of facet filters', () => {
    const filters: TimelineFilters = { ...createEmptyFilters(), canonView: 'Legends' };
    expect(matchesFilters(EVENT, filters)).toBe(false);
  });

  it('matches a canon event in the Canon view', () => {
    const filters: TimelineFilters = { ...createEmptyFilters(), canonView: 'Canon' };
    expect(matchesFilters(EVENT, filters)).toBe(true);
  });
});

describe('sourceFacetKey', () => {
  it('falls back to the source title when there is no source id', () => {
    expect(sourceFacetKey({ title: 'A New Hope', medium: 'Movie', canon: [] })).toBe('A New Hope');
  });

  it('uses the source id when the source has no unit group', () => {
    expect(sourceFacetKey({ title: 'A New Hope', medium: 'Movie', canon: [], sourceId: 10 })).toBe(
      '10',
    );
  });

  it('combines the source id and parent unit id for grouped units', () => {
    expect(
      sourceFacetKey({
        title: 'The Clone Wars',
        medium: 'Animated Show',
        canon: [],
        sourceId: 20,
        unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
      }),
    ).toBe('20:77');
  });

  it('combines the source id, volume and issue id for comic issues', () => {
    expect(
      sourceFacetKey({
        title: 'Dawn of the Jedi',
        medium: 'Comic',
        canon: [],
        sourceId: 30,
        unit: { unitType: 'Issue', id: 31, parentUnitId: 72, number: 1 },
      }),
    ).toBe('30:72:31');
  });

  it('combines the source id and chapter id for book chapters', () => {
    expect(
      sourceFacetKey({
        title: 'Shatterpoint',
        medium: 'Book',
        canon: [],
        sourceId: 40,
        unit: { unitType: 'Chapter', id: 42, number: 2 },
      }),
    ).toBe('40:u42');
  });

  it('addresses a nested book by its own unit id', () => {
    expect(
      sourceFacetKey({
        title: 'Thrawn Ascendancy Trilogy',
        medium: 'Book',
        canon: [],
        sourceId: 23,
        unit: { id: 74, unitType: 'Book', parentUnitId: 73, number: 1, title: 'Chaos Rising' },
      }),
    ).toBe('23:u74');
  });

  it('returns one key per depicting source on the event', () => {
    expect(eventSourceFacetKeys(OTHER_EVENT)).toEqual(['The Clone Wars']);
  });
});

describe('collectFacetOptions', () => {
  it('collects unique values across events, in display order', () => {
    const options = collectFacetOptions([EVENT, OTHER_EVENT]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Movie',
        label: 'Movie',
        children: [{ value: 'A New Hope', label: 'A New Hope' }],
      },
      {
        value: 'medium:Animated Show',
        label: 'Animated Show',
        children: [{ value: 'The Clone Wars', label: 'The Clone Wars' }],
      },
    ]);
    expect(options.locations).toEqual([
      { value: 'Coruscant', label: 'Coruscant' },
      { value: 'Mandalore', label: 'Mandalore' },
      { value: 'Naboo', label: 'Naboo' },
    ]);
    expect(options.characters).toEqual([
      { value: 'Ahsoka Tano', label: 'Ahsoka Tano' },
      { value: 'Darth Maul', label: 'Darth Maul' },
      { value: 'Padme Amidala', label: 'Padme Amidala' },
    ]);
    expect(options.vehicles).toEqual([{ value: 'Sith Infiltrator', label: 'Sith Infiltrator' }]);
  });

  it('groups materials under their medium and sorts them by label', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        sources: [
          { title: 'The Phantom Menace', medium: 'Movie', canon: [], sourceId: 70 },
        ],
      },
      {
        ...EVENT,
        sources: [
          { title: 'A New Hope', medium: 'Movie', canon: [], sourceId: 10 },
        ],
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Movie',
        label: 'Movie',
        children: [
          { value: '10', label: 'A New Hope' },
          { value: '70', label: 'The Phantom Menace' },
        ],
      },
    ]);
  });

  it('keys source options by source id when no group is present', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        sources: [{ title: 'A New Hope', medium: 'Movie', canon: [], sourceId: 10 }],
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Movie',
        label: 'Movie',
        children: [{ value: '10', label: 'A New Hope' }],
      },
    ]);
  });

  it('creates one season option per show season, labeled through the resolver', () => {
    const seasonLabels: Record<number, string> = { 22: 'Season 2', 77: 'Season 7' };
    const options = collectFacetOptions(
      [
        {
          ...EVENT,
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show' as const,
              canon: [],
              sourceId: 20,
              unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
            },
          ],
        },
        {
          ...EVENT,
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show' as const,
              canon: [],
              sourceId: 20,
              unit: { unitType: 'Episode', parentUnitId: 22, number: 3 },
            },
          ],
        },
      ],
      (_materialId, containerUnitId) => seasonLabels[containerUnitId],
    );
    expect(options.sources).toEqual([
      {
        value: 'medium:Animated Show',
        label: 'Animated Show',
        children: [
          {
            value: '20',
            label: 'The Clone Wars',
            children: [
              { value: '20:22', label: 'Season 2' },
              { value: '20:77', label: 'Season 7' },
            ],
          },
        ],
      },
    ]);
  });

  it('labels comic volume options with Volume and nests issues beneath them', () => {
    const options = collectFacetOptions(
      [
        {
          ...EVENT,
          sources: [
            {
              title: 'Dawn of the Jedi',
              medium: 'Comic',
              canon: [],
              sourceId: 30,
              unit: { unitType: 'Issue', id: 31, parentUnitId: 71, number: 1 },
            },
          ],
        },
      ],
      (_materialId, _containerUnitId) => 'Volume 1',
    );
    expect(options.sources).toEqual([
      {
        value: 'medium:Comic',
        label: 'Comic',
        children: [
          {
            value: '30',
            label: 'Dawn of the Jedi',
            children: [
              {
                value: '30:71',
                label: 'Volume 1',
                children: [{ value: '30:71:31', label: 'Issue 1' }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('creates one chapter option per book chapter', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        sources: [
          {
            title: 'Shatterpoint',
            medium: 'Book' as const,
            canon: [],
            sourceId: 40,
            unit: { unitType: 'Chapter', id: 41, number: 1 },
          },
        ],
      },
      {
        ...EVENT,
        sources: [
          {
            title: 'Shatterpoint',
            medium: 'Book' as const,
            canon: [],
            sourceId: 40,
            unit: { unitType: 'Chapter' as const, id: 43, number: 3 },
          },
        ],
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Book',
        label: 'Book',
        children: [
          {
            value: '40',
            label: 'Shatterpoint',
            children: [
              { value: '40:u41', label: 'Chapter 1' },
              { value: '40:u43', label: 'Chapter 3' },
            ],
          },
        ],
      },
    ]);
  });

  it('nestles a material with both unit-linked and plain events under one parent', () => {
    const options = collectFacetOptions(
      [
        {
          ...EVENT,
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show' as const,
              canon: [],
              sourceId: 20,
              unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
            },
          ],
        },
        {
          ...EVENT,
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show' as const,
              canon: [],
              sourceId: 20,
            },
          ],
        },
      ],
      (_materialId, _containerUnitId) => 'Season 7',
    );
    expect(options.sources).toEqual([
      {
        value: 'medium:Animated Show',
        label: 'Animated Show',
        children: [
          {
            value: '20',
            label: 'The Clone Wars',
            children: [
              { value: '20', label: 'The Clone Wars — Whole' },
              { value: '20:77', label: 'Season 7' },
            ],
          },
        ],
      },
    ]);
  });

  it('accumulates facets across every source of a multi-source event', () => {
    const options = collectFacetOptions(
      [
        {
          ...EVENT,
          sources: [
            {
              title: 'The Clone Wars',
              medium: 'Animated Show' as const,
              canon: ['Canon'],
              sourceId: 20,
              unit: { unitType: 'Episode', parentUnitId: 77, number: 9 },
            },
            {
              title: 'Dawn of the Jedi',
              medium: 'Comic',
              canon: ['Legends'],
              sourceId: 30,
              unit: { unitType: 'Issue', id: 31, parentUnitId: 71, number: 1 },
            },
          ],
        },
      ],
      (_materialId, _containerUnitId) => 'Resolved Container',
    );
    expect(options.sources[0]).toEqual({
      value: 'medium:Comic',
      label: 'Comic',
      children: [
        {
          value: '30',
          label: 'Dawn of the Jedi',
          children: [
            {
              value: '30:71',
              label: 'Resolved Container',
              children: [{ value: '30:71:31', label: 'Issue 1' }],
            },
          ],
        },
      ],
    });
    expect(options.sources[1]).toEqual({
      value: 'medium:Animated Show',
      label: 'Animated Show',
      children: [
        {
          value: '20',
          label: 'The Clone Wars',
          children: [{ value: '20:77', label: 'Resolved Container' }],
        },
      ],
    });
  });
});

describe('collectTreeLeaves', () => {
  it('returns the value of a leaf node', () => {
    expect(collectTreeLeaves({ value: '10', label: 'A New Hope' })).toEqual(['10']);
  });

  it('returns every descendant leaf value of a parent node', () => {
    const parent = {
      value: '20',
      label: 'The Clone Wars',
      children: [
        { value: '20:22', label: 'Season 2' },
        { value: '20:77', label: 'Season 7' },
      ],
    };
    expect(collectTreeLeaves(parent)).toEqual(['20:22', '20:77']);
  });

  it('collects leaves from a medium node spanning multiple materials and units', () => {
    const medium = {
      value: 'medium:Animated Show',
      label: 'Animated Show',
      children: [
        {
          value: '20',
          label: 'The Clone Wars',
          children: [
            { value: '20:22', label: 'Season 2' },
            { value: '20:77', label: 'Season 7' },
          ],
        },
      ],
    };
    expect(collectTreeLeaves(medium)).toEqual(['20:22', '20:77']);
  });
});

const SHOW_TREE = [
  {
    value: 'medium:Animated Show',
    label: 'Animated Show',
    children: [
      {
        value: '20',
        label: 'The Clone Wars',
        children: [
          { value: '20:22', label: 'Season 2' },
          { value: '20:77', label: 'Season 7' },
        ],
      },
      { value: '80', label: 'Rebels' },
    ],
  },
];

const SHATTERPOINT_TREE = [
  {
    value: 'medium:Book',
    label: 'Book',
    children: [
      {
        value: '40',
        label: 'Shatterpoint',
        children: [
          { value: '40:u41', label: 'Chapter 1' },
          { value: '40:u43', label: 'Chapter 3' },
        ],
      },
    ],
  },
];

describe('sourceChipsForEvent', () => {
  it('builds a medium chip with every leaf under the medium, then a material chip', () => {
    const event = {
      ...EVENT,
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          canon: [],
          sourceId: 20,
        },
      ],
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Animated Show', values: ['20:22', '20:77', '80'], medium: true },
      { label: 'The Clone Wars', values: ['20:22', '20:77'] },
    ]);
  });

  it('adds a season chip for an episode with a parent unit', () => {
    const event = {
      ...EVENT,
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          canon: [],
          sourceId: 20,
          unit: { unitType: 'Episode' as const, parentUnitId: 77, number: 9 },
        },
      ],
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Animated Show', values: ['20:22', '20:77', '80'], medium: true },
      { label: 'The Clone Wars', values: ['20:22', '20:77'] },
      { label: 'Season 7', values: ['20:77'] },
    ]);
  });

  it('adds a chapter chip for a chapter unit', () => {
    const event = {
      ...EVENT,
      sources: [
        {
          title: 'Shatterpoint',
          medium: 'Book' as const,
          canon: [],
          sourceId: 40,
          unit: { unitType: 'Chapter' as const, id: 43, number: 3 },
        },
      ],
    };
    expect(sourceChipsForEvent(event, SHATTERPOINT_TREE)).toEqual([
      { label: 'Book', values: ['40:u41', '40:u43'], medium: true },
      { label: 'Shatterpoint', values: ['40:u41', '40:u43'] },
      { label: 'Chapter 3', values: ['40:u43'] },
    ]);
  });

  it('falls back to a title chip when the material is not in the tree', () => {
    const event = {
      ...EVENT,
      sources: [
        {
          title: 'Mystery Material',
          medium: 'Video Game' as const,
          canon: [],
          sourceId: 90,
        },
      ],
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Mystery Material', values: ['90'] },
    ]);
  });

  it('emits one chip set per distinct source without duplicating shared media', () => {
    const event = {
      ...EVENT,
      sources: [
        {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          canon: [],
          sourceId: 20,
          unit: { unitType: 'Episode' as const, parentUnitId: 77, number: 9 },
        },
        {
          title: 'Rebels',
          medium: 'Animated Show' as const,
          canon: [],
          sourceId: 80,
        },
      ],
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Animated Show', values: ['20:22', '20:77', '80'], medium: true },
      { label: 'The Clone Wars', values: ['20:22', '20:77'] },
      { label: 'Season 7', values: ['20:77'] },
      { label: 'Rebels', values: ['80'] },
    ]);
  });

  it('falls back to title chips for every unknown source of a multi-source event', () => {
    const event = {
      ...EVENT,
      sources: [
        { title: 'Mystery A', medium: 'Video Game' as const, canon: [], sourceId: 91 },
        { title: 'Mystery B', medium: 'Book' as const, canon: [], sourceId: 92 },
      ],
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Mystery A', values: ['91'] },
      { label: 'Mystery B', values: ['92'] },
    ]);
  });

  it('keeps whole-show and season chips when they cover the same single season', () => {
    const singleSeasonTree = [
      {
        value: 'medium:Live Action Show',
        label: 'Live Action Show',
        children: [
          {
            value: '12',
            label: 'The Mandalorian',
            children: [{ value: '12:32', label: 'Season 1' }],
          },
        ],
      },
    ];
    const event = {
      ...EVENT,
      sources: [
        {
          title: 'The Mandalorian',
          medium: 'Live Action Show' as const,
          canon: [],
          sourceId: 12,
          unit: { unitType: 'Episode' as const, parentUnitId: 32, number: 8 },
        },
      ],
    };
    expect(sourceChipsForEvent(event, singleSeasonTree)).toEqual([
      { label: 'Live Action Show', values: ['12:32'], medium: true },
      { label: 'The Mandalorian', values: ['12:32'] },
      { label: 'Season 1', values: ['12:32'] },
    ]);
  });
});

const THRAWN_TREE = [
  {
    value: 'medium:Book',
    label: 'Book',
    children: [
      {
        value: '23',
        label: 'Thrawn Ascendancy Trilogy',
        children: [
          { value: '23:u74', label: 'Book 1: Chaos Rising' },
          { value: '23:u78', label: 'Book 2: Greater Good' },
        ],
      },
    ],
  },
];

describe('books within collections', () => {
  const bookEvent = (unit: SourceMaterialUnit): TimelineEvent => ({
    ...EVENT,
    sources: [
      {
        title: 'Thrawn Ascendancy Trilogy',
        medium: 'Book' as const,
        canon: [] as readonly Canon[],
        sourceId: 23,
        unit,
      },
    ],
  });

  it('creates one leaf per collection book, labeled from the unit', () => {
    const options = collectFacetOptions([
      bookEvent({ id: 78, unitType: 'Book', parentUnitId: 73, number: 2, title: 'Greater Good' }),
      bookEvent({ id: 74, unitType: 'Book', parentUnitId: 73, number: 1, title: 'Chaos Rising' }),
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Book',
        label: 'Book',
        children: [
          {
            value: '23',
            label: 'Thrawn Ascendancy Trilogy',
            children: [
              { value: '23:u74', label: 'Book 1: Chaos Rising' },
              { value: '23:u78', label: 'Book 2: Greater Good' },
            ],
          },
        ],
      },
    ]);
  });

  it('adds a chip for the pinned collection book alongside the collection chip', () => {
    const event = bookEvent({
      id: 74,
      unitType: 'Book',
      parentUnitId: 73,
      number: 1,
      title: 'Chaos Rising',
    });
    expect(sourceChipsForEvent(event, THRAWN_TREE)).toEqual([
      { label: 'Book', values: ['23:u74', '23:u78'], medium: true },
      { label: 'Thrawn Ascendancy Trilogy', values: ['23:u74', '23:u78'] },
      { label: 'Book 1: Chaos Rising', values: ['23:u74'] },
    ]);
  });

  it('emits only the pinned book key when its chip is clicked', () => {
    const event = bookEvent({
      id: 78,
      unitType: 'Book',
      parentUnitId: 73,
      number: 2,
      title: 'Greater Good',
    });
    const chips = sourceChipsForEvent(event, THRAWN_TREE);
    expect(chips.map((chip) => chip.label)).toContain('Book 2: Greater Good');
    expect(chips.find((chip) => chip.label === 'Book 2: Greater Good')?.values).toEqual(['23:u78']);
  });
});
