import type { VercelRequest, VercelResponse } from '@vercel/node';

export type { VercelRequest, VercelResponse };

/** An expected failure that maps straight to an HTTP status and a stable error code. */
export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly extra: Record<string, unknown> = {}) {
    super(code);
  }
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

/**
 * Wraps an endpoint: no-store caching, JSON result, and uniform error handling.
 * A handler returns the JSON body (or sends the response itself and returns undefined).
 */
export function endpoint(fn: Handler) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const out = await fn(req, res);
      if (!res.writableEnded && out !== undefined) res.status(200).json(out);
    } catch (err: any) {
      if (res.writableEnded) return;
      if (err instanceof HttpError) return res.status(err.status).json({ ...err.extra, error: err.code });
      console.error(`${req.method} ${req.url} failed`, err);
      return res.status(500).json({ error: 'server_error' });
    }
  };
}

/** Throws 405 unless the request method is one of `allowed`. */
export function allow(req: VercelRequest, res: VercelResponse, ...allowed: string[]) {
  if (!allowed.includes(req.method ?? '')) {
    res.setHeader('Allow', allowed.join(', '));
    throw new HttpError(405, 'method_not_allowed');
  }
}

export const queryString = (req: VercelRequest, key: string): string | null => {
  const v = req.query[key];
  return typeof v === 'string' && v ? v : null;
};
