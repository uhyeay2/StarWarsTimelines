import { TestBed } from '@angular/core/testing';
import { AppErrorHandler } from './app-error-handler';
import { LoggerService } from '../../core/services/logging/logger.service';

describe('AppErrorHandler', () => {
  let handler: AppErrorHandler;
  let logger: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppErrorHandler, LoggerService],
    });
    handler = TestBed.inject(AppErrorHandler);
    logger = TestBed.inject(LoggerService);
  });

  it('logs unhandled errors through the logger', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const boom = new Error('boom');
    handler.handleError(boom);
    expect(errorSpy).toHaveBeenCalledWith('Unhandled application error', { error: boom });
  });
});
