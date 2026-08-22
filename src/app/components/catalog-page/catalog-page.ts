import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';
import { CharacterAdmin } from '../character-admin/character-admin';
import { NameCatalogAdmin } from '../name-catalog-admin/name-catalog-admin';
import { SourceMaterialAdmin } from '../source-material-admin/source-material-admin';
import { SpeciesAdmin } from '../species-admin/species-admin';

export type CatalogTab = 'characters' | 'vehicles' | 'locations' | 'species' | 'sources';

@Component({
  selector: 'app-catalog-page',
  imports: [CharacterAdmin, NameCatalogAdmin, SourceMaterialAdmin, SpeciesAdmin],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage {
  private readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'Admin');

  readonly activeTab = signal<CatalogTab>('sources');

  readonly tabs: readonly { key: CatalogTab; label: string }[] = [
    { key: 'sources', label: 'Source materials' },
    { key: 'characters', label: 'Characters' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'locations', label: 'Locations' },
    { key: 'species', label: 'Species' },
  ];

  selectTab(tab: CatalogTab): void {
    this.activeTab.set(tab);
  }
}
