/**
 * @fileoverview Write-side payload for creating or updating a character.
 */

/**
 * The body sent to `POST /api/characters` or `PUT /api/characters/:id`.
 *
 * All biographical fields are optional because they are unknown for many
 * characters. Year values use the galactic-timeline convention: negative for
 * BBY, positive for ABY, exact year stored as earliest === latest. Each year
 * pair must be provided together (both-or-nothing) with earliest <= latest.
 *
 * On update the server treats a `null` field as "leave unchanged", so an
 * existing biography value cannot be cleared through this payload — it can
 * only be replaced.
 */
export interface CreateCharacterInput {
  /** The character's display name. */
  name: string;
  /** ID of the planet the character was born on, or `null` when unknown. */
  planetBornOnId?: number | null;
  /** Chronologically earliest birth year, or `null` when unknown. */
  yearOfBirthEarliest?: number | null;
  /** Chronologically latest birth year, or `null` when unknown. */
  yearOfBirthLatest?: number | null;
  /** Chronologically earliest death year, or `null` when unknown. */
  yearOfDeathEarliest?: number | null;
  /** Chronologically latest death year, or `null` when unknown. */
  yearOfDeathLatest?: number | null;
  /** ID of the character's species, or `null` when unknown. */
  speciesId?: number | null;
}
