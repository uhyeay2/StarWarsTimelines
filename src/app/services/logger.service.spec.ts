import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggerService);
  });

  it('logs info messages to the console with a level prefix', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    service.info('hello');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const args = infoSpy.mock.calls[0];
    expect((args[0] as string)).toContain('[INFO]');
    expect(args[1]).toBe('hello');
    infoSpy.mockRestore();
  });

  it('logs debug messages to the console debug method', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    service.debug('tracing', { userId: 'user-padme' });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    const args = debugSpy.mock.calls[0];
    expect((args[0] as string)).toContain('[DEBUG]');
    expect(args[1]).toBe('tracing');
    expect(args[2]).toEqual({ userId: 'user-padme' });
    debugSpy.mockRestore();
  });

  it('logs warn messages to the console warn method', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.warn('careful');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect((warnSpy.mock.calls[0][0] as string)).toContain('[WARN]');
    warnSpy.mockRestore();
  });

  it('logs error messages to the console error method', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = new Error('boom');
    service.error('failed', boom);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const args = errorSpy.mock.calls[0];
    expect((args[0] as string)).toContain('[ERROR]');
    expect(args[1]).toBe('failed');
    expect(args[2]).toBe(boom);
    errorSpy.mockRestore();
  });
});
