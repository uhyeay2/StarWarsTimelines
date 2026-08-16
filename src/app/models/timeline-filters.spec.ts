import { TimelineEvent } from './timeline-event';
import {
  collectFacetOptions,
  collectTreeLeaves,
  createEmptyFilters,
  matchesFacetFilters,
  matchesFilters,
  sourceChipsForEvent,
  sourceFacetKey,
  TimelineFilters,
} from './timeline-filters';

const EVENT: TimelineEvent = {
  id: 'e1',
  canon: ['Canon'],
  title: 'Test Event',
  description: 'Description',
  source: { title: 'A New Hope', medium: 'Movie' },
  locations: ['Naboo', 'Coruscant'],
  characters: ['Padme Amidala', 'Darth Maul'],
  vehicles: ['Sith Infiltrator'],
  year: 0,
  displayDate: '0 BBY',
};

const OTHER_EVENT: TimelineEvent = {
  id: 'e2',
  canon: ['Canon', 'Legends'],
  title: 'Other Event',
  description: 'Description',
  source: { title: 'The Clone Wars', medium: 'Animated Show' as const },
  locations: ['Mandalore'],
  characters: ['Ahsoka Tano'],
  vehicles: [],
  year: -19,
  displayDate: '19 BBY',
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

  it('matches when the event source is among the selected sources', () => {
    const filters = { ...createEmptyFilters(), sources: ['A New Hope', 'The Clone Wars'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(true);
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
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show' as const,
        sourceId: 'material-tcw',
        unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
      },
    };
    expect(matchesFacetFilters(seasonEvent, { ...createEmptyFilters(), sources: ['material-tcw:7'] })).toBe(true);
  });

  it('rejects a season source key that does not match the event season', () => {
    const seasonEvent: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show' as const,
        sourceId: 'material-tcw',
        unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
      },
    };
    expect(matchesFacetFilters(seasonEvent, { ...createEmptyFilters(), sources: ['material-tcw:2'] })).toBe(false);
    expect(matchesFacetFilters(seasonEvent, { ...createEmptyFilters(), sources: ['material-tcw'] })).toBe(false);
  });

  it('matches an ungrouped event by its source id key', () => {
    const event: TimelineEvent = {
      ...EVENT,
      source: { title: 'A New Hope', medium: 'Movie', sourceId: 'material-anh' },
    };
    expect(matchesFacetFilters(event, { ...createEmptyFilters(), sources: ['material-anh'] })).toBe(true);
  });

  it('matches an issue source key against a comic event', () => {
    const issueEvent: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'Dawn of the Jedi',
        medium: 'Comic',
        sourceId: 'material-dotj',
        unit: { unitType: 'Issue', groupNumber: 2, number: 1 },
      },
    };
    expect(
      matchesFacetFilters(issueEvent, { ...createEmptyFilters(), sources: ['material-dotj:2:1'] }),
    ).toBe(true);
    expect(
      matchesFacetFilters(issueEvent, { ...createEmptyFilters(), sources: ['material-dotj:2:2'] }),
    ).toBe(false);
  });

  it('matches a chapter source key against a book event', () => {
    const chapterEvent: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'Shatterpoint',
        medium: 'Book' as const,
        sourceId: 'material-shatterpoint',
        unit: { unitType: 'Chapter', number: 2 },
      },
    };
    expect(
      matchesFacetFilters(chapterEvent, {
        ...createEmptyFilters(),
        sources: ['material-shatterpoint:chapter-2'],
      }),
    ).toBe(true);
    expect(
      matchesFacetFilters(chapterEvent, {
        ...createEmptyFilters(),
        sources: ['material-shatterpoint:chapter-1'],
      }),
    ).toBe(false);
    expect(matchesFacetFilters(chapterEvent, { ...createEmptyFilters(), sources: ['material-shatterpoint'] })).toBe(
      false,
    );
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
    expect(sourceFacetKey(EVENT)).toBe('A New Hope');
  });

  it('uses the source id when the event has no unit group', () => {
    const event: TimelineEvent = {
      ...EVENT,
      source: { title: 'A New Hope', medium: 'Movie', sourceId: 'material-anh' },
    };
    expect(sourceFacetKey(event)).toBe('material-anh');
  });

  it('combines the source id and group number for grouped units', () => {
    const event: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show' as const,
        sourceId: 'material-tcw',
        unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
      },
    };
    expect(sourceFacetKey(event)).toBe('material-tcw:7');
  });

  it('combines the source id, volume and issue number for comic issues', () => {
    const event: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'Dawn of the Jedi',
        medium: 'Comic',
        sourceId: 'material-dotj',
        unit: { unitType: 'Issue', groupNumber: 2, number: 1 },
      },
    };
    expect(sourceFacetKey(event)).toBe('material-dotj:2:1');
  });

  it('combines the source id and chapter number for book chapters', () => {
    const event: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'Shatterpoint',
        medium: 'Book' as const,
        sourceId: 'material-shatterpoint',
        unit: { unitType: 'Chapter', number: 2 },
      },
    };
    expect(sourceFacetKey(event)).toBe('material-shatterpoint:chapter-2');
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
        source: { title: 'The Phantom Menace', medium: 'Movie', sourceId: 'material-tpm' },
      },
      {
        ...EVENT,
        source: { title: 'A New Hope', medium: 'Movie', sourceId: 'material-anh' },
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Movie',
        label: 'Movie',
        children: [
          { value: 'material-anh', label: 'A New Hope' },
          { value: 'material-tpm', label: 'The Phantom Menace' },
        ],
      },
    ]);
  });

  it('keys source options by source id when no group is present', () => {
    const options = collectFacetOptions([
      { ...EVENT, source: { title: 'A New Hope', medium: 'Movie', sourceId: 'material-anh' } },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Movie',
        label: 'Movie',
        children: [{ value: 'material-anh', label: 'A New Hope' }],
      },
    ]);
  });

  it('creates one season option per show season', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
        },
      },
      {
        ...EVENT,
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 2, number: 3 },
        },
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Animated Show',
        label: 'Animated Show',
        children: [
          {
            value: 'material-tcw',
            label: 'The Clone Wars',
            children: [
              { value: 'material-tcw:2', label: 'Season 2' },
              { value: 'material-tcw:7', label: 'Season 7' },
            ],
          },
        ],
      },
    ]);
  });

  it('labels comic volume options with Volume and nests issues beneath them', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        source: {
          title: 'Dawn of the Jedi',
          medium: 'Comic',
          sourceId: 'material-dotj',
          unit: { unitType: 'Issue', groupNumber: 1, number: 1 },
        },
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Comic',
        label: 'Comic',
        children: [
          {
            value: 'material-dotj',
            label: 'Dawn of the Jedi',
            children: [
              {
                value: 'material-dotj:1',
                label: 'Volume 1',
                children: [{ value: 'material-dotj:1:1', label: 'Issue 1' }],
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
        source: {
          title: 'Shatterpoint',
          medium: 'Book' as const,
          sourceId: 'material-shatterpoint',
          unit: { unitType: 'Chapter', number: 1 },
        },
      },
      {
        ...EVENT,
        source: {
          title: 'Shatterpoint',
          medium: 'Book' as const,
          sourceId: 'material-shatterpoint',
        unit: { unitType: 'Chapter' as const, number: 3 },
        },
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Book',
        label: 'Book',
        children: [
          {
            value: 'material-shatterpoint',
            label: 'Shatterpoint',
            children: [
              { value: 'material-shatterpoint:chapter-1', label: 'Chapter 1' },
              { value: 'material-shatterpoint:chapter-3', label: 'Chapter 3' },
            ],
          },
        ],
      },
    ]);
  });

  it('nestles a material with both unit-linked and plain events under one parent', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show' as const,
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
        },
      },
      {
        ...EVENT,
        source: { title: 'The Clone Wars', medium: 'Animated Show' as const, sourceId: 'material-tcw' },
      },
    ]);
    expect(options.sources).toEqual([
      {
        value: 'medium:Animated Show',
        label: 'Animated Show',
        children: [
          {
            value: 'material-tcw',
            label: 'The Clone Wars',
            children: [
              { value: 'material-tcw', label: 'The Clone Wars — Whole' },
              { value: 'material-tcw:7', label: 'Season 7' },
            ],
          },
        ],
      },
    ]);
  });
});

describe('collectTreeLeaves', () => {
  it('returns the value of a leaf node', () => {
    expect(collectTreeLeaves({ value: 'material-anh', label: 'A New Hope' })).toEqual(['material-anh']);
  });

  it('returns every descendant leaf value of a parent node', () => {
    const parent = {
      value: 'material-tcw',
      label: 'The Clone Wars',
      children: [
        { value: 'material-tcw:2', label: 'Season 2' },
        { value: 'material-tcw:7', label: 'Season 7' },
      ],
    };
    expect(collectTreeLeaves(parent)).toEqual(['material-tcw:2', 'material-tcw:7']);
  });

  it('collects leaves from a medium node spanning multiple materials and units', () => {
    const medium = {
      value: 'medium:Animated Show',
      label: 'Animated Show',
      children: [
        {
          value: 'material-tcw',
          label: 'The Clone Wars',
          children: [
            { value: 'material-tcw:2', label: 'Season 2' },
            { value: 'material-tcw:7', label: 'Season 7' },
          ],
        },
      ],
    };
    expect(collectTreeLeaves(medium)).toEqual(['material-tcw:2', 'material-tcw:7']);
  });
});

const SHOW_TREE = [
  {
    value: 'medium:Animated Show',
    label: 'Animated Show',
    children: [
      {
        value: 'material-tcw',
        label: 'The Clone Wars',
        children: [
          { value: 'material-tcw:2', label: 'Season 2' },
          { value: 'material-tcw:7', label: 'Season 7' },
        ],
      },
      { value: 'material-rebels', label: 'Rebels' },
    ],
  },
];

const SHATTERPOINT_TREE = [
  {
    value: 'medium:Book',
    label: 'Book',
    children: [
      {
        value: 'material-shatterpoint',
        label: 'Shatterpoint',
        children: [
          { value: 'material-shatterpoint:chapter-1', label: 'Chapter 1' },
          { value: 'material-shatterpoint:chapter-3', label: 'Chapter 3' },
        ],
      },
    ],
  },
];

describe('sourceChipsForEvent', () => {
  it('builds a medium chip with every leaf under the medium, then a material chip', () => {
    const event = {
      ...EVENT,
      source: { title: 'The Clone Wars', medium: 'Animated Show' as const, sourceId: 'material-tcw' },
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Animated Show', values: ['material-tcw:2', 'material-tcw:7', 'material-rebels'], medium: true },
      { label: 'The Clone Wars', values: ['material-tcw:2', 'material-tcw:7'] },
    ]);
  });

  it('adds a season chip for an episode with a group', () => {
    const event = {
      ...EVENT,
      source: {
        title: 'The Clone Wars',
        medium: 'Animated Show' as const,
        sourceId: 'material-tcw',
        unit: { unitType: 'Episode' as const, groupNumber: 7, number: 9 },
      },
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Animated Show', values: ['material-tcw:2', 'material-tcw:7', 'material-rebels'], medium: true },
      { label: 'The Clone Wars', values: ['material-tcw:2', 'material-tcw:7'] },
      { label: 'Season 7', values: ['material-tcw:7'] },
    ]);
  });

  it('adds a chapter chip for a chapter unit', () => {
    const event = {
      ...EVENT,
      source: {
        title: 'Shatterpoint',
        medium: 'Book' as const,
        sourceId: 'material-shatterpoint',
        unit: { unitType: 'Chapter' as const, number: 3 },
      },
    };
    expect(sourceChipsForEvent(event, SHATTERPOINT_TREE)).toEqual([
      { label: 'Book', values: ['material-shatterpoint:chapter-1', 'material-shatterpoint:chapter-3'], medium: true },
      { label: 'Shatterpoint', values: ['material-shatterpoint:chapter-1', 'material-shatterpoint:chapter-3'] },
      { label: 'Chapter 3', values: ['material-shatterpoint:chapter-3'] },
    ]);
  });

  it('falls back to a title chip when the material is not in the tree', () => {
    const event = {
      ...EVENT,
      source: { title: 'Mystery Material', medium: 'Video Game' as const, sourceId: 'material-mystery' },
    };
    expect(sourceChipsForEvent(event, SHOW_TREE)).toEqual([
      { label: 'Mystery Material', values: ['material-mystery'] },
    ]);
  });
});
