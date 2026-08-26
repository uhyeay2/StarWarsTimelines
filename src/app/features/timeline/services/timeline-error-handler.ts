import { HttpErrorResponse } from '@angular/common/http';
import { readProblemDetail } from '../../../shared/utils/problem-detail';
import { TimelineErrorCode } from '../models/timeline-error';

/**
 * Classifies a raw error into a {@link TimelineErrorCode}.
 *
 * @param err  The caught error.
 * @returns The appropriate error code.
 */
export function classifyTimelineError(err: unknown): TimelineErrorCode {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return TimelineErrorCode.NetworkError;
    }
    if (err.status === 404) {
      return TimelineErrorCode.NotFound;
    }
    if ([503, 504].includes(err.status)) {
      return TimelineErrorCode.NetworkError;
    }
    return TimelineErrorCode.ServerError;
  }
  return TimelineErrorCode.NetworkError;
}

/**
 * Maps a raw error to a human-readable message.
 *
 * @param err           The caught error.
 * @param fallbackMessage  The default message when the error type is unknown.
 * @returns A display-friendly error message.
 */
export function mapTimelineError(err: unknown, fallbackMessage: string): string {
  if (err instanceof HttpErrorResponse) {
    return readProblemDetail(err, fallbackMessage);
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallbackMessage;
}
