import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';
import { NameCatalogAdmin } from '../name-catalog-admin/name-catalog-admin';
import { SourceMaterialAdmin } from '../source-material-admin/source-material-admin';

export type CatalogTab = 'characters' | 'vehicles' | 'locations' | 'sources';

@Component({
  selector: 'app-catalog-page',
  imports: [NameCatalogAdmin, SourceMaterialAdmin],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage {
  private readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'Admin');

  readonly activeTab = signal<CatalogTab>('characters');

  readonly tabs: readonly { key: CatalogTab; label: string }[] = [
    { key: 'characters', label: 'Characters' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'locations', label: 'Locations' },
    { key: 'sources', label: 'Source materials' },
  ];

  selectTab(tab: CatalogTab): void {
    this.activeTab.set(tab);
  }
}
