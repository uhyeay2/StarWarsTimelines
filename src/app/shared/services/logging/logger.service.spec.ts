/**
 * @fileoverview Tests for the hardened LoggerService.
 *
 * Covers configurable log levels, silent mode, structured context,
 * colorized output, performance safeguards, grouping, level overrides,
 * external sinks, and flush behaviour.
 */

import { TestBed } from '@angular/core/testing';
import { LoggerService, LOG_CONFIG, LogEntry, LogSink, LogLevel } from './logger.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockConsole(level: LogLevel) {
  const method = vi.spyOn(console, level).mockImplementation(() => undefined);
  return method;
}

function mockAllConsole() {
  return {
    debug: mockConsole('debug'),
    info: mockConsole('info'),
    warn: mockConsole('warn'),
    error: mockConsole('error'),
  };
}

function restoreAll(spies: ReturnType<typeof mockAllConsole>) {
  Object.values(spies).forEach((s) => s.mockRestore());
}

function lastCall(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls[spy.mock.calls.length - 1] ?? [];
}

// ─── Serialization helpers ──────────────────────────────────────────────────

describe('LoggerService (serialization helpers)', () => {
  it('truncates long strings in context', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { maxStringLength: 10, colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    svc.info('msg', { long: 'a'.repeat(20) });
    const serialized = lastCall(spy)[2] as Record<string, unknown>;
    expect(serialized['long']).toBe('a'.repeat(10) + '...');
    spy.mockRestore();
  });

  it('limits object depth', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { maxDepth: 2, colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    svc.info('msg', { a: { b: { c: 'deep' } } });
    const serialized = lastCall(spy)[2] as Record<string, unknown>;
    expect(serialized).toEqual({ a: { b: { c: '[Depth limit exceeded]' } } });
    spy.mockRestore();
  });

  it('detects circular references', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    const obj: Record<string, unknown> = { a: 1 };
    obj['self'] = obj;
    svc.info('msg', obj);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('serializes Error objects with name, message, and truncated stack', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    const error = new Error('test error');
    svc.info('msg', { error });
    const serialized = lastCall(spy)[2] as Record<string, unknown>;
    const inner = serialized['error'] as Record<string, unknown>;
    expect(inner['name']).toBe('Error');
    expect(inner['message']).toBe('test error');
    expect(typeof inner['stack']).toBe('string');
    spy.mockRestore();
  });

  it('serializes BigInt values', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    svc.info('msg', { val: BigInt(42) });
    const serialized = lastCall(spy)[2] as Record<string, unknown>;
    expect(serialized['val']).toBe('42n');
    spy.mockRestore();
  });

  it('serializes Symbol values', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    svc.info('msg', { val: Symbol('test') });
    const serialized = lastCall(spy)[2] as Record<string, unknown>;
    expect(serialized['val']).toBe('Symbol(test)');
    spy.mockRestore();
  });

  it('serializes function values', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
    });
    const svc = TestBed.inject(LoggerService);
    const spy = mockConsole('info');
    svc.info('msg', { fn: () => {} });
    const serialized = lastCall(spy)[2] as Record<string, unknown>;
    expect((serialized['fn'] as string).startsWith('[Function:')).toBe(true);
    spy.mockRestore();
  });
});

// ─── LoggerService ──────────────────────────────────────────────────────────

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
    });
    service = TestBed.inject(LoggerService);
  });

  // ── Basic logging ───────────────────────────────────────────────────

  describe('basic logging', () => {
    it('logs info messages to console.info', () => {
      const spy = mockConsole('info');
      service.info('hello');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(lastCall(spy)[0]).toContain('[INFO]');
      expect(lastCall(spy)[1]).toBe('hello');
      spy.mockRestore();
    });

    it('logs debug messages to console.debug', () => {
      const spy = mockConsole('debug');
      service.debug('trace');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(lastCall(spy)[0]).toContain('[DEBUG]');
      spy.mockRestore();
    });

    it('logs warn messages to console.warn', () => {
      const spy = mockConsole('warn');
      service.warn('careful');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(lastCall(spy)[0]).toContain('[WARN]');
      spy.mockRestore();
    });

    it('logs error messages to console.error', () => {
      const spy = mockConsole('error');
      service.error('failed');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(lastCall(spy)[0]).toContain('[ERROR]');
      spy.mockRestore();
    });

    it('includes the application name in the prefix', () => {
      const spy = mockConsole('info');
      service.info('test');
      expect(lastCall(spy)[0]).toContain('[Star Wars Timelines]');
      spy.mockRestore();
    });

    it('includes an ISO-8601 timestamp in the prefix', () => {
      const spy = mockConsole('info');
      service.info('test');
      const prefix = lastCall(spy)[0] as string;
      const isoMatch = prefix.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(isoMatch).not.toBeNull();
      spy.mockRestore();
    });
  });

  // ── Structured context ──────────────────────────────────────────────

  describe('structured context', () => {
    it('passes context as a serialized second argument', () => {
      const spy = mockConsole('info');
      service.info('action', { userId: '123', action: 'login' });
      expect(lastCall(spy)[1]).toBe('action');
      expect(lastCall(spy)[2]).toEqual({ userId: '123', action: 'login' });
      spy.mockRestore();
    });

    it('omits the context argument when none is provided', () => {
      const spy = mockConsole('info');
      service.info('no context');
      expect(lastCall(spy).length).toBe(2);
      spy.mockRestore();
    });

    it('handles nested objects', () => {
      const spy = mockConsole('info');
      service.info('nested', { a: { b: { c: 42 } } });
      expect(lastCall(spy)[2]).toEqual({ a: { b: { c: 42 } } });
      spy.mockRestore();
    });

    it('handles arrays in context', () => {
      const spy = mockConsole('info');
      service.info('array', { ids: ['a', 'b', 'c'] });
      expect(lastCall(spy)[2]).toEqual({ ids: ['a', 'b', 'c'] });
      spy.mockRestore();
    });
  });

  // ── Log level filtering ─────────────────────────────────────────────

  describe('log level filtering', () => {
    it('suppresses debug messages when minLevel is info', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { minLevel: 'info', colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spy = mockConsole('debug');
      svc.debug('suppressed');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('allows info messages when minLevel is info', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { minLevel: 'info', colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spy = mockConsole('info');
      svc.info('visible');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('shows only warn and error when minLevel is warn', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { minLevel: 'warn', colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spies = mockAllConsole();
      svc.debug('nope');
      svc.info('nope');
      svc.warn('yes');
      svc.error('yes');
      expect(spies.debug).not.toHaveBeenCalled();
      expect(spies.info).not.toHaveBeenCalled();
      expect(spies.warn).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledTimes(1);
      restoreAll(spies);
    });

    it('defaults to debug level in development', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { minLevel: 'debug', colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spies = mockAllConsole();
      svc.debug('visible');
      svc.info('visible');
      svc.warn('visible');
      svc.error('visible');
      expect(spies.debug).toHaveBeenCalledTimes(1);
      expect(spies.info).toHaveBeenCalledTimes(1);
      expect(spies.warn).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledTimes(1);
      restoreAll(spies);
    });
  });

  // ── Silent mode ─────────────────────────────────────────────────────

  describe('silent mode', () => {
    it('suppresses all console output when silent is true', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { silent: true, colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spies = mockAllConsole();
      svc.debug('nope');
      svc.info('nope');
      svc.warn('nope');
      svc.error('nope');
      Object.values(spies).forEach((s) => expect(s).not.toHaveBeenCalled());
      restoreAll(spies);
    });

    it('still calls fn in group/groupCollapsed when silent', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { silent: true, colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      let called = false;
      svc.group('test', () => {
        called = true;
      });
      expect(called).toBe(true);
    });
  });

  // ── withLevel ───────────────────────────────────────────────────────

  describe('withLevel', () => {
    it('logs at the specified level', () => {
      const spy = mockConsole('debug');
      const bound = service.withLevel('debug');
      bound.debug('trace');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('suppresses messages below the specified level', () => {
      const debugSpy = mockConsole('debug');
      const infoSpy = mockConsole('info');
      const bound = service.withLevel('info');
      bound.debug('suppressed');
      bound.info('visible');
      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledTimes(1);
      debugSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('allows messages at or above the specified level', () => {
      const warnSpy = mockConsole('warn');
      const errorSpy = mockConsole('error');
      const bound = service.withLevel('warn');
      bound.warn('visible');
      bound.error('visible');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('passes context through to the underlying log', () => {
      const spy = mockConsole('info');
      const bound = service.withLevel('info');
      bound.info('test', { key: 'value' });
      expect(lastCall(spy)[2]).toEqual({ key: 'value' });
      spy.mockRestore();
    });
  });

  // ── External sinks ──────────────────────────────────────────────────

  describe('external sinks', () => {
    it('forwards log entries to registered sinks asynchronously', async () => {
      const sink: LogSink = { log: vi.fn() };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { sinks: [sink], colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spy = mockConsole('info');

      svc.info('test message', { key: 'value' });

      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(sink.log).toHaveBeenCalledTimes(1);
      const entry = (sink.log as ReturnType<typeof vi.fn>).mock.calls[0]![0]!;
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('test message');
      expect(entry.context).toEqual({ key: 'value' });
      expect(typeof entry.timestamp).toBe('string');
      spy.mockRestore();
    });

    it('forwards entries for all log levels', async () => {
      const sink: LogSink = { log: vi.fn() };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { sinks: [sink], colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spies = mockAllConsole();

      svc.debug('d');
      svc.info('i');
      svc.warn('w');
      svc.error('e');

      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(sink.log).toHaveBeenCalledTimes(4);
      const levels = (sink.log as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => (c[0] as LogEntry).level,
      );
      expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
      restoreAll(spies);
    });

    it('catches sink errors without crashing', async () => {
      const sink: LogSink = {
        log: vi.fn(() => {
          throw new Error('sink boom');
        }),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { sinks: [sink], colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const infoSpy = mockConsole('info');
      const errorSpy = mockConsole('error');

      svc.info('test');
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(sink.log).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Sink failed'));
      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('does not forward when silent is true', async () => {
      const sink: LogSink = { log: vi.fn() };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: LOG_CONFIG, useValue: { sinks: [sink], silent: true, colorize: false } },
        ],
      });
      const svc = TestBed.inject(LoggerService);
      const spies = mockAllConsole();

      svc.info('test');
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(sink.log).not.toHaveBeenCalled();
      restoreAll(spies);
    });

    it('does not forward when below minLevel', async () => {
      const sink: LogSink = { log: vi.fn() };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: LOG_CONFIG, useValue: { sinks: [sink], minLevel: 'warn', colorize: false } },
        ],
      });
      const svc = TestBed.inject(LoggerService);
      const spies = mockAllConsole();

      svc.debug('suppressed');
      svc.info('suppressed');
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(sink.log).not.toHaveBeenCalled();
      restoreAll(spies);
    });
  });

  // ── Colorized output ────────────────────────────────────────────────

  describe('colorized output', () => {
    it('uses %c format when colorize is true', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { colorize: true } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spy = mockConsole('info');
      svc.info('hello');
      expect(lastCall(spy)[0]).toContain('%c');
      spy.mockRestore();
    });

    it('does not use %c format when colorize is false', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spy = mockConsole('info');
      svc.info('hello');
      expect(lastCall(spy)[0]).not.toContain('%c');
      spy.mockRestore();
    });

    it('applies level-specific CSS styles', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { colorize: true } }],
      });
      const svc = TestBed.inject(LoggerService);

      const debugSpy = mockConsole('debug');
      svc.debug('d');
      expect(lastCall(debugSpy)[0]).toContain('%c');
      debugSpy.mockRestore();

      const warnSpy = mockConsole('warn');
      svc.warn('w');
      expect(lastCall(warnSpy)[0]).toContain('%c');
      warnSpy.mockRestore();
    });
  });

  // ── Grouping ────────────────────────────────────────────────────────

  describe('grouping', () => {
    it('calls console.group and console.groupEnd', () => {
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => undefined);
      const endSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
      service.group('test', () => {});
      expect(groupSpy).toHaveBeenCalledWith('test');
      expect(endSpy).toHaveBeenCalledTimes(1);
      groupSpy.mockRestore();
      endSpy.mockRestore();
    });

    it('calls console.groupCollapsed', () => {
      const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
      const endSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
      service.groupCollapsed('test', () => {});
      expect(spy).toHaveBeenCalledWith('test');
      expect(endSpy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      endSpy.mockRestore();
    });

    it('always calls groupEnd even if fn throws', () => {
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => undefined);
      const endSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
      expect(() =>
        service.group('test', () => {
          throw new Error('boom');
        }),
      ).toThrow('boom');
      expect(endSpy).toHaveBeenCalledTimes(1);
      groupSpy.mockRestore();
      endSpy.mockRestore();
    });

    it('does not call console.group when silent', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { silent: true, colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => undefined);
      let called = false;
      svc.group('test', () => {
        called = true;
      });
      expect(groupSpy).not.toHaveBeenCalled();
      expect(called).toBe(true);
      groupSpy.mockRestore();
    });

    it('does not call console.groupCollapsed when silent', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { silent: true, colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
      let called = false;
      svc.groupCollapsed('test', () => {
        called = true;
      });
      expect(spy).not.toHaveBeenCalled();
      expect(called).toBe(true);
      spy.mockRestore();
    });

    it('executes fn body inside the group', () => {
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => undefined);
      const endSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
      const steps: string[] = [];
      service.group('ops', () => {
        steps.push('a');
        steps.push('b');
      });
      expect(steps).toEqual(['a', 'b']);
      expect(groupSpy).toHaveBeenCalledTimes(1);
      expect(endSpy).toHaveBeenCalledTimes(1);
      groupSpy.mockRestore();
      endSpy.mockRestore();
    });
  });

  // ── Flush ───────────────────────────────────────────────────────────

  describe('flush', () => {
    it('calls flush on sinks that support it', async () => {
      const sink: LogSink = {
        log: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { sinks: [sink], colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      await svc.flush();
      expect(sink.flush).toHaveBeenCalledTimes(1);
    });

    it('does not fail for sinks without flush', async () => {
      const sink: LogSink = { log: vi.fn() };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { sinks: [sink], colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      await expect(svc.flush()).resolves.toBeUndefined();
    });

    it('resolves even with no sinks', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOG_CONFIG, useValue: { colorize: false } }],
      });
      const svc = TestBed.inject(LoggerService);
      await expect(svc.flush()).resolves.toBeUndefined();
    });
  });
});
