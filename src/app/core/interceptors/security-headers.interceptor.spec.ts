import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { securityHeadersInterceptor } from './security-headers.interceptor';

describe('securityHeadersInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([securityHeadersInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('passes the request through to the next handler', () => {
    http.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('does not warn when all expected security headers are present', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    http.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    req.flush({}, { headers: { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' } });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
