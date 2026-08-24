import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../services/catalog/catalog.service';
import { ApiCharacter } from '../../models/api-character';
import { CreateCharacterInput } from '../../models/catalog/create-character-input';
import { formatGalacticYearRange } from '../../utils/galactic-year';
import { runOperation } from '../../utils/async-operation';
import { filterByName } from '../../utils/text-search';
import { CharacterAddDialog } from '../character-add-dialog/character-add-dialog';

/** Sentinel select value representing "nothing selected"; catalog ids start at 1. */
const NONE = 0;

@Component({
  selector: 'app-character-catalog',
  imports: [FormsModule, CharacterAddDialog],
  templateUrl: './character-catalog.html',
  styleUrl: './character-catalog.scss',
})
export class CharacterCatalog implements OnInit {
  readonly isAdmin = input<boolean>(false);

  private readonly catalogService = inject(CatalogService);

  readonly searchTerm = signal('');

  readonly items = computed(() => this.catalogService.characters() ?? []);
  readonly loading = computed(() => this.catalogService.charactersLoading());
  readonly loadError = computed(() => this.catalogService.charactersError());
  readonly locations = computed(() => this.catalogService.locations() ?? []);
  readonly speciesList = computed(() => this.catalogService.species() ?? []);

  /** Lookup options sorted by name so the dropdowns are easy to scan. */
  readonly sortedLocations = computed(() =>
    [...this.locations()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly sortedSpecies = computed(() =>
    [...this.speciesList()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly filteredItems = computed(() => filterByName(this.items(), this.searchTerm()));

  /** "Unknown" select sentinel, exposed for `[ngValue]` template bindings. */
  protected readonly noSelection = NONE;

  readonly newName = signal('');
  readonly newPlanetBornOnId = signal(NONE);
  readonly newSpeciesId = signal(NONE);
  readonly newBirthFrom = signal<number | null>(null);
  readonly newBirthTo = signal<number | null>(null);
  readonly newDeathFrom = signal<number | null>(null);
  readonly newDeathTo = signal<number | null>(null);
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);

  /** Whether the add dialog is open. */
  readonly addOpen = signal(false);

  readonly editId = signal<number | null>(null);
  readonly editName = signal('');
  readonly editPlanetBornOnId = signal(NONE);
  readonly editSpeciesId = signal(NONE);
  readonly editBirthFrom = signal<number | null>(null);
  readonly editBirthTo = signal<number | null>(null);
  readonly editDeathFrom = signal<number | null>(null);
  readonly editDeathTo = signal<number | null>(null);
  readonly savingId = signal<number | null>(null);

  readonly confirmDeleteId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  ngOnInit(): void {
    this.catalogService.fetchCharacters();
    this.catalogService.fetchLocations();
    this.catalogService.fetchSpecies();
  }

  /**
   * Builds the biography line shown under a character's name, e.g.
   * `"Human · Born Tatooine, 41 BBY · Died 4 ABY"`.
   */
  detailLine(item: ApiCharacter): string | null {
    const parts: string[] = [];

    if (item.speciesName) {
      parts.push(item.speciesName);
    }

    const bornYears = formatGalacticYearRange(item.yearOfBirthEarliest, item.yearOfBirthLatest);
    if (item.planetBornOnName && bornYears) {
      parts.push(`Born ${item.planetBornOnName}, ${bornYears}`);
    } else if (item.planetBornOnName) {
      parts.push(`Born ${item.planetBornOnName}`);
    } else if (bornYears) {
      parts.push(`Born ${bornYears}`);
    }

    const diedYears = formatGalacticYearRange(item.yearOfDeathEarliest, item.yearOfDeathLatest);
    if (diedYears) {
      parts.push(`Died ${diedYears}`);
    }

    return parts.length > 0 ? parts.join(' \u00b7 ') : null;
  }

  /** Opens the add dialog with a blank form. */
  openAdd(): void {
    this.addError.set(null);
    this.resetAddForm();
    this.addOpen.set(true);
  }

  cancelAdd(): void {
    this.addOpen.set(false);
  }

  submitAdd(): void {
    if (this.adding()) {
      return;
    }
    const name = this.newName().trim();
    if (!name) {
      this.addError.set('A name is required.');
      return;
    }

    const input: CreateCharacterInput = {
      name,
      planetBornOnId: this.newPlanetBornOnId() || null,
      speciesId: this.newSpeciesId() || null,
      yearOfBirthEarliest: this.newBirthFrom(),
      yearOfBirthLatest: this.newBirthTo(),
      yearOfDeathEarliest: this.newDeathFrom(),
      yearOfDeathLatest: this.newDeathTo(),
    };
    const validationError = validateBiography(input);
    if (validationError) {
      this.addError.set(validationError);
      return;
    }

    this.addError.set(null);
    runOperation({
      busy: this.adding,
      busyValue: true,
      idleValue: false,
      error: this.addError,
      operation: this.catalogService.createCharacter(input),
      onSuccess: (item) => {
        if (item) {
          this.resetAddForm();
          this.addOpen.set(false);
        }
      },
    });
  }

  beginEdit(item: ApiCharacter): void {
    this.actionError.set(null);
    this.editId.set(item.id);
    this.editName.set(item.name);
    this.editPlanetBornOnId.set(item.planetBornOnId ?? NONE);
    this.editSpeciesId.set(item.speciesId ?? NONE);
    this.editBirthFrom.set(item.yearOfBirthEarliest ?? null);
    this.editBirthTo.set(item.yearOfBirthLatest ?? null);
    this.editDeathFrom.set(item.yearOfDeathEarliest ?? null);
    this.editDeathTo.set(item.yearOfDeathLatest ?? null);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editName.set('');
    this.editPlanetBornOnId.set(NONE);
    this.editSpeciesId.set(NONE);
    this.editBirthFrom.set(null);
    this.editBirthTo.set(null);
    this.editDeathFrom.set(null);
    this.editDeathTo.set(null);
  }

  saveEdit(): void {
    const id = this.editId();
    if (!id || this.savingId()) {
      return;
    }
    const name = this.editName().trim();
    if (!name) {
      this.actionError.set('A name is required.');
      return;
    }

    const input: CreateCharacterInput = {
      name,
      planetBornOnId: this.editPlanetBornOnId() || null,
      speciesId: this.editSpeciesId() || null,
      yearOfBirthEarliest: this.editBirthFrom(),
      yearOfBirthLatest: this.editBirthTo(),
      yearOfDeathEarliest: this.editDeathFrom(),
      yearOfDeathLatest: this.editDeathTo(),
    };
    const validationError = validateBiography(input);
    if (validationError) {
      this.actionError.set(validationError);
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.savingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.catalogService.updateCharacter(id, input),
      onSuccess: (updated) => {
        if (updated) {
          this.cancelEdit();
        }
      },
    });
  }

  requestDelete(item: ApiCharacter): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(item.id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id || this.deletingId()) {
      return;
    }

    this.actionError.set(null);
    runOperation({
      busy: this.deletingId,
      busyValue: id,
      idleValue: null,
      error: this.actionError,
      operation: this.catalogService.deleteCharacter(id),
      onSuccess: () => this.confirmDeleteId.set(null),
    });
  }

  private resetAddForm(): void {
    this.newName.set('');
    this.newPlanetBornOnId.set(NONE);
    this.newSpeciesId.set(NONE);
    this.newBirthFrom.set(null);
    this.newBirthTo.set(null);
    this.newDeathFrom.set(null);
    this.newDeathTo.set(null);
  }
}

/**
 * Validates the biography year pairs client-side, mirroring the server rules:
 * each pair must be provided together and the earliest bound must not come
 * after the latest bound.
 *
 * @returns An error message, or `null` when the payload is valid.
 */
function validateBiography(input: CreateCharacterInput): string | null {
  const hasBirthFrom = input.yearOfBirthEarliest != null;
  const hasBirthTo = input.yearOfBirthLatest != null;
  if (hasBirthFrom !== hasBirthTo) {
    return 'Birth years require both earliest and latest values.';
  }
  if (hasBirthFrom && input.yearOfBirthEarliest! > input.yearOfBirthLatest!) {
    return 'The earliest birth year cannot come after the latest.';
  }

  const hasDeathFrom = input.yearOfDeathEarliest != null;
  const hasDeathTo = input.yearOfDeathLatest != null;
  if (hasDeathFrom !== hasDeathTo) {
    return 'Death years require both earliest and latest values.';
  }
  if (hasDeathFrom && input.yearOfDeathEarliest! > input.yearOfDeathLatest!) {
    return 'The earliest death year cannot come after the latest.';
  }

  return null;
}
