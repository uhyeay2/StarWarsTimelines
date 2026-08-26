import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import {
  CatalogError,
  CatalogErrorCode,
  DuplicateEntityError,
  EntityInUseError,
} from '../models/catalog-error';
import { LoggerService } from '../../../core/services/logging/logger.service';
import { catalogErrorHandler } from './catalog-error-handler';

function makeError(status: number, body?: Record<string, unknown>): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Error',
    url: '/api/test',
    error: body,
  });
}

describe('catalogErrorHandler', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as LoggerService;
  });

  it('returns an EntityInUseError on 409 with default conflictCode', async () => {
    const handler = catalogErrorHandler('fallback', 'test', CatalogErrorCode.EntityInUse, logger);
    const error = makeError(409, { detail: 'Entity in use' });

    await expect(firstValueFrom(handler(error))).rejects.toThrow(EntityInUseError);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns a DuplicateEntityError on 409 when conflictCode is DuplicateEntity', async () => {
    const handler = catalogErrorHandler(
      'fallback',
      'test',
      CatalogErrorCode.DuplicateEntity,
      logger,
    );
    const error = makeError(409, { detail: 'Duplicate' });

    await expect(firstValueFrom(handler(error))).rejects.toThrow(DuplicateEntityError);
  });

  it('returns CatalogError with NotFound code on 404', async () => {
    const handler = catalogErrorHandler('fallback', 'test', CatalogErrorCode.EntityInUse, logger);
    const error = makeError(404);

    await expect(
      firstValueFrom(handler(error)).then(() => {
        throw new Error('Expected error');
      }),
    ).rejects.toThrow(CatalogError);

    await expect(firstValueFrom(handler(error))).rejects.toMatchObject({
      code: CatalogErrorCode.NotFound,
    });
  });

  it('returns CatalogError with NetworkError code on 500', async () => {
    const handler = catalogErrorHandler('fallback', 'test', CatalogErrorCode.EntityInUse, logger);
    const error = makeError(500);

    await expect(firstValueFrom(handler(error))).rejects.toMatchObject({
      code: CatalogErrorCode.NetworkError,
    });
  });

  it('uses the ProblemDetails detail when available', async () => {
    const handler = catalogErrorHandler('fallback', 'test', CatalogErrorCode.EntityInUse, logger);
    const error = makeError(500, { detail: 'Custom server error' });

    await expect(firstValueFrom(handler(error))).rejects.toMatchObject({
      message: 'Custom server error',
    });
  });

  it('falls back to the provided fallback message when no ProblemDetails', async () => {
    const handler = catalogErrorHandler(
      'My fallback',
      'test',
      CatalogErrorCode.EntityInUse,
      logger,
    );
    const error = makeError(500);

    await expect(firstValueFrom(handler(error))).rejects.toMatchObject({ message: 'My fallback' });
  });
});
