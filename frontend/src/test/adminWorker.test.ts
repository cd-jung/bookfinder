// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS module without types
import worker, { verifyAccess } from '../../admin-worker.js';

const TEAM = 'team.cloudflareaccess.com';
const AUD = 'aud-tag';
let keys: CryptoKeyPair;
let jwk: JsonWebKey & { kid?: string };

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data as ArrayBuffer);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function token(claims: Record<string, unknown>, kid = 'k1') {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const payload = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

const env = (extra = {}) => ({
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  ADMIN_EMAILS: 'kookastudios@gmail.com',
  ADMIN_PROXY_SECRET: 'proxy-secret',
  ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
  API: { fetch: vi.fn(async (r: Request) => new Response(JSON.stringify({ proxy: r.headers.get('X-Admin-Proxy'), user: r.headers.get('X-Admin-User'), path: new URL(r.url).pathname }))) },
  ...extra,
});

const good = () => ({ aud: [AUD], iss: `https://${TEAM}`, email: 'KookaStudios@gmail.com', exp: Math.floor(Date.now() / 1000) + 600 });
const request = (jwt?: string, path = '/api/logs/stats') => new Request(`https://admin.example${path}`, { headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {} });

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' };
});

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ keys: [jwk] })));
});

describe('admin worker', () => {
  it('accepts a valid Access token for an allowed email', async () => {
    expect(await verifyAccess(request(await token(good())), env())).toBe('kookastudios@gmail.com');
  });

  it.each([
    ['wrong audience', { aud: ['other'] }],
    ['wrong issuer', { iss: 'https://evil.cloudflareaccess.com' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 10 }],
    ['email not allowed', { email: 'someone@example.com' }],
  ])('rejects a token with %s', async (_case, change) => {
    expect(await verifyAccess(request(await token({ ...good(), ...change })), env())).toBeNull();
  });

  it('rejects a tampered signature, unknown key, missing token and missing configuration', async () => {
    const valid = await token(good());
    const [h, , s] = valid.split('.');
    const forged = `${h}.${b64url(JSON.stringify({ ...good(), email: 'kookastudios@gmail.com', aud: [AUD], extra: 1 }))}.${s}`;
    expect(await verifyAccess(request(forged), env())).toBeNull();
    expect(await verifyAccess(request(await token(good(), 'other-kid')), env())).toBeNull();
    expect(await verifyAccess(request(), env())).toBeNull();
    expect(await verifyAccess(request(valid), env({ ACCESS_AUD: '' }))).toBeNull();
  });

  it('serves assets directly and proxies /api only for signed-in admins', async () => {
    const e = env();
    expect(await (await worker.fetch(new Request('https://admin.example/logs'), e)).text()).toBe('asset');
    expect((await worker.fetch(request(), e)).status).toBe(403);
    const proxied = await worker.fetch(request(await token(good())), e);
    expect(await proxied.json()).toEqual({ proxy: 'proxy-secret', user: 'kookastudios@gmail.com', path: '/api/logs/stats' });
    expect((await worker.fetch(request(await token(good())), env({ ADMIN_PROXY_SECRET: '' }))).status).toBe(503);
  });
});
