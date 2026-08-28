import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ApiNamedLink, ApiRegion, ApiSubregion } from '../../../../shared/models/api-galaxy';
import {
  PlanetLocationType,
  PLANET_LOCATION_TYPES,
} from '../../../../shared/models/planet-location-type';
import { FilterGroup } from '../../../../shared/components/filter-group/filter-group';
import { FilterTreeNode } from '../../../../shared/models/filter-tree';
import { GalaxyKind } from '../../models/galaxy-catalog-models';

/** A selected galaxy link rendered as a removable chip. */
export interface GalaxyLinkChip {
  /** Encoded selection value (`"{id}"`). */
  readonly value: string;
  /** Display name resolved from the option list. */
  readonly name: string;
}

/**
 * Modal dialog for adding or editing one galaxy hierarchy row (region,
 * subregion, planet system, planet, or planet location).
 *
 * Two-way binds the editable fields to the host's signals and emits `save` /
 * `cancel` intents. The many-to-many link selection (regions on a subregion,
 * subregions on a planet system) uses the same searchable multi-select as the
 * Timeline Events dialog, with removable chips so a selection can be dropped
 * without reopening the dropdown. Clicking the backdrop while a dropdown panel
 * is open only closes the panel.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-galaxy-item-dialog',
  imports: [FormsModule, FilterGroup, CdkTrapFocus],
  templateUrl: './galaxy-item-dialog.html',
  styleUrl: './galaxy-item-dialog.scss',
})
export class GalaxyItemDialog {
  /** The hierarchy level the dialog is editing or adding. */
  readonly kind = input.required<GalaxyKind>();

  /** Whether this dialog creates a new row (`true`) or replaces an existing one. */
  readonly adding = input(false);

  /** Noun label for the kind (e.g. "planet system"). */
  readonly kindLabel = input.required<string>();

  /** Context sentence naming pre-selected link parents on a new row. */
  readonly context = input('');

  /** Region options shown in the link multi-select when editing a subregion. */
  readonly regionOptions = input<readonly ApiRegion[]>([]);

  /** Subregion options shown in the link multi-select when editing a planet system. */
  readonly subregionOptions = input<readonly ApiSubregion[]>([]);

  /** Selectable planet location type labels (planet-location kind only). */
  readonly planetLocationTypes = input<readonly PlanetLocationType[]>(PLANET_LOCATION_TYPES);

  /** Whether the save request is in flight. */
  readonly busy = input(false);

  /** Validation or server error to show inside the dialog. */
  readonly error = input<string | null>(null);

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

  /** Emits when the user submits the dialog. */
  readonly save = output<void>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

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

  /** Dialog heading combining add/edit with the kind noun. */
  readonly heading = computed(() => `${this.adding() ? 'Add' : 'Edit'} ${this.kindLabel()}`);

  /** Submitter button label: in-flight, new rows, then replacements. */
  readonly submitLabel = computed(() => (this.busy() ? 'Saving…' : this.adding() ? 'Add' : 'Save'));

  /** Helper sentence explaining what add vs save means for the current kind. */
  readonly hint = computed(
    () =>
      `${this.adding() ? 'Adding a new ' + this.kindLabel() + '.' : 'Saving replaces all fields.'} A blank optional field stores “no value”.${this.context()}`,
  );

  /** The single multi-select link field (regions on subregions, subregions on systems). */
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

  /** The selected ids for whichever link field {@link linkField} renders. */
  readonly linkIds = computed<readonly number[]>(() =>
    this.kind() === 'subregion' ? this.regionIds() : this.subregionIds(),
  );

  /** The link selection encoded as strings for the filter-group model. */
  protected readonly linkValues = computed<readonly string[]>(() =>
    this.linkIds().map((id) => String(id)),
  );

  /** Flat filter-tree leaves derived from the current link options. */
  protected readonly linkNodes = computed<readonly FilterTreeNode[]>(() => {
    const field = this.linkField();
    if (!field) {
      return [];
    }
    return field.options.map((option) => ({ value: String(option.id), label: option.name }));
  });

  /** Selected links resolved to removable chips with display names. */
  protected readonly linkChips = computed<readonly GalaxyLinkChip[]>(() => {
    const field = this.linkField();
    if (!field) {
      return [];
    }
    const byId = new Map(field.options.map((option) => [option.id, option.name]));
    return this.linkIds().map((id) => ({ value: String(id), name: byId.get(id) ?? `#${id}` }));
  });

  /**
   * Writes a changed filter-group selection back to the numeric link model
   * for the active kind.
   *
   * @param values  The encoded selection emitted by the filter group.
   */
  protected onLinkChange(values: readonly string[]): void {
    const ids = values.map((value) => Number(value));
    if (this.kind() === 'subregion') {
      this.regionIds.set(ids);
    } else {
      this.subregionIds.set(ids);
    }
  }

  /** Removes one link id from the selection without reopening the dropdown. */
  protected removeLink(value: string): void {
    const id = Number(value);
    if (this.kind() === 'subregion') {
      this.regionIds.update((current) => current.filter((entry) => entry !== id));
    } else {
      this.subregionIds.update((current) => current.filter((entry) => entry !== id));
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancel.emit();
  }

  /**
   * Backdrop click handler: dismisses the dialog only when no dropdown
   * panel is open. With a panel open the click is swallowed here first
   * (element listeners run before FilterGroup's document listener), so the
   * stray click just closes the panel instead of the whole dialog.
   */
  protected onBackdropClick(): void {
    const openPanel = this.elementRef.nativeElement.querySelector(
      '.filter-group-panel:not([hidden])',
    );
    if (openPanel) {
      return;
    }
    this.cancel.emit();
  }
}
