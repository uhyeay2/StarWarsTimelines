import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { runOperation } from './async-operation';

describe('runOperation', () => {
  it('flips a boolean busy signal while the operation runs', () => {
    const busy = signal(false);
    const operation = new Subject<void>();

    runOperation({
      busy,
      busyValue: true,
      idleValue: false,
      error: signal<string | null>(null),
      operation,
    });

    expect(busy()).toBe(true);

    operation.next();
    operation.complete();

    expect(busy()).toBe(false);
  });

  it('resets the busy signal after the operation completes', () => {
    const busy = signal(false);

    runOperation({
      busy,
      busyValue: true,
      idleValue: false,
      operation: of('done'),
    });

    expect(busy()).toBe(false);
  });

  it('invokes onSuccess with the emitted value on success', () => {
    const busy = signal(false);
    const seen: string[] = [];

    runOperation({
      busy,
      busyValue: true,
      idleValue: false,
      operation: of('result'),
      onSuccess: (value) => seen.push(value),
    });

    expect(seen).toEqual(['result']);
  });

  it('sets the error signal and skips onSuccess when the operation fails', () => {
    const busy = signal(false);
    const error = signal<string | null>(null);
    const succeeded: unknown[] = [];
    const failure = new Error('Server unavailable');

    runOperation({
      busy,
      busyValue: true,
      idleValue: false,
      error,
      operation: throwError(() => failure),
      onSuccess: (value) => succeeded.push(value),
    });

    expect(error()).toBe('Server unavailable');
    expect(succeeded).toEqual([]);
    expect(busy()).toBe(false);
  });

  it('invokes onError after setting the error signal', () => {
    const error = signal<string | null>(null);
    const order: string[] = [];
    const failure = new Error('Boom');

    runOperation({
      busy: signal(false),
      busyValue: true,
      idleValue: false,
      error,
      onError: () => order.push(`onError:${error()}`),
      operation: throwError(() => failure),
    });

    expect(order).toEqual(['onError:Boom']);
  });

  it('supports key-typed busy signals for per-row operations', () => {
    const savingId = signal<string | null>(null);
    const succeeded: unknown[] = [];

    runOperation({
      busy: savingId,
      busyValue: 'item-1',
      idleValue: null,
      error: signal<string | null>(null),
      operation: throwError(() => new Error('Nope')),
      onSuccess: (value) => succeeded.push(value),
    });

    expect(succeeded).toEqual([]);
    expect(savingId()).toBeNull();
  });
});
