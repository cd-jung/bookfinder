import { API_BASE } from '../config';
import { currentLanguage } from '../i18n';

/** Error raised for non-2xx responses; `detail` is the backend message shown to the user. */
export class ApiError extends Error {
  status: number;
  code?: string;
  detail: string;
  body: unknown;

  constructor(status: number, body: Record<string, unknown> | null) {
    const detail =
      (typeof body?.detail === 'string' && body.detail) ||
      (body && Object.values(body).find((v): v is string => typeof v === 'string')) ||
      `Request failed (${status})`;
    super(detail);
    this.status = status;
    this.detail = detail;
    this.code = typeof body?.code === 'string' ? body.code : undefined;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error; // cancelled by the caller (Stop / timeout)
    throw new ApiError(0, { detail: 'The server could not be reached. Check your connection and try again.' });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

export function getJson<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const query = new URLSearchParams();
  Object.entries({ ...params, lang: currentLanguage() as string }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query}` : '';
  return request<T>(`${path}${suffix}`);
}

export function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body && typeof body === 'object' && !Array.isArray(body) ? { ...body, lang: currentLanguage() } : body),
    signal,
  });
}
