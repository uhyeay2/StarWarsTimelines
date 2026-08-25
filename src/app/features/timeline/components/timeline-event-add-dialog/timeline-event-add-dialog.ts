import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  ModelSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EventSourceLinkInput } from '../../models/create-timeline-event-input';
import {
  buildSourceOptions,
  describeSourceLinkUnit,
  removeSourceLink,
  resolveSourceLinks,
  SourceOptionContext,
} from '../../models/event-source-options';
import { FilterGroup } from '../../../../shared/components/filter-group/filter-group';

/** A resolved source link rendered as a removable summary chip. */
export interface SourceLinkChip {
  /** The API link payload behind the chip, used when removing it. */
  link: EventSourceLinkInput;
  /** Material title. */
  material: string;
  /** Pinned unit label, or `null` for whole-material coverage. */
  unit: string | null;
}

/** A selected linked entity rendered as a removable chip. */
export interface EntityChip {
  /** Encoded selection value (`"{id}"`). */
  value: string;
  /** Display name resolved from the option list. */
  name: string;
}

/**
 * Modal dialog for creating or editing a timeline event (admin catalog
 * view). Collects the title, description, galactic-year span, sequence,
 * and linked entities — source materials via the same nested tree dropdown
 * as the Timeline page's advanced filter, plus searchable multi-selects for
 * characters, locations, and vehicles.
 *
 * Resolved associations render as removable chips: dismissing one strips the
 * checked leaves behind it (for sources) or the id itself (for entities).
 * Clicking the backdrop while a dropdown panel is open only closes the panel.
 *
 * Two-way binds the form fields to the host's signals and emits `save` /
 * `cancel` intents. Purely presentational: the host owns persistence and
 * validation.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-timeline-event-add-dialog',
  imports: [FormsModule, FilterGroup],
  templateUrl: './timeline-event-add-dialog.html',
  styleUrl: './timeline-event-add-dialog.scss',
})
export class TimelineEventAddDialog {
  /** Catalog data backing the nested source-material dropdown. */
  readonly sourceContext = input.required<SourceOptionContext>();

  /** Character options sorted by name. */
  readonly characterOptions = input<readonly { id: number; name: string }[]>([]);

  /** Location options sorted by name. */
  readonly locationOptions = input<readonly { id: number; name: string }[]>([]);

  /** Vehicle options sorted by name. */
  readonly vehicleOptions = input<readonly { id: number; name: string }[]>([]);

  /** Dialog heading ("Add event" / "Edit event"). */
  readonly heading = input('Add event');

  /** Submit button label ("Add" / "Save"). */
  readonly submitLabel = input('Add');

  // ─── Two-way bound form fields ─────────────────────────────────────────

  readonly title = model('');
  readonly description = model('');
  readonly yearStart = model<number | null>(null);
  readonly yearEnd = model<number | null>(null);
  readonly sequence = model<number | null>(null);

  /** Checked leaf values of the source-material option tree. */
  readonly sourceSelection = model<readonly string[]>([]);

  /** Selected entity ids, encoded as strings for the filter-group trees. */
  readonly characterSelection = model<readonly string[]>([]);
  readonly locationSelection = model<readonly string[]>([]);
  readonly vehicleSelection = model<readonly string[]>([]);

  /** Whether the create/update request is in flight. */
  readonly saving = input(false);

  /** Validation or server error to show inside the dialog. */
  readonly error = input<string | null>(null);

  /** Emits when the user submits the form. */
  readonly save = output<void>();

  /** Emits when the user dismisses the dialog. */
  readonly cancel = output<void>();

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  // ─── Derived state ─────────────────────────────────────────────────────

  /** Nested option tree for source materials (medium → material → scope). */
  protected readonly sourceOptions = computed(() => buildSourceOptions(this.sourceContext()));

  /** Flat id/name options for each linked-entity dropdown. */
  protected readonly locationNodes = computed(() =>
    this.locationOptions().map((o) => ({ value: String(o.id), label: o.name })),
  );
  protected readonly characterNodes = computed(() =>
    this.characterOptions().map((o) => ({ value: String(o.id), label: o.name })),
  );
  protected readonly vehicleNodes = computed(() =>
    this.vehicleOptions().map((o) => ({ value: String(o.id), label: o.name })),
  );

  /**
   * Resolved associations for the summary chips — one per checked scope,
   * so two pinned episodes of the same series appear as two chips.
   */
  protected readonly resolvedLinks = computed(() => {
    const ctx = this.sourceContext();
    return resolveSourceLinks(ctx, this.sourceSelection()).map((link) => ({
      link,
      material:
        ctx.materials.find((m) => m.id === link.sourceMaterialId)?.title ??
        `#${link.sourceMaterialId}`,
      unit: describeSourceLinkUnit(ctx, link),
    }));
  });

  /** Selected entities as chips with display names. */
  protected readonly characterChips = computed(() =>
    this.entityChips(this.characterOptions(), this.characterSelection()),
  );
  protected readonly locationChips = computed(() =>
    this.entityChips(this.locationOptions(), this.locationSelection()),
  );
  protected readonly vehicleChips = computed(() =>
    this.entityChips(this.vehicleOptions(), this.vehicleSelection()),
  );

  /** True once at least one source-material association resolves. */
  protected readonly hasLinks = computed(() => this.resolvedLinks().length > 0);

  // ─── Chip removal ──────────────────────────────────────────────────────

  /**
   * Drops the checked leaves that produced one resolved source-link chip —
   * a whole-material chip unchecks the material, a collapsed season chip
   * unchecks every episode beneath it.
   */
  protected removeLink(chip: SourceLinkChip): void {
    this.sourceSelection.set(
      removeSourceLink(this.sourceContext(), this.sourceSelection(), chip.link),
    );
  }

  /** Removes one character id from the selection. */
  protected removeCharacter(value: string): void {
    this.removeValue(this.characterSelection, value);
  }

  /** Removes one location id from the selection. */
  protected removeLocation(value: string): void {
    this.removeValue(this.locationSelection, value);
  }

  /** Removes one vehicle id from the selection. */
  protected removeVehicle(value: string): void {
    this.removeValue(this.vehicleSelection, value);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.cancel.emit();
  }

  // ─── Backdrop ──────────────────────────────────────────────────────────

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

  // ─── Internal ──────────────────────────────────────────────────────────

  private entityChips(
    options: readonly { id: number; name: string }[],
    selected: readonly string[],
  ): readonly EntityChip[] {
    return selected.map((value) => ({
      value,
      name: options.find((o) => String(o.id) === value)?.name ?? `#${value}`,
    }));
  }

  private removeValue(selection: ModelSignal<readonly string[]>, value: string): void {
    selection.update((values) => values.filter((current) => current !== value));
  }
}
