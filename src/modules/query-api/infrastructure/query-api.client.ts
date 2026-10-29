import { getGovernanceObjectId, getQueryApiUrl, getQueryApiVersion } from '@/config/runtime';
import { fail, ok, type Result } from '@/shared/domain/result';
import { safeFetch } from '@/shared/infrastructure/http/safe-fetch';
import type { z } from 'zod';

export type QueryApiError =
  | 'network'
  | 'http'
  | 'parse'
  | 'validation';

export type QueryApiContext = {
  locale?: string;
  viewer?: string | null;
  governanceObjectId?: string | null;
  authorization?: string | null;
};

let globalContext: QueryApiContext = {
  governanceObjectId: getGovernanceObjectId(),
};

export function setQueryApiContext(ctx: QueryApiContext): void {
  globalContext = { ...globalContext, ...ctx };
}

export function getQueryApiContext(): QueryApiContext {
  return globalContext;
}

function buildBaseUrl(): string {
  const base = getQueryApiUrl().replace(/\/$/, '');
  const version = getQueryApiVersion();
  return `${base}/query/v${version}`;
}

function buildHeaders(ctx: QueryApiContext, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const locale = ctx.locale ?? 'en-US';
  headers.set('Accept-Language', locale);
  headers.set('X-Locale', locale);
  if (ctx.viewer) {
    headers.set('X-Viewer', ctx.viewer);
  }
  if (ctx.governanceObjectId) {
    headers.set('X-Governance-Object-Id', ctx.governanceObjectId);
  }
  if (ctx.authorization) {
    headers.set('Authorization', ctx.authorization);
  }
  return headers;
}

export type QueryApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  context?: QueryApiContext;
  signal?: AbortSignal;
};

function appendQuery(path: string, query?: QueryApiFetchOptions['query']): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function queryApiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options: QueryApiFetchOptions = {},
): Promise<Result<T, QueryApiError>> {
  const ctx = { ...globalContext, ...options.context };
  const url = `${buildBaseUrl()}${appendQuery(path, options.query)}`;
  const method = options.method ?? 'GET';

  const init: RequestInit = {
    method,
    headers: buildHeaders(ctx),
    signal: options.signal,
  };

  if (options.body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(options.body);
  }

  const fetched = await safeFetch(url, init);
  if (!fetched.ok) {
    return fail('network');
  }

  const { response } = fetched;
  if (!response.ok) {
    return fail('http');
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return fail('parse');
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail('validation');
  }

  return ok(parsed.data);
}
