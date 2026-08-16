import { TimelineEvent } from './timeline-event';
import {
  collectFacetOptions,
  createEmptyFilters,
  matchesFacetFilters,
  matchesFilters,
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
  source: { title: 'The Clone Wars', medium: 'Animated Show' },
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

  it('matches when the event medium is among the selected mediums', () => {
    const filters = { ...createEmptyFilters(), mediums: ['Book', 'Movie'] };
    expect(matchesFacetFilters(EVENT, filters)).toBe(true);
  });

  it('rejects when the event medium is not selected', () => {
    const filters = { ...createEmptyFilters(), mediums: ['Book'] };
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
        medium: 'Animated Show',
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
        medium: 'Animated Show',
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

  it('matches a chapter source key against a book event', () => {
    const chapterEvent: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'Shatterpoint',
        medium: 'Book',
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
        medium: 'Animated Show',
        sourceId: 'material-tcw',
        unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
      },
    };
    expect(sourceFacetKey(event)).toBe('material-tcw:7');
  });

  it('combines the source id and chapter number for book chapters', () => {
    const event: TimelineEvent = {
      ...EVENT,
      source: {
        title: 'Shatterpoint',
        medium: 'Book',
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
    expect(options.mediums).toEqual([
      { value: 'Movie', label: 'Movie' },
      { value: 'Animated Show', label: 'Animated Show' },
    ]);
    expect(options.sources).toEqual([
      { value: 'A New Hope', label: 'A New Hope' },
      { value: 'The Clone Wars', label: 'The Clone Wars' },
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

  it('keys source options by source id when no group is present', () => {
    const options = collectFacetOptions([
      { ...EVENT, source: { title: 'A New Hope', medium: 'Movie', sourceId: 'material-anh' } },
    ]);
    expect(options.sources).toEqual([{ value: 'material-anh', label: 'A New Hope' }]);
  });

  it('creates one season option per show season', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show',
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 7, number: 9 },
        },
      },
      {
        ...EVENT,
        source: {
          title: 'The Clone Wars',
          medium: 'Animated Show',
          sourceId: 'material-tcw',
          unit: { unitType: 'Episode', groupNumber: 2, number: 3 },
        },
      },
    ]);
    expect(options.sources).toEqual([
      { value: 'material-tcw:2', label: 'The Clone Wars — Season 2' },
      { value: 'material-tcw:7', label: 'The Clone Wars — Season 7' },
    ]);
  });

  it('labels comic volume options with Volume', () => {
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
    expect(options.sources).toEqual([{ value: 'material-dotj:1', label: 'Dawn of the Jedi — Volume 1' }]);
  });

  it('creates one chapter option per book chapter', () => {
    const options = collectFacetOptions([
      {
        ...EVENT,
        source: {
          title: 'Shatterpoint',
          medium: 'Book',
          sourceId: 'material-shatterpoint',
          unit: { unitType: 'Chapter', number: 1 },
        },
      },
      {
        ...EVENT,
        source: {
          title: 'Shatterpoint',
          medium: 'Book',
          sourceId: 'material-shatterpoint',
          unit: { unitType: 'Chapter', number: 3 },
        },
      },
    ]);
    expect(options.sources).toEqual([
      { value: 'material-shatterpoint:chapter-1', label: 'Shatterpoint — Chapter 1' },
      { value: 'material-shatterpoint:chapter-3', label: 'Shatterpoint — Chapter 3' },
    ]);
  });
});
