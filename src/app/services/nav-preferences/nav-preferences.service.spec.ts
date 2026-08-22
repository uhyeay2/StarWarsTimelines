import { TestBed } from '@angular/core/testing';
import { NavPreferencesService } from './nav-preferences.service';

describe('NavPreferencesService', () => {
  let service: NavPreferencesService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NavPreferencesService);
  });

  it('defaults the timeline view to Canon and the catalog tab to sources', () => {
    expect(service.timelineView()).toBe('Canon');
    expect(service.catalogTab()).toBe('sources');
  });

  it('remembers the last timeline view and catalog tab', () => {
    service.setTimelineView('Legends');
    service.setCatalogTab('vehicles');

    expect(service.timelineView()).toBe('Legends');
    expect(service.catalogTab()).toBe('vehicles');
  });

  it('restores persisted values in a fresh instance', () => {
    service.setTimelineView('Canon & Legends');
    service.setCatalogTab('species');

    const revived = TestBed.runInInjectionContext(() => new NavPreferencesService());
    expect(revived.timelineView()).toBe('Canon & Legends');
    expect(revived.catalogTab()).toBe('species');
  });

  it('ignores invalid values and keeps defaults', () => {
    service.setTimelineView('Pseudo-Canon');
    service.setCatalogTab('droids' as string);

    expect(service.timelineView()).toBe('Canon');
    expect(service.catalogTab()).toBe('sources');
    expect(sessionStorage.getItem('starwars-timelines.nav.timeline-view')).toBeNull();
    expect(sessionStorage.getItem('starwars-timelines.nav.catalog-tab')).toBeNull();
  });
});
