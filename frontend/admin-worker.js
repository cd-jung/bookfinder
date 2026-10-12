// Admin site Worker: serves frontend/dist-admin (logs, monitoring, coverage) and proxies /api/* to the API
// Worker over a service binding. Cloudflare Access protects this whole hostname; this script verifies the
// Access JWT itself as well (defense in depth) and fails closed until Access is configured.
//
// vars:    ACCESS_TEAM_DOMAIN (e.g. "kookastudios.cloudflareaccess.com"), ACCESS_AUD (Access app audience tag),
//          ADMIN_EMAILS (comma-separated allow-list)
// secrets: ADMIN_PROXY_SECRET (shared with the API Worker)

const encoder = new TextEncoder();
let certCache = { at: 0, keys: [] };

function b64urlToBytes(input) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function accessKeys(teamDomain) {
  if (Date.now() - certCache.at < 10 * 60 * 1000 && certCache.keys.length) return certCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs: ${res.status}`);
  const { keys } = await res.json();
  certCache = { at: Date.now(), keys };
  return keys;
}

/** Return the verified email from the Cf-Access-Jwt-Assertion header, or null. */
export async function verifyAccess(request, env, now = Date.now()) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), encoder.encode(`${h}.${p}`));
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!valid || !audience.includes(env.ACCESS_AUD) || payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
  const email = String(payload.email || '').toLowerCase();
  const allowed = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((e) => e.trim()).filter(Boolean);
  return allowed.includes(email) ? email : null;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    let email = null;
    try {
      email = await verifyAccess(request, env);
    } catch (error) {
      console.error('access verification failed', String(error));
    }
    if (!email) return json(403, { detail: 'Sign-in required: this admin area is protected by Cloudflare Access.' });
    if (!env.ADMIN_PROXY_SECRET) return json(503, { detail: 'Admin proxy is not configured.' });
    const forwarded = new Request(`https://api.internal${url.pathname}${url.search}`, request);
    forwarded.headers.set('X-Admin-Proxy', env.ADMIN_PROXY_SECRET);
    forwarded.headers.set('X-Admin-User', email);
    forwarded.headers.delete('Cookie');
    return env.API.fetch(forwarded);
  },
};
