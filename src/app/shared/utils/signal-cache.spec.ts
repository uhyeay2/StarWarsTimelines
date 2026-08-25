import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { SignalCache } from './signal-cache';

describe('SignalCache', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  afterEach(() => vi.useRealTimers());

  it('starts with null data, false loading, null error', () => {
    const cache = new SignalCache(() => of([1, 2, 3]));
    expect(cache.data()).toBeNull();
    expect(cache.loading()).toBe(false);
    expect(cache.error()).toBeNull();
  });

  it('fetch populates data signal', () => {
    const cache = new SignalCache(() => of([1, 2, 3]));
    cache.fetch();
    expect(cache.data()).toEqual([1, 2, 3]);
    expect(cache.loading()).toBe(false);
    expect(cache.error()).toBeNull();
  });

  it('fetch sets loading to true while in flight', () => {
    let emitFn!: (value: number[]) => void;
    const cache = new SignalCache(
      () =>
        new Observable<number[]>((sub) => {
          emitFn = (v) => {
            sub.next(v);
            sub.complete();
          };
        }),
    );

    cache.fetch();
    expect(cache.loading()).toBe(true);

    emitFn([42]);
    expect(cache.loading()).toBe(false);
    expect(cache.data()).toEqual([42]);
  });

  it('fetch guards against concurrent calls', () => {
    let callCount = 0;
    // Use a non-completing Observable so loading stays true during the guard check
    const cache = new SignalCache(
      () =>
        new Observable((_sub) => {
          callCount++;
        }),
    );

    cache.fetch();
    cache.fetch(); // second call should be no-op while loading

    expect(callCount).toBe(1);
  });

  it('fetch sets error signal on failure', () => {
    const cache = new SignalCache(
      () => throwError(() => new Error('boom')),
      (err: unknown) => (err as Error).message,
    );

    cache.fetch();
    expect(cache.error()).toBe('boom');
    expect(cache.data()).toBeNull();
    expect(cache.loading()).toBe(false);
  });

  it('fetch uses default error message when no errorHandler provided', () => {
    const cache = new SignalCache(() => throwError(() => new Error('boom')));
    cache.fetch();
    expect(cache.error()).toBe('Failed to load data');
  });

  it('invalidate clears data and re-fetches', () => {
    let callCount = 0;
    const cache = new SignalCache(() => {
      callCount++;
      return of([callCount]);
    });

    cache.fetch();
    expect(cache.data()).toEqual([1]);

    cache.invalidate();
    expect(cache.data()).toEqual([2]);
    expect(callCount).toBe(2);
  });

  it('TTL expires data and re-fetches automatically', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const cache = new SignalCache(
      () => {
        callCount++;
        return of([callCount]);
      },
      undefined,
      1000,
    );

    cache.fetch();
    expect(cache.data()).toEqual([1]);

    // Advance past TTL — timer fires and triggers re-fetch
    vi.advanceTimersByTime(1000);
    expect(cache.data()).toEqual([2]);
    expect(callCount).toBe(2);

    vi.useRealTimers();
  });

  it('invalidate cancels pending TTL timer', () => {
    vi.useFakeTimers();
    let callCount = 0;
    const cache = new SignalCache(
      () => {
        callCount++;
        return of([callCount]);
      },
      undefined,
      5000,
    );

    cache.fetch();
    expect(cache.data()).toEqual([1]); // callCount=1, TTL timer set for t=5000

    // Advance to t=3000 — old timer hasn't fired yet
    vi.advanceTimersByTime(3000);
    expect(callCount).toBe(1);

    // Invalidate at t=3000 — cancels old timer, starts new fetch + new TTL for t=8000
    cache.invalidate();
    expect(cache.data()).toEqual([2]); // callCount=2

    // Advance to t=5000 — OLD timer would have fired here, but it was cancelled
    vi.advanceTimersByTime(2000);
    expect(callCount).toBe(2); // no extra fetch from old timer

    // Advance to t=8000 — new timer fires
    vi.advanceTimersByTime(3000);
    expect(callCount).toBe(3); // re-fetch from new TTL

    vi.useRealTimers();
  });

  it('TTL of 0 means no automatic expiry', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const cache = new SignalCache(
      () => {
        callCount++;
        return of([callCount]);
      },
      undefined,
      0,
    );

    cache.fetch();
    expect(cache.data()).toEqual([1]);

    vi.advanceTimersByTime(60_000);
    expect(callCount).toBe(1);

    vi.useRealTimers();
  });

  it('can be used inside TestBed', () => {
    let cache: SignalCache<string>;
    TestBed.runInInjectionContext(() => {
      cache = new SignalCache(() => of('hello'));
    });

    cache!.fetch();
    expect(cache!.data()).toBe('hello');
  });
});
