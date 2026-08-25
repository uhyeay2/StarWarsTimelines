/**
 * @fileoverview Persists "last viewed" navigation filters for the navbar.
 *
 * Stores the most recently selected timeline canon view and catalog tab so
 * the navbar's top-level links can deep-link back to them (falling back to
 * sensible defaults: `Canon` and `Source Materials`).
 *
 * Values are kept in {@link StorageService} (sessionStorage) and mirrored in
 * readonly signals so nav links stay reactive across route changes.
 */

import { Injectable, inject, signal } from '@angular/core';
import { CANON_VIEWS, CanonView } from '../../models/canon';
import { StorageService } from '../storage.service';

/** Available catalog tab keys, shared by the catalog page and the navbar. */
export const CATALOG_TABS = [
  'sources',
  'events',
  'characters',
  'vehicles',
  'locations',
  'species',
] as const;

/** A single catalog tab key. */
export type CatalogTab = (typeof CATALOG_TABS)[number];

/** Session storage keys for last-viewed filters. */
const NAV_PREF_KEYS = {
  timelineView: 'starwars-timelines.nav.timeline-view',
  catalogTab: 'starwars-timelines.nav.catalog-tab',
} as const;

/** Default timeline canon view used when nothing has been viewed yet. */
export const DEFAULT_TIMELINE_VIEW: CanonView = 'Canon';

/** Default catalog tab used when nothing has been viewed yet. */
export const DEFAULT_CATALOG_TAB: CatalogTab = 'sources';

/**
 * Tracks the last-viewed timeline canon view and catalog tab.
 *
 * The navbar reads these to point its top-level links at the visitor's most
 * recent filter, while the Timeline and Catalog pages call the setters when a
 * new filter is chosen.
 */
@Injectable({ providedIn: 'root' })
export class NavPreferencesService {
  private readonly storage = inject(StorageService);

  private readonly timelineViewState = signal<CanonView>(
    this.readStoredValue(NAV_PREF_KEYS.timelineView, CANON_VIEWS, DEFAULT_TIMELINE_VIEW),
  );

  private readonly catalogTabState = signal<CatalogTab>(
    this.readStoredValue(NAV_PREF_KEYS.catalogTab, CATALOG_TABS, DEFAULT_CATALOG_TAB),
  );

  /** Last viewed timeline canon view (defaults to `'Canon'`). */
  readonly timelineView = this.timelineViewState.asReadonly();

  /** Last viewed catalog tab (defaults to `'sources'` — Source Materials). */
  readonly catalogTab = this.catalogTabState.asReadonly();

  /**
   * Records the timeline canon view the visitor just selected.
   *
   * Invalid values are ignored.
   *
   * @param view  The canon view to remember.
   */
  setTimelineView(view: string): void {
    if ((CANON_VIEWS as readonly string[]).includes(view)) {
      this.storage.setItem(NAV_PREF_KEYS.timelineView, view);
      this.timelineViewState.set(view as CanonView);
    }
  }

  /**
   * Records the catalog tab the visitor just selected.
   *
   * Invalid values are ignored.
   *
   * @param tab  The catalog tab key to remember.
   */
  setCatalogTab(tab: string): void {
    if ((CATALOG_TABS as readonly string[]).includes(tab)) {
      this.storage.setItem(NAV_PREF_KEYS.catalogTab, tab);
      this.catalogTabState.set(tab as CatalogTab);
    }
  }

  /**
   * Reads a stored value from session storage, validating it against an
   * allow-list and falling back to a default.
   *
   * @param key      The storage key to read.
   * @param allowed  The valid values for this preference.
   * @param fallback The default when absent or invalid.
   * @returns The stored value if valid, otherwise the fallback.
   */
  private readStoredValue<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const stored = this.storage.getItem(key);
    return stored !== null && (allowed as readonly string[]).includes(stored)
      ? (stored as T)
      : fallback;
  }
}
