import { describe, expect, it, vi } from 'vitest';
import { ApiError, getJson, postJson } from './client';

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('api client', () => {
  it('builds query strings and skips empty params', async () => {
    const fetchMock = respond(200, { ok: true });
    await getJson('/api/x', { a: 1, b: '', c: undefined, d: 'two words' });
    expect(fetchMock).toHaveBeenCalledWith('/api/x?a=1&d=two+words', undefined);
  });

  it('posts JSON', async () => {
    const fetchMock = respond(200, { ok: true });
    await postJson('/api/y', { q: 1 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"q":1}' });
  });

  it('raises ApiError with the backend detail and code', async () => {
    respond(503, { code: 'llm_unavailable', detail: 'down' });
    await expect(getJson('/api/z')).rejects.toMatchObject({ status: 503, code: 'llm_unavailable', detail: 'down' });
  });

  it('uses the first string field when there is no detail', async () => {
    respond(400, { nl_filter: 'Field x is not allowed' });
    await expect(getJson('/api/z')).rejects.toMatchObject({ detail: 'Field x is not allowed' });
  });

  it('reports network failures as status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const error = await getJson('/api/z').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it('falls back to a generic message for non-JSON errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
    await expect(getJson('/api/z')).rejects.toMatchObject({ detail: 'Request failed (500)' });
  });
});
