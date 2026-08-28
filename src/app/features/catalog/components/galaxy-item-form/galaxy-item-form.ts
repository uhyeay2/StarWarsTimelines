import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiNamedLink, ApiRegion, ApiSubregion } from '../../../../shared/models/api-galaxy';
import {
  PlanetLocationType,
  PLANET_LOCATION_TYPES,
} from '../../../../shared/models/planet-location-type';
import { GalaxyKind } from '../../../../features/catalog/models/galaxy-catalog-models';

/**
 * Inline add/edit form for one galaxy hierarchy row (region, subregion,
 * planet system, planet, or planet location).
 *
 * Two-way binds the editable fields to the host's signals via model inputs,
 * renders only the fields that apply to its {@link GalaxyKind}, and emits
 * `save` / `cancel` intents. The kind's link lists are toggled locally;
 * persistence and busy state stay in the host.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-item-form',
  imports: [FormsModule],
  templateUrl: './galaxy-item-form.html',
  styleUrl: './galaxy-item-form.scss',
})
export class GalaxyItemForm {
  /** The hierarchy level the form is editing or adding. */
  readonly kind = input.required<GalaxyKind>();

  /** Whether this form creates a new row (`true`) or replaces an existing one. */
  readonly adding = input(false);

  /** Noun label for the kind (e.g. "planet system"). */
  readonly kindLabel = input.required<string>();

  /** Context sentence naming pre-selected link parents on a new row. */
  readonly context = input('');

  /** Region options shown as checkboxes when editing a subregion. */
  readonly regionOptions = input<readonly ApiRegion[]>([]);

  /** Subregion options shown as checkboxes when editing a planet system. */
  readonly subregionOptions = input<readonly ApiSubregion[]>([]);

  /** Selectable planet location type labels (planet-location kind only). */
  readonly planetLocationTypes = input<readonly PlanetLocationType[]>(PLANET_LOCATION_TYPES);

  /** Whether the save request is in flight. */
  readonly busy = input(false);

  /** Row name. */
  readonly name = model('');

  /** Row description (region, system, planet, location kinds). */
  readonly description = model('');

  /** Subregion sector-type label. */
  readonly sectorType = model('');

  /** System / location coordinates. */
  readonly coordinates = model('');

  /** Location type (planet-location kind only). */
  readonly type = model<PlanetLocationType>('City');

  /** Region ids selected for a subregion's many-to-many links. */
  readonly regionIds = model<readonly number[]>([]);

  /** Subregion ids selected for a system's many-to-many links. */
  readonly subregionIds = model<readonly number[]>([]);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user cancels editing. */
  readonly cancel = output<void>();

  /** Whether the subregion kind's sector-type field applies. */
  readonly showsSectorType = computed(() => this.kind() === 'subregion');

  /** Whether the coordinates field applies (systems and locations). */
  readonly showsCoordinates = computed(
    () => this.kind() === 'planet-system' || this.kind() === 'planet-location',
  );

  /** Whether the location-kind type picker applies. */
  readonly showsTypePicker = computed(() => this.kind() === 'planet-location');

  /** Whether the description field applies (all kinds but subregion). */
  readonly showsDescription = computed(() => this.kind() !== 'subregion');

  /** The single link checkbox list (regions on subregions, subregions on systems). */
  readonly linkField = computed<{ label: string; options: readonly ApiNamedLink[] } | null>(() => {
    const kind = this.kind();
    if (kind === 'subregion') {
      return { label: 'Regions', options: this.regionOptions() };
    }
    if (kind === 'planet-system') {
      return { label: 'Subregions', options: this.subregionOptions() };
    }
    return null;
  });

  /** The selected ids for whichever link list {@link linkField} renders. */
  readonly linkIds = computed<readonly number[]>(() =>
    this.kind() === 'subregion' ? this.regionIds() : this.subregionIds(),
  );

  /** Submit button label: in-flight, new rows, then replacements. */
  readonly submitLabel = computed(() => (this.busy() ? 'Saving…' : this.adding() ? 'Add' : 'Save'));

  /** Helper sentence explaining what add vs save means for the current kind. */
  readonly hint = computed(
    () =>
      `${this.adding() ? 'Adding a new ' + this.kindLabel() + '.' : 'Saving replaces all fields.'} A blank optional field stores “no value”.${this.context()}`,
  );

  /** Toggles one id in the active link selection. */
  toggleLink(linkId: number): void {
    if (this.kind() === 'subregion') {
      this.toggleRegion(linkId);
    } else {
      this.toggleSubregion(linkId);
    }
  }

  /** Toggles one region id in the subregion link selection. */
  toggleRegion(regionId: number): void {
    this.regionIds.update((current) =>
      current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId],
    );
  }

  /** Toggles one subregion id in the system link selection. */
  toggleSubregion(subregionId: number): void {
    this.subregionIds.update((current) =>
      current.includes(subregionId)
        ? current.filter((id) => id !== subregionId)
        : [...current, subregionId],
    );
  }
}
