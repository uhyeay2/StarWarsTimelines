/**
 * @fileoverview Sticky site header with the brand, primary navigation, and
 * account controls.
 *
 * The Timeline and Catalog entries are hover dropdowns whose top-level links
 * deep-link to the visitor's last viewed filter (Canon view / catalog tab),
 * falling back to sensible defaults when nothing has been viewed yet.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CANON_VIEWS } from '../../models/canon';
import { ROUTES } from '../../constants/routes.constants';
import { AuthService } from '../../../features/auth/services/auth.service';
import {
  CATALOG_TABS,
  NavPreferencesService,
} from '../../services/nav-preferences/nav-preferences.service';
import { NavDropdown, NavDropdownOption } from '../nav-dropdown/nav-dropdown';

/** Human-readable labels for the catalog tab keys. */
const CATALOG_TAB_LABELS: Record<(typeof CATALOG_TABS)[number], string> = {
  sources: 'Source Materials',
  events: 'Timeline Events',
  characters: 'Characters',
  vehicles: 'Vehicles',
  locations: 'Locations',
  species: 'Species',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, NavDropdown],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
})
export class SiteHeader {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly user = this.auth.currentUser;

  /** Last-viewed filters powering the Timeline/Catalog deep links. */
  protected readonly navPrefs = inject(NavPreferencesService);

  /** Canon view options for the Timeline dropdown. */
  protected readonly timelineOptions: readonly NavDropdownOption[] = CANON_VIEWS.map((view) => ({
    label: view,
    routerLink: ROUTES.TIMELINE,
    queryParams: { view },
  }));

  /** Catalog tab options for the Catalog dropdown. */
  protected readonly catalogOptions: readonly NavDropdownOption[] = CATALOG_TABS.map((tab) => ({
    label: CATALOG_TAB_LABELS[tab],
    routerLink: ROUTES.CATALOG,
    queryParams: { tab },
  }));

  /** Library section options for the Library dropdown. */
  protected readonly libraryOptions: readonly NavDropdownOption[] = [
    { label: 'My Tracked Events', routerLink: ROUTES.LIBRARY_TRACKED },
    { label: 'My Wish List', routerLink: ROUTES.LIBRARY_WISH_LIST },
    { label: 'Known Timeline', routerLink: ROUTES.LIBRARY_TIMELINE },
  ];

  logout(): void {
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.router.navigateByUrl(ROUTES.HOME));
  }
}
