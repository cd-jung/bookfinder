# BookFinder - Decisions, setup and operations

> Moved from README.md. The project overview is in [README.md](../../README.md); the working method for agents is [AGENTS.md](../../AGENTS.md).

## BookFinder (this project)

Built from this template on 2026-10-12, following `poc_samples.zip` (UX flows, E2E catalog, NL search guide, RAG PoC).

| | |
|---|---|
| App | https://bookfinder.kookastudios.workers.dev |
| API | https://bookfinder-api.kookastudios.workers.dev/api/health |
| Coverage | https://bookfinder.kookastudios.workers.dev/coverage |
| Data | 10,000 generated books (`backend/src/books/seed.py`, deterministic; a few real titles as anchors, all prices/stock fictional) |
| Tests | 114 E2E scenarios (43 core, 100% covered), backend + frontend unit tests |

Project decisions on top of the template:

| Topic | Decision | Why |
|---|---|---|
| Chatbot | The spec's "Ask the librarian" became the **Help** assistant: RAG over the User Guide only, short answer + links | User decision: the chatbot explains how to use the service; book data stays out of Vectorize |
| Removed scenarios | `DET-007` (ask about this book), `CHAT-008` (book context chip), `CHAT-010` (recommended books), `GRD-004` (stale prices), `SAFE-003` (instructions in book descriptions) | They only make sense for a catalogue chatbot |
| Changed scenarios | `CHAT-002` no token streaming (answer appears whole; `CHAT-006` Stop cancels the request), `CHAT-007` follow-up = previous question added to retrieval, `GRD-005` Korean answers checked on the deployed site (`@real`) | Python Workers + Workers AI answer in one response; the stub cannot translate |
| Data model | One wide `Book` table; authors / genres / formats as `\|a\|b\|` token text instead of join tables | Designed for the D1 free plan's 100k rows written/day (seeding uses about 51k); kept on Paid because it is fast and simple |
| Read budget | Each search reads up to ~20k D1 rows (one pass for total + facet counts, one for the page) | About 1.25M searches/month within the Paid plan's 25B rows read |
| NL guard rails | No Postgres read-only transaction / statement timeout on D1; queries are ORM `filter()` only, the filter is validated twice, and a slow response shows "Search took too long" | D1 has no `SET LOCAL` |
| Rate limits | 10 questions/minute per client on `/api/nl-search/translate` and `/api/rag/answers` (429 with Retry-After), counted in `RequestLog` | Shared across Worker isolates without another service; off in local E2E (`RATE_LIMITS=0`) |
| Seeding | CD step `scripts/seed_d1.sh` loads the books once, only while `books_book` is empty | Avoids repeated writes |
| Languages | English, Spanish, French and Korean for menus, pages, User Guide, Help, NL descriptions, genre / format / language names and generated book descriptions; **Display language** select top right (saved per device, browser language first) | User request (2026-10-12). Titles, author names and developer reports stay untranslated |
| Help per language | Each language's User Guide is indexed separately (`<lang>/<page>#n`); retrieval keeps the UI language and the prompt names the answer language | Links open the guide in the language the user reads |

## Cost safeguards and security

### Cost safeguards

| Safeguard | Where | Limit |
|---|---|---|
| Cloudflare DDoS protection | Edge (automatic) | volumetric floods never reach the Workers |
| Static assets | Frontend Worker | free and unmetered; no code runs |
| Edge rate limit per IP | `API_LIMITER` / `AI_LIMITER` bindings | 120 API requests and 10 AI requests per minute; rejected before any D1 read or write |
| Per-client AI limit | `core/ratelimit.py` (D1) | 10 questions per minute per endpoint, shared across isolates |
| Daily AI budget | `core/llm.py`, `AiUsage` | `AI_DAILY_LIMIT` = 500 real AI calls per UTC day (worst case about $0.45/day above the free Neurons); then "try again tomorrow" |
| CPU cap | `limits.cpu_ms` | 5,000 ms per request |
| Body size | Django `DATA_UPLOAD_MAX_MEMORY_SIZE` | 64 KB |
| Token caps | `core/llm.py` | at most 500-600 output tokens per call |
| Log retention | `RequestLogMiddleware._prune` | logs older than 14 days are deleted |
| Seed once | `scripts/seed_d1.sh` | the 10,000-book seed runs only while the table is empty |

### Security

- No accounts and no personal data: logs keep a salted hash of the client IP, never the IP; the salt is the
  `DJANGO_SECRET_KEY` Worker secret (random, set by CD, never in the repository).
- LLM output and URL filters are untrusted: allow-listed fields, bound parameters, depth / size limits, SELECT-only.
- Prompts wrap user text in markers; the Help assistant answers only from the User Guide and adds links itself.
- Markdown is rendered without HTML; the static site sends CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` and HSTS; the API sends `nosniff`, `Referrer-Policy` and `X-Frame-Options: DENY`.
- CORS allows only the frontend origin and its preview URLs; `ALLOWED_HOSTS` is the API host.
- Deploys need `CLOUDFLARE_API_TOKEN` (GitHub secret, scoped token); pull requests from forks get no secrets and never deploy.

**Recommended account settings (manual, in the Cloudflare and GitHub dashboards):**

1. Cloudflare → Notifications → add a **Usage Based Billing** alert (for example at $10) so a cost spike is noticed early.
2. Keep **Cloudflare Access** on the `bookfinder-admin` Worker (workers.dev and preview URLs) with the email policy
   above; add or remove administrators in the Access policy and in `project.config.json` `admin.emails`.
3. GitHub → Settings → Code security: turn on **Secret scanning**, **Push protection** and **Dependabot alerts**
   (the repositories are public).
4. Rotate `CLOUDFLARE_API_TOKEN` if it is ever exposed: create a new token, update the Keychain item and
   `gh secret set CLOUDFLARE_API_TOKEN`, then delete the old token.

---

## 1. Start a new project (about 5 minutes)

```bash
~/Dev/fullstack-template/scripts/new-project.sh my-app "My App"
```

This creates the private GitHub repo `cd-jung/my-app` from this template, the Cloudflare D1 database
and Vectorize index, writes `project.config.json`, sets the `CLOUDFLARE_API_TOKEN`
secret from the macOS Keychain, and pushes. The push runs CI/CD, which tests and deploys:

| What | URL |
|---|---|
| App | `https://my-app.kookastudios.workers.dev` |
| API | `https://my-app-api.kookastudios.workers.dev/api/health` |
| Coverage | `https://my-app.kookastudios.workers.dev/coverage` |
| UX flows | `https://my-app.kookastudios.workers.dev/ux-flows/` |

Then open the new folder in Claude Code and build features with `/feature <description>`.
Add `--public` to make the GitHub repo public.

### 1-hour interview runbook

| Time | Step |
|---|---|
| 0-5 min | `new-project.sh`, open the folder in Claude Code, `gh run watch` the first deploy |
| 5-10 min | Agree the feature list with the interviewer; first feature's UX flow + scenarios |
| 10-50 min | One `/feature` per capability; `npm run verify` locally; push after each feature (CI deploys) |
| 50-60 min | Show the live app, `/coverage`, the Logs dashboard and the Help assistant; walk through AGENTS.md |

---

## 2. One-time setup on a new Mac

Already done on this machine (2026-10-12). Repeat only on another computer.

1. Tools without admin rights, in `~/.local` (official releases, checksums verified):
   Node.js 24.21.0, GitHub CLI 2.102.0, uv 0.13.0, wrangler 4.149.0 (`npm install -g wrangler`).
   `~/.zshrc` has `export PATH="$HOME/.local/bin:$PATH"`. `jq` ships with macOS.
2. Sign in: `gh auth login` and `wrangler login` (browser approval on this Mac).
3. **Cloudflare API token** for GitHub Actions (CI cannot use your browser login):
   Cloudflare dashboard -> My Profile -> API Tokens -> Create Token -> Custom token, permissions:
   - Account: Workers Scripts **Edit**, D1 **Edit**, Vectorize **Edit**, Workers AI **Read**, Account Settings **Read**
   - User: User Details **Read**, Memberships **Read**

   Store it once in the Keychain (you type the token; it is never shown or written to a file):
   ```bash
   security add-generic-password -a "$USER" -s cloudflare-api-token -w
   ```
4. This template must be a GitHub template repository (`gh repo edit cd-jung/fullstack-template --template`).

---

## 3. Decisions (and why)

Recorded from the planning session on 2026-10-12. Change them only on purpose; AGENTS.md section 1
tells agents to ask before changing any of these.

### Hosting and runtime

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Cloud | Cloudflare (Workers, Static Assets, D1, Vectorize, Workers AI) | - | One account, free tier, no servers, deploy in seconds |
| Frontend hosting | **Workers Static Assets** (own Worker, `frontend/wrangler.jsonc`) | R2 bucket + domain; legacy Pages | Planned as Pages; on 2026-10-12 wrangler 4.149 redirected Pages to "the latest version of Cloudflare Pages, now part of Cloudflare Workers", so the user chose Static Assets. SPA fallback, CDN, free unlimited static requests; R2 alone needs manual rules. R2 is for user files |
| Backend | **Django on Python Workers** (WSGI via `django-cf`) | FastAPI on Python Workers; Hono + Drizzle (TypeScript); Django in **Cloudflare Containers** | Django kept on purpose. Containers need Workers Paid ($5/month) and Docker. FastAPI has no D1 ORM. Hono + Drizzle is the fallback if CPU limits bite |
| Containers | **Not used** | Cloudflare Containers | Workers run in V8 isolates (Pyodide for Python), not containers |
| Plan | **Workers Paid** ($5/month) | Workers Free | Started on Free (user decision); on 2026-10-12 the API hit Cloudflare error 1102 (CPU limit) under normal use, so the user upgraded. Paid allows 30 s CPU per request (up to 5 min) and includes 30M CPU ms/month |

**CPU note (measured 2026-10-12):** Django on Python Workers uses **50-64 ms CPU per request** (~2 s cold
start). The free plan allows 10 ms: it worked at first, then Cloudflare started rejecting requests with
error 1102, so this template now assumes **Workers Paid**. To run on Free, move the API to Hono + Drizzle.

### Data

| Decision | Chosen | Why |
|---|---|---|
| Database | **D1** through the Django ORM (`django_cf.db.backends.d1`) | Official Cloudflare path for Django; free 5 GB |
| Limits accepted | no transactions; SQLite dialect | Fine for this scope |
| Not chosen | Durable Objects SQLite (more complex), Hyperdrive + Postgres (Django's `psycopg` unverified on Pyodide) | Risk in a timed build |
| Migrations | Django migrations exported to `backend/d1_migrations/*.sql`, applied by `wrangler d1 migrations apply` in CD | D1 has no shell to run `manage.py migrate` |
| Service data | Lives in D1 only (for example 10,000 records) | Service data is **not** put in the vector DB |

### AI features

| Decision | Chosen | Why |
|---|---|---|
| LLM | Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, temperature 0 | No API keys; free 10,000 Neurons/day |
| Embeddings | Workers AI `@cf/baai/bge-m3` (1,024 dims, multilingual) | Korean and English questions |
| Vector DB | **Vectorize** | Native binding; free 5M stored dimensions (about 4,800 chunks) |
| RAG corpus | **User Guide only** (`docs/user-guide/*.md`) | The assistant explains how to use the service, nothing else |
| RAG answer | Short summary + links to the exact guide section | Users read the full section in the User Guide menu |
| Natural language search | LLM -> JSON filter -> validated against an allow-list catalogue -> Django ORM | Ported from the `poc_samples` NL search design: no text-to-SQL, values bound, validated twice |
| D1 deviations from the PoC | No `SET LOCAL transaction_read_only` / `statement_timeout` (Postgres only) | NL queries are read-only by construction (ORM `filter()` only); D1 limits query time |
| Test modes | `LLM_MODE` = `real` / `stub` / `down` | CI and E2E are deterministic and need no AI calls |

### Logs and monitoring

- Every API request is written to **Cloudflare Workers Logs** (dashboard: Workers -> the API worker ->
  Observability, or `npx wrangler tail` in `backend/`) and to the D1 `RequestLog` table.
- The **Logs & Monitoring** page reads the table: dashboard (requests, 5xx error rate, p95 latency,
  4xx count, requests per hour) and log search in plain language (same NL -> ORM engine) or by keyword.

### Admin site (logs, monitoring, coverage)

- The public site (`bookfinder`) serves Book Search and the User Guide. **Logs & Monitoring**, **Coverage** and
  the UX flows are on a separate admin Worker (`bookfinder-admin`, `frontend/admin-worker.js`), built into
  `frontend/dist-admin` by `scripts/build-site.sh`. On the public site those menu entries link to the admin site.
- **Cloudflare Access** (Zero Trust Free, team `jolly-smoke-0c81`) protects the whole admin Worker: policy
  *Include → Emails* = `project.config.json` `admin.emails` (now `kookastudios@gmail.com`), One-time PIN login.
- Defence in depth: the admin Worker also verifies the Access JWT (`Cf-Access-Jwt-Assertion`, RS256, `aud`,
  `iss`, expiry, email allow-list) and forwards `/api/*` over a service binding with `X-Admin-Proxy`.
  The API answers `/api/logs*` only with that shared secret (`ADMIN_PROXY_SECRET`, set by CD on both Workers);
  without it, it fails closed with 403. Until `admin.accessAud` is filled in, the admin API also answers 403.
- **Resource headroom**: the dashboard shows each limit as % used with green (<60%), amber (60–85%) and red
  (≥85%) plus an icon and label. App metrics come from D1 (p95 vs 1 s, 5xx budget 1%, daily AI budget,
  429 share, vector storage). Cloudflare metrics come from the GraphQL Analytics API with a read-only
  `CF_ANALYTICS_TOKEN` Worker secret (CPU p99 vs `limits.cpu_ms`, requests, D1 storage and rows this month),
  cached for 5 minutes. Cloudflare's own dashboard shows these numbers too, but as raw values, not % of limits.

### UI

- **MUI** for every component; light and dark mode follow the OS.
- Left menu: **Home** (the project's main feature), **User Guide**, **Logs & Monitoring**, **Coverage**.
- Floating **Help** button opens the RAG assistant on every page.

### Method and automation

- Work in **feature units**; each feature updates code, unit tests, UX flow, E2E scenarios, E2E tests
  and the User Guide together ([AGENTS.md](../../AGENTS.md)).
- Enforcement: `AGENTS.md` (read by every agent), a Claude Code **Stop hook** running
  `scripts/check-consistency.mjs --hook`, the `/feature` skill, and the same check in CI with `--strict`.
- UX flows, scenario catalog and coverage report follow the `poc_samples` E2E PoC format.
- Documentation in English with Korean translations (`*.ko.md`).

### CI/CD

| Stage | Runs |
|---|---|
| verify (every push and PR) | lint -> unit tests with coverage -> consistency check `--strict` -> E2E (Playwright, LLM stub) -> build site |
| deploy (`main` only, after verify) | D1 migrations -> Worker deploy (`pywrangler deploy`) -> User Guide re-index (changed sections only) -> frontend deploy (`wrangler deploy --config frontend/wrangler.jsonc`) -> smoke test |

Everything deploys from Actions instead of the Cloudflare Git integration, so nothing deploys
unless every check passed. The coverage page is rebuilt on every deploy.

### Repositories

- New projects live in `~/Dev/<name>`, GitHub repos are **private** by default.

---

## 4. Cost (Workers Paid, $5/month)

| Service | Free allowance | Template usage |
|---|---|---|
| Workers | Paid: 10M requests and 30M CPU ms/month included, 30 s CPU/request | ~60 ms CPU per Django request: about 500k requests/month |
| D1 | 5M rows read/day, 100k rows written/day, 5 GB | one log row per request |
| Vectorize | 30M queried dims/month, 5M stored dims | ~1,024 dims per guide section |
| Workers AI | 10,000 Neurons/day | bge-m3 ~1,075 Neurons per 1M tokens; Llama 70B ~48k output tokens/day |
| Static Assets | static requests free and unlimited | - |

The table's other rows show the free allowances; on Paid they rise to 25B D1 rows read and 50M written per month, 50M Vectorize queried and 10M stored dimensions.

---

## 5. Local development

```bash
npm run setup      # once
npm run dev        # http://localhost:5173 (API on :8000, SQLite, LLM stub)
npm run verify     # what CI runs
```

`LLM_MODE=real` only works on Cloudflare (Workers AI and Vectorize bindings); locally the stub answers
from the catalogue examples and a keyword search over the User Guide.

## 6. Known limits

- Python Workers cold start is about 2-3 s; the first request after idle is slow.
- CPU per request is above the free limit (see section 3).
- E2E runs against the local stack, not against the deployed site; the deploy job runs a smoke test.
- The Help assistant has no conversation memory on the server: each question is answered on its own.
- On Workers the clock only advances during I/O (a Cloudflare security measure), so `duration_ms` in the
  logs measures time spent waiting on D1 / AI calls; pure CPU work shows as 0 ms.
