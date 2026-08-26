/**
 * @fileoverview Tests for {@link LibraryCacheManager}, including the
 * regression guard ensuring `ensureTracked` never creates reactive
 * dependencies on cache signals when invoked inside page effects.
 */

import { Component, effect, inject } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LibraryItemDto } from './library.dto';
import { LibraryCacheManager } from './library-cache-manager';

const USER_ID = 'user-1';

/** URL the cache manager fetches for the fixture user. */
const URL_FOR_USER = `${environment.apiBaseUrl}/api/users/${USER_ID}/source-materials`;

const ITEM_DTO: LibraryItemDto = {
  sourceMaterialId: 10,
  title: 'The High Republic',
  medium: 1,
  canonType: 0,
  status: 0,
  isFavorite: false,
  units: [],
};

@Component({ template: '' })
class EffectCallerHost {
  private readonly cache = inject(LibraryCacheManager);

  constructor() {
    // Mirrors the page components: an effect whose only reactive read should
    // be the user id, delegating fetch decisions to `ensureTracked`.
    effect(() => {
      this.cache.ensureTracked(USER_ID);
    });
  }
}

describe('LibraryCacheManager', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('ensureTracked', () => {
    it('fetches once for a user', () => {
      const cache = TestBed.inject(LibraryCacheManager);

      cache.ensureTracked(USER_ID);
      expect(httpMock.expectOne(URL_FOR_USER)).toBeTruthy();

      // A second call while the request is still in flight is ignored.
      cache.ensureTracked(USER_ID);
      expect(httpMock.match(URL_FOR_USER).length).toBe(0);
    });

    it('does not refetch for a user whose library loaded successfully', () => {
      const cache = TestBed.inject(LibraryCacheManager);

      cache.ensureTracked(USER_ID);
      httpMock.expectOne(URL_FOR_USER).flush([ITEM_DTO]);

      cache.ensureTracked(USER_ID);
      expect(httpMock.match(URL_FOR_USER).length).toBe(0);
    });

    it('allows one explicit retry after a failed load', () => {
      const cache = TestBed.inject(LibraryCacheManager);

      cache.ensureTracked(USER_ID);
      httpMock.expectOne(URL_FOR_USER).error(new ProgressEvent('network error'), { status: 500 });

      cache.ensureTracked(USER_ID);
      expect(httpMock.expectOne(URL_FOR_USER)).toBeTruthy();
    });

    it('does not loop when called from a reactive effect and the fetch fails', async () => {
      // Regression: `ensureTracked` used to read the `loading` signal inside
      // the caller's reactive context. When a fetch failed, `loading`
      // toggled true→false, which re-triggered the calling effect, which
      // refetched and failed again — an infinite request loop that froze
      // the Tracked Events / Wish List pages whenever the API was down.
      const fixture = TestBed.createComponent(EffectCallerHost);
      fixture.detectChanges();

      const first = httpMock.expectOne(URL_FOR_USER);
      first.error(new ProgressEvent('network error'), { status: 500 });

      // Give the effect scheduler several chances to re-run if the failure
      // toggles any signal the effect now (incorrectly) depends on.
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(httpMock.match(URL_FOR_USER).length).toBe(0);
    });
  });
});
