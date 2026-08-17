import { Component, signal } from '@angular/core';
import { NameCatalogAdmin } from '../name-catalog-admin/name-catalog-admin';
import { SourceMaterialAdmin } from '../source-material-admin/source-material-admin';

export type AdminTab = 'characters' | 'vehicles' | 'locations' | 'sources';

@Component({
  selector: 'app-admin-page',
  imports: [NameCatalogAdmin, SourceMaterialAdmin],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss',
})
export class AdminPage {
  readonly activeTab = signal<AdminTab>('characters');

  readonly tabs: readonly { key: AdminTab; label: string }[] = [
    { key: 'characters', label: 'Characters' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'locations', label: 'Locations' },
    { key: 'sources', label: 'Source materials' },
  ];

  selectTab(tab: AdminTab): void {
    this.activeTab.set(tab);
  }
}
