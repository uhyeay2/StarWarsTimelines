/**
 * @fileoverview Write-side payload for creating or updating a source material.
 */

import { CanonType } from '../canon-type';
import { Medium } from '../medium';

/**
 * The body sent to `POST /api/source-materials` or
 * `PUT /api/source-materials/:id`.
 *
 * @property title     The display title of the source material.
 * @property medium    The medium category (e.g. Movie, Book).
 * @property canonType The canon classification (Canon, Legends, etc.).
 */
export interface CreateSourceMaterialInput {
  title: string;
  medium: Medium;
  canonType: CanonType;
}
