/**
 * @fileoverview Shared HTTP error-handling utilities.
 *
 * Provides helpers that extract user-friendly messages from server error
 * responses conforming to the ASP.NET Core {@link https://learn.microsoft.com/en-us/aspnet/core/web-api/handle-errors|ProblemDetails} format.
 */

import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from '../models/problem-details';

/**
 * Reads the `detail` field from an ASP.NET Core
 * {@link https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.mvc.problemdetails|ProblemDetails}
 * error body.
 *
 * Falls back to the provided `fallback` message when the response body is
 * missing, malformed, or does not contain a `detail` property.
 *
 * @param error  The HTTP error response caught by an RxJS `catchError`.
 * @param fallback  A human-readable default message when the server does not provide one.
 * @returns The server-provided detail string, or `fallback`.
 */
export function readProblemDetail(error: HttpErrorResponse, fallback: string): string {
  const body = error.error as ProblemDetails | null;
  return body?.detail || fallback;
}
