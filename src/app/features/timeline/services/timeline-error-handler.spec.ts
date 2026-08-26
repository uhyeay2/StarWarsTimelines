import { HttpErrorResponse } from '@angular/common/http';
import { classifyTimelineError, mapTimelineError } from './timeline-error-handler';
import { TimelineErrorCode } from '../models/timeline-error';

describe('classifyTimelineError', () => {
  it('returns NetworkError for status 0', () => {
    const err = new HttpErrorResponse({ status: 0 });
    expect(classifyTimelineError(err)).toBe(TimelineErrorCode.NetworkError);
  });

  it('returns NotFound for status 404', () => {
    const err = new HttpErrorResponse({ status: 404 });
    expect(classifyTimelineError(err)).toBe(TimelineErrorCode.NotFound);
  });

  it('returns NetworkError for status 503', () => {
    const err = new HttpErrorResponse({ status: 503 });
    expect(classifyTimelineError(err)).toBe(TimelineErrorCode.NetworkError);
  });

  it('returns NetworkError for status 504', () => {
    const err = new HttpErrorResponse({ status: 504 });
    expect(classifyTimelineError(err)).toBe(TimelineErrorCode.NetworkError);
  });

  it('returns ServerError for other HTTP errors', () => {
    const err = new HttpErrorResponse({ status: 500 });
    expect(classifyTimelineError(err)).toBe(TimelineErrorCode.ServerError);
  });

  it('returns NetworkError for non-HTTP errors', () => {
    expect(classifyTimelineError(new Error('fail'))).toBe(TimelineErrorCode.NetworkError);
  });
});

describe('mapTimelineError', () => {
  it('extracts ProblemDetails from HttpErrorResponse', () => {
    const err = new HttpErrorResponse({
      status: 500,
      error: { detail: 'Server broke' },
    });
    expect(mapTimelineError(err, 'fallback')).toBe('Server broke');
  });

  it('falls back to provided message when no ProblemDetails', () => {
    const err = new HttpErrorResponse({ status: 500 });
    expect(mapTimelineError(err, 'My fallback')).toBe('My fallback');
  });

  it('returns message from Error instances', () => {
    expect(mapTimelineError(new Error('oops'), 'fallback')).toBe('oops');
  });

  it('returns fallback for unknown error types', () => {
    expect(mapTimelineError('string error', 'fallback')).toBe('fallback');
  });
});
