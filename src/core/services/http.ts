/** Thin fetch helpers. Every call resolves (never throws) so screens can render an explicit state. */

export type HttpResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; offline: boolean };

export async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; adminPassword?: string; query?: Record<string, string> } = {}
): Promise<HttpResult<T>> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, status: 0, error: 'offline', offline: true };
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.adminPassword) headers['x-admin-password'] = opts.adminPassword;
  const qs = opts.query ? '?' + new URLSearchParams(opts.query).toString() : '';
  try {
    const res = await fetch(path + qs, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const json = isJson ? await res.json().catch(() => null) : null;
    if (res.ok && isJson) return { ok: true, status: res.status, data: json as T };
    // Not JSON (e.g. the dev server without the API): treat as unavailable.
    return { ok: false, status: res.status, error: json?.error ?? (isJson ? 'server_error' : 'unavailable'), offline: false };
  } catch {
    return { ok: false, status: 0, error: 'offline', offline: true };
  }
}
