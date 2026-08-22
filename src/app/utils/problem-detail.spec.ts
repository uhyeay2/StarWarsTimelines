import { HttpErrorResponse } from '@angular/common/http';
import { readProblemDetail } from './problem-detail';

function makeError(body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status: 400, error: body });
}

describe('readProblemDetail', () => {
  it('reads the detail field from a ProblemDetails body', () => {
    const error = makeError({ title: 'Bad Request', detail: 'A name is required.' });

    expect(readProblemDetail(error, 'fallback')).toBe('A name is required.');
  });

  it('falls back when the body has no detail field', () => {
    const error = makeError({ title: 'Bad Request' });

    expect(readProblemDetail(error, 'fallback')).toBe('fallback');
  });

  it('falls back when the body is missing or not an object', () => {
    expect(readProblemDetail(makeError(null), 'fallback')).toBe('fallback');
    expect(readProblemDetail(makeError('plain text'), 'fallback')).toBe('fallback');
  });
});
