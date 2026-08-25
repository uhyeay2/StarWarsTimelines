import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { STORAGE_KEYS } from '../../shared/services/storage.service';

const API = environment.apiBaseUrl;

function seedSession(values: Record<string, string>): void {
  sessionStorage.clear();
  for (const [key, value] of Object.entries(values)) {
    sessionStorage.setItem(key, value);
  }
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    seedSession({
      [STORAGE_KEYS.token]: 'access-1',
      [STORAGE_KEYS.refreshToken]: 'refresh-1',
      [STORAGE_KEYS.user]: JSON.stringify({ id: 'u1', username: 'luke' }),
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('attaches the bearer token to API requests', () => {
    http.get(`${API}/api/source-materials`).subscribe();

    const request = httpMock.expectOne(`${API}/api/source-materials`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush([]);
  });

  it('skips auth headers for auth endpoints', () => {
    http.post(`${API}/api/auth/login`, {}).subscribe();

    const request = httpMock.expectOne(`${API}/api/auth/login`);
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush({});
  });

  it('sends unauthenticated requests without a header', () => {
    seedSession({});

    http.get(`${API}/api/timeline-events`).subscribe();

    const request = httpMock.expectOne(`${API}/api/timeline-events`);
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush([]);
  });

  it('refreshes once and retries the original request on 401', () => {
    http.get(`${API}/api/library`).subscribe();

    const first = httpMock.expectOne(`${API}/api/library`);
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');
    first.flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = httpMock.expectOne(`${API}/api/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    const retry = httpMock.expectOne(`${API}/api/library`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush([]);

    // New tokens are persisted for subsequent requests.
    expect(sessionStorage.getItem(STORAGE_KEYS.token)).toBe('access-2');
    expect(sessionStorage.getItem(STORAGE_KEYS.refreshToken)).toBe('refresh-2');
  });

  it('queues concurrent 401s behind a single shared refresh', () => {
    const results: number[] = [];
    http.get(`${API}/api/library`).subscribe(() => results.push(1));
    http.get(`${API}/api/catalog`).subscribe(() => results.push(2));

    httpMock
      .expectOne(`${API}/api/library`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${API}/api/catalog`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne(`${API}/api/auth/refresh`)
      .flush({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    const retryLibrary = httpMock.expectOne(`${API}/api/library`);
    expect(retryLibrary.request.headers.get('Authorization')).toBe('Bearer access-2');
    retryLibrary.flush([]);

    const retryCatalog = httpMock.expectOne(`${API}/api/catalog`);
    expect(retryCatalog.request.headers.get('Authorization')).toBe('Bearer access-2');
    retryCatalog.flush([]);

    expect(results).toEqual([1, 2]);
  });
});
