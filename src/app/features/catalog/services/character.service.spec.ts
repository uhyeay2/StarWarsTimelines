import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogError, EntityInUseError } from '../models/catalog-error';
import { CharacterService } from './character.service';

const BASE = `${environment.apiBaseUrl}/api/characters`;

const CHARACTER = { id: 1, name: 'Luke Skywalker', speciesId: 5 };

describe('CharacterService', () => {
  let service: CharacterService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CharacterService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchCharacters', () => {
    it('populates the characters signal via GET', () => {
      expect(service.characters()).toBeNull();

      service.fetchCharacters();
      httpMock.expectOne(BASE).flush([CHARACTER]);

      expect(service.characters()).toEqual([CHARACTER]);
    });

    it('sets loading signal during fetch', () => {
      expect(service.charactersLoading()).toBe(false);

      service.fetchCharacters();
      expect(service.charactersLoading()).toBe(true);

      httpMock.expectOne(BASE).flush([CHARACTER]);
      expect(service.charactersLoading()).toBe(false);
    });

    it('sets error signal on failure', () => {
      service.fetchCharacters();
      httpMock.expectOne(BASE).flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.charactersError()).toBeTruthy();
      expect(service.characters()).toBeNull();
    });
  });

  describe('createCharacter', () => {
    it('POSTs the body with null coalescing for optional fields', async () => {
      const promise = firstValueFrom(service.createCharacter({ name: 'Yoda' }));

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Yoda',
        bornOnPlanetId: null,
        yearOfBirthEarliest: null,
        yearOfBirthLatest: null,
        yearOfDeathEarliest: null,
        yearOfDeathLatest: null,
        speciesId: null,
      });
      req.flush(CHARACTER);

      const created = await promise;
      expect(created.name).toBe('Luke Skywalker');

      httpMock.expectOne(BASE).flush([]);
    });

    it('sends provided optional fields as-is', async () => {
      const promise = firstValueFrom(
        service.createCharacter({
          name: 'Leia',
          bornOnPlanetId: 3,
          speciesId: 5,
          yearOfBirthEarliest: -19,
          yearOfBirthLatest: -19,
        }),
      );

      const req = httpMock.expectOne(BASE);
      expect(req.request.body).toEqual({
        name: 'Leia',
        bornOnPlanetId: 3,
        yearOfBirthEarliest: -19,
        yearOfBirthLatest: -19,
        yearOfDeathEarliest: null,
        yearOfDeathLatest: null,
        speciesId: 5,
      });
      req.flush({ ...CHARACTER, id: 2, name: 'Leia' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('updateCharacter', () => {
    it('PUTs the body to the character URL', async () => {
      const promise = firstValueFrom(service.updateCharacter(1, { name: 'Luke (updated)' }));

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Luke (updated)',
        bornOnPlanetId: null,
        yearOfBirthEarliest: null,
        yearOfBirthLatest: null,
        yearOfDeathEarliest: null,
        yearOfDeathLatest: null,
        speciesId: null,
      });
      req.flush({ ...CHARACTER, name: 'Luke (updated)' });
      await promise;

      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('deleteCharacter', () => {
    it('sends DELETE to the character URL', async () => {
      let completed = false;
      service.deleteCharacter(1).subscribe({ complete: () => (completed = true) });

      const req = httpMock.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
      httpMock.expectOne(BASE).flush([]);
    });
  });

  describe('error handling', () => {
    it('throws EntityInUseError on 409', async () => {
      const promise = firstValueFrom(service.deleteCharacter(1));
      httpMock
        .expectOne(`${BASE}/1`)
        .flush(
          { detail: 'Character is referenced by events' },
          { status: 409, statusText: 'Conflict' },
        );

      await expect(promise).rejects.toBeInstanceOf(EntityInUseError);
    });

    it('throws CatalogError with code not-found on 404', async () => {
      const promise = firstValueFrom(service.deleteCharacter(999));
      httpMock
        .expectOne(`${BASE}/999`)
        .flush({ detail: 'Character not found' }, { status: 404, statusText: 'Not Found' });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('not-found');
    });

    it('throws CatalogError with code network-error on 500', async () => {
      const promise = firstValueFrom(service.deleteCharacter(1));
      httpMock.expectOne(`${BASE}/1`).flush('Error', {
        status: 500,
        statusText: 'Server Error',
      });

      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CatalogError);
      expect(err.code).toBe('network-error');
    });
  });

  describe('cache invalidation', () => {
    it('invalidates cache after create and re-fetches', async () => {
      service.fetchCharacters();
      httpMock.expectOne(BASE).flush([CHARACTER]);
      expect(service.characters()).toHaveLength(1);

      const promise = firstValueFrom(service.createCharacter({ name: 'Yoda' }));
      httpMock.expectOne(BASE).flush({ id: 2, name: 'Yoda' });
      await promise;

      httpMock.expectOne(BASE).flush([CHARACTER, { id: 2, name: 'Yoda' }]);
      expect(service.characters()).toHaveLength(2);
    });

    it('invalidates cache after delete and re-fetches', async () => {
      service.fetchCharacters();
      httpMock.expectOne(BASE).flush([CHARACTER]);

      const promise = firstValueFrom(service.deleteCharacter(1));
      httpMock.expectOne(`${BASE}/1`).flush(null);
      await promise;

      httpMock.expectOne(BASE).flush([]);
      expect(service.characters()).toEqual([]);
    });
  });
});
