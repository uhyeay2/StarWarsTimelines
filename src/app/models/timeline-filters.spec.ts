import { TimelineEvent } from './timeline-event';
import {
  collectFacetOptions,
  createEmptyFilters,
  matchesFacetFilters,
  matchesFilters,
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

describe('collectFacetOptions', () => {
  it('collects unique values across events, in display order', () => {
    const options = collectFacetOptions([EVENT, OTHER_EVENT]);
    expect(options.mediums).toEqual(['Movie', 'Animated Show']);
    expect(options.sources).toEqual(['A New Hope', 'The Clone Wars']);
    expect(options.locations).toEqual(['Coruscant', 'Mandalore', 'Naboo']);
    expect(options.characters).toEqual(['Ahsoka Tano', 'Darth Maul', 'Padme Amidala']);
    expect(options.vehicles).toEqual(['Sith Infiltrator']);
  });
});
