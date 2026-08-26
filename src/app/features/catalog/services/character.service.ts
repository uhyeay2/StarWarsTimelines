import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { ApiCharacter } from '../../../shared/models/api-character';
import { CreateCharacterInput } from '../models/create-character-input';
import { catalogErrorHandler } from './catalog-error-handler';
import { CATALOG_API_BASE, CACHE_TTL_MS } from './catalog-constants';
import { CatalogErrorCode } from '../models/catalog-error';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { SignalCache } from '../../../shared/utils/signal-cache';
import { readProblemDetail } from '../../../shared/utils/problem-detail';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private readonly cache = new SignalCache<readonly ApiCharacter[]>(
    () => this.http.get<readonly ApiCharacter[]>(`${CATALOG_API_BASE}/characters`),
    (err) => {
      if (err instanceof HttpErrorResponse) {
        return readProblemDetail(err, 'Failed to load characters');
      }
      return 'Failed to load characters';
    },
    CACHE_TTL_MS,
  );

  readonly characters = this.cache.data.asReadonly();
  readonly charactersLoading = this.cache.loading.asReadonly();
  readonly charactersError = this.cache.error.asReadonly();

  /**
   * Fetches all characters from the catalog API.
   */
  fetchCharacters(): void {
    this.cache.fetch();
  }

  /**
   * Invalidates the character cache, forcing a refetch on next access.
   */
  invalidate(): void {
    this.cache.invalidate();
  }

  /**
   * Creates a new character in the catalog.
   * @param input - The character data to create.
   * @returns An observable of the created character.
   */
  createCharacter(input: CreateCharacterInput): Observable<ApiCharacter> {
    return this.http
      .post<ApiCharacter>(`${CATALOG_API_BASE}/characters`, {
        name: input.name,
        planetBornOnId: input.planetBornOnId ?? null,
        yearOfBirthEarliest: input.yearOfBirthEarliest ?? null,
        yearOfBirthLatest: input.yearOfBirthLatest ?? null,
        yearOfDeathEarliest: input.yearOfDeathEarliest ?? null,
        yearOfDeathLatest: input.yearOfDeathLatest ?? null,
        speciesId: input.speciesId ?? null,
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to create the character. Please try again.',
            'createCharacter',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        tap(() => this.cache.invalidate()),
      );
  }

  /**
   * Updates an existing character by ID.
   * @param id - The ID of the character to update.
   * @param input - The updated character data.
   * @returns An observable of the updated character.
   */
  updateCharacter(id: number, input: CreateCharacterInput): Observable<ApiCharacter> {
    return this.http
      .put<ApiCharacter>(`${CATALOG_API_BASE}/characters/${id}`, {
        name: input.name,
        planetBornOnId: input.planetBornOnId ?? null,
        yearOfBirthEarliest: input.yearOfBirthEarliest ?? null,
        yearOfBirthLatest: input.yearOfBirthLatest ?? null,
        yearOfDeathEarliest: input.yearOfDeathEarliest ?? null,
        yearOfDeathLatest: input.yearOfDeathLatest ?? null,
        speciesId: input.speciesId ?? null,
      })
      .pipe(
        catchError(
          catalogErrorHandler(
            'Unable to update the character. Please try again.',
            'updateCharacter',
            CatalogErrorCode.EntityInUse,
            this.logger,
          ),
        ),
        tap(() => this.cache.invalidate()),
      );
  }

  /**
   * Deletes a character by ID.
   * @param id - The ID of the character to delete.
   * @returns An observable that completes when the deletion is done.
   */
  deleteCharacter(id: number): Observable<void> {
    return this.http.delete<void>(`${CATALOG_API_BASE}/characters/${id}`).pipe(
      catchError(
        catalogErrorHandler(
          'Unable to delete the character. Please try again.',
          'deleteCharacter',
          'entity-in-use',
          this.logger,
        ),
      ),
      tap(() => this.cache.invalidate()),
    );
  }
}
