import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../auth/services/auth.service';
import {
  CATALOG_TABS,
  CatalogTab,
  NavPreferencesService,
} from '../../../../shared/services/nav-preferences/nav-preferences.service';
import { CharacterCatalog } from '../../components/character-catalog/character-catalog';
import { NameCatalog } from '../../components/name-catalog/name-catalog';
import { SourceMaterialCatalog } from '../../components/source-material-catalog/source-material-catalog';
import { SpeciesCatalog } from '../../components/species-catalog/species-catalog';
import { TimelineEventCatalog } from '../../../timeline/components/timeline-event-catalog/timeline-event-catalog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-catalog-page',
  imports: [CharacterCatalog, NameCatalog, SourceMaterialCatalog, SpeciesCatalog, TimelineEventCatalog],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navPrefs = inject(NavPreferencesService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'Admin');

  /** Active tab; starts at the last viewed tab (Source Materials if none). */
  readonly activeTab = signal<CatalogTab>(this.navPrefs.catalogTab());

  readonly tabs: readonly { key: CatalogTab; label: string }[] = [
    { key: 'sources', label: 'Source materials' },
    { key: 'events', label: 'Timeline events' },
    { key: 'characters', label: 'Characters' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'locations', label: 'Locations' },
    { key: 'species', label: 'Species' },
  ];

  constructor() {
    // Apply the `tab` query param (deep links) and remember it so the navbar
    // can restore this tab later.
    this.applyTabParam(this.route.snapshot.queryParamMap);

    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.applyTabParam(params));
  }

  /**
   * Applies a valid `tab` query param, falling back to the current selection
   * (last viewed tab) when absent or invalid.
   *
   * @param params  The current route query parameters.
   */
  private applyTabParam(params: ParamMap): void {
    const tab = params.get('tab');
    if (tab !== null && (CATALOG_TABS as readonly string[]).includes(tab)) {
      this.activeTab.set(tab as CatalogTab);
      this.navPrefs.setCatalogTab(tab);
    }
  }

  /**
   * Selects a catalog tab, remembers it for the navbar, and mirrors it into
   * the URL query string.
   *
   * @param tab  The catalog tab key to activate.
   */
  selectTab(tab: CatalogTab): void {
    this.activeTab.set(tab);
    this.navPrefs.setCatalogTab(tab);
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      })
      .catch(() => {
        // Deep-linking is best-effort; the tab is already active.
      });
  }
}
