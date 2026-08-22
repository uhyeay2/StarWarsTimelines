import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, finalize, of } from 'rxjs';

export interface RunOperationConfig<TBusy, TResult> {
  /** Signal flipped while the operation is in flight. */
  busy: WritableSignal<TBusy>;
  /** Value assigned to `busy` when the operation starts. */
  busyValue: TBusy;
  /** Value assigned to `busy` once the operation settles. */
  idleValue: TBusy;
  /** Receives the failure message; omit for flows without an error surface. */
  error?: WritableSignal<string | null>;
  /**
   * Extra failure handling (e.g. derived flags) invoked after `error` is set.
   */
  onError?: (err: Error) => void;
  operation: Observable<TResult>;
  /** Invoked only when the operation completes without an error. */
  onSuccess?: (result: TResult) => void;
}

/**
 * Runs an async operation with uniform busy/error bookkeeping.
 *
 * Components pass their busy signal (boolean- or key-typed), an optional
 * error signal, and the observable to run. On failure the error signal
 * receives `err.message`; on success `onSuccess` fires exactly once. The
 * busy signal always resets, whether the operation succeeded or failed.
 *
 * Callers are responsible for clearing stale errors and validating input
 * before invoking this helper.
 */
export function runOperation<TBusy, TResult>(config: RunOperationConfig<TBusy, TResult>): void {
  const { busy, busyValue, idleValue, error, onError, onSuccess, operation } = config;
  busy.set(busyValue);
  let failed = false;
  operation
    .pipe(
      catchError((err: Error) => {
        failed = true;
        error?.set(err.message);
        onError?.(err);
        return of(undefined as unknown as TResult);
      }),
      finalize(() => busy.set(idleValue)),
    )
    .subscribe((result) => {
      if (!failed) {
        onSuccess?.(result);
      }
    });
}
