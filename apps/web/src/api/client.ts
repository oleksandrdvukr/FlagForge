import { API_PREFIX } from '@flagforge/shared';

/** Error body from design §6.4. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: { path: (string | number)[]; message: string }[] = [],
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Same-origin JSON client (ADR-0007): the session travels in the HttpOnly cookie.
 * A 401 on any call other than login means the session is gone, so go to the login page.
 */
export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return data as T;

  const err = (data ?? {}) as { message?: string; details?: ApiError['details'] };
  if (res.status === 401 && path !== '/auth/login' && window.location.pathname !== '/login') {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  throw new ApiError(res.status, err.message ?? `Request failed (${res.status})`, err.details);
}

/** Evaluation uses an SDK key instead of the session (FR-33). */
export async function evaluateWithKey<T>(sdkKey: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_PREFIX}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Environment-Key': sdkKey },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return data as T;
  const err = (data ?? {}) as { message?: string; details?: ApiError['details'] };
  throw new ApiError(res.status, err.message ?? `Request failed (${res.status})`, err.details);
}
