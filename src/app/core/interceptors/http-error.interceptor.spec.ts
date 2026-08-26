import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { httpErrorInterceptor } from './http-error.interceptor';
import { LoggerService } from '../../core/services/logging/logger.service';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let logger: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    logger = TestBed.inject(LoggerService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('logs a failed request with method, url, and status, then rethrows', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const promise = firstValueFrom(http.get('/api/source-materials'));
    httpMock
      .expectOne('/api/source-materials')
      .flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalledWith(
      'HTTP 500 GET /api/source-materials',
      expect.objectContaining({ status: 500 }),
    );
  });

  it('passes successful requests through without logging', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const promise = firstValueFrom(http.get('/api/source-materials'));
    httpMock.expectOne('/api/source-materials').flush([{ id: 'material-a' }]);

    await expect(promise).resolves.toEqual([{ id: 'material-a' }]);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
