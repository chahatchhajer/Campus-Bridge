import { supabase } from './supabase';

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export type FieldIssue = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: FieldIssue[],
  ) {
    super(message);
  }
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  form?: FormData;
  signal?: AbortSignal;
};

export const resolveUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${API_BASE}${path}`);

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<{ data: T; meta?: any }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${API_BASE}/api${path}${qs.size ? `?${qs}` : ''}`;
  const headers: Record<string, string> = {};
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return { data: undefined as T };
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `Request failed (${res.status}).`, e?.details);
  }
  return json;
}

/** Map server field errors onto react-hook-form fields. */
export function fieldErrors(err: unknown): FieldIssue[] {
  return err instanceof ApiError && err.details ? err.details : [];
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
