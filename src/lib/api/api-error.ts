export type ApiErrorKind =
  | 'cancelled'
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'rate-limited'
  | 'network'
  | 'server'
  | 'invalid-response';
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    /** Seconds the server asked to wait before retrying, when it said. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
/** The server's own reason for a failure, when it sent one in place of the
 * generic text for that status. */
export function serverDetail(error: ApiError): string | undefined {
  const generic = error.status ? httpError(error.status).message : undefined;
  return error.message && error.message !== generic ? error.message : undefined;
}

export function httpError(status: number): ApiError {
  if (status === 401)
    return new ApiError(
      'unauthenticated',
      'Sign in again to access Knightly.',
      status,
    );
  if (status === 403)
    return new ApiError(
      'forbidden',
      'This account cannot access that resource.',
      status,
    );
  if (status === 429)
    return new ApiError(
      'rate-limited',
      'Too many requests. Wait before trying again.',
      status,
    );
  if (status >= 400 && status < 500)
    return new ApiError(
      'validation',
      'Knightly could not accept that request.',
      status,
    );
  return new ApiError('server', 'Knightly is unavailable. Try again.', status);
}
