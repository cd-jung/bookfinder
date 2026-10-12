# Full-stack Cloudflare Template

A blank, working project that every new app starts from. It already has the full automation:
React + MUI frontend on Cloudflare Pages, Django API on Cloudflare Python Workers with D1, a Help
assistant (RAG over the User Guide), natural language log search with a monitoring dashboard,
unit + E2E tests driven by UX flows, a coverage page, and CI/CD that deploys every green push to `main`.

Korean version: [README.ko.md](README.ko.md). Working method for agents and developers: [AGENTS.md](AGENTS.md).

---

## 1. Start a new project (about 5 minutes)

```bash
~/Dev/fullstack-template/scripts/new-project.sh my-app "My App"
```

This creates the private GitHub repo `cd-jung/my-app` from this template, the Cloudflare D1 database,
Vectorize index and Pages project, writes `project.config.json`, sets the `CLOUDFLARE_API_TOKEN`
secret from the macOS Keychain, and pushes. The push runs CI/CD, which tests and deploys:

| What | URL |
|---|---|
| App | `https://my-app.pages.dev` |
| API | `https://my-app-api.kookastudios.workers.dev/api/health` |
| Coverage | `https://my-app.pages.dev/coverage/` |
| UX flows | `https://my-app.pages.dev/ux-flows/` |

Then open the new folder in Claude Code and build features with `/feature <description>`.
Add `--public` to make the GitHub repo public.

### 1-hour interview runbook

| Time | Step |
|---|---|
| 0-5 min | `new-project.sh`, open the folder in Claude Code, `gh run watch` the first deploy |
| 5-10 min | Agree the feature list with the interviewer; first feature's UX flow + scenarios |
| 10-50 min | One `/feature` per capability; `npm run verify` locally; push after each feature (CI deploys) |
| 50-60 min | Show the live app, `/coverage/`, the Logs dashboard and the Help assistant; walk through AGENTS.md |

---

## 2. One-time setup on a new Mac

Already done on this machine (2026-10-12). Repeat only on another computer.

1. Tools without admin rights, in `~/.local` (official releases, checksums verified):
   Node.js 24.21.0, GitHub CLI 2.102.0, uv 0.13.0, wrangler 4.149.0 (`npm install -g wrangler`).
   `~/.zshrc` has `export PATH="$HOME/.local/bin:$PATH"`. `jq` ships with macOS.
2. Sign in: `gh auth login` and `wrangler login` (browser approval on this Mac).
3. **Cloudflare API token** for GitHub Actions (CI cannot use your browser login):
   Cloudflare dashboard -> My Profile -> API Tokens -> Create Token -> Custom token, permissions:
   - Account: Workers Scripts **Edit**, D1 **Edit**, Vectorize **Edit**, Workers AI **Read**, Cloudflare Pages **Edit**, Account Settings **Read**
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
| Cloud | Cloudflare (Pages, Workers, D1, Vectorize, Workers AI) | - | One account, free tier, no servers, deploy in seconds |
| Frontend hosting | **Pages** | R2 bucket + domain | Pages gives SPA fallback, CDN, preview URLs and custom domains; R2 alone needs manual rules and uploads. R2 is for user files |
| Backend | **Django on Python Workers** (WSGI via `django-cf`) | FastAPI on Python Workers; Hono + Drizzle (TypeScript); Django in **Cloudflare Containers** | Django kept on purpose. Containers need Workers Paid ($5/month) and Docker. FastAPI has no D1 ORM. Hono + Drizzle is the fallback if CPU limits bite |
| Containers | **Not used** | Cloudflare Containers | Workers run in V8 isolates (Pyodide for Python), not containers |
| Plan | **Workers Free** | Workers Paid $5/month | User decision: stay free. See the CPU note below |

**CPU note (measured 2026-10-12):** a Django + D1 spike with 10,000 rows ran on the free plan
(~0.2-0.3 s per request, ~2 s cold start) but used **50-64 ms CPU per request**, above the free
plan's 10 ms limit. Cloudflare tolerated it at low traffic. If requests start failing with
"exceeded CPU", either upgrade to Workers Paid or move the API to Hono + Drizzle.

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

### UI

- **MUI** for every component; light and dark mode follow the OS.
- Left menu: **Home** (the project's main feature), **User Guide**, **Logs & Monitoring**, **Coverage**.
- Floating **Help** button opens the RAG assistant on every page.

### Method and automation

- Work in **feature units**; each feature updates code, unit tests, UX flow, E2E scenarios, E2E tests
  and the User Guide together ([AGENTS.md](AGENTS.md)).
- Enforcement: `AGENTS.md` (read by every agent), a Claude Code **Stop hook** running
  `scripts/check-consistency.mjs --hook`, the `/feature` skill, and the same check in CI with `--strict`.
- UX flows, scenario catalog and coverage report follow the `poc_samples` E2E PoC format.
- Documentation in English with Korean translations (`*.ko.md`).

### CI/CD

| Stage | Runs |
|---|---|
| verify (every push and PR) | lint -> unit tests with coverage -> consistency check `--strict` -> E2E (Playwright, LLM stub) -> build site |
| deploy (`main` only, after verify) | D1 migrations -> Worker deploy (`pywrangler deploy`) -> User Guide re-index (changed sections only) -> Pages deploy -> smoke test |

Pages is deployed from Actions (`wrangler pages deploy`) instead of the Pages Git integration, so
nothing deploys unless every check passed. The coverage page is rebuilt on every deploy.

### Repositories

- New projects live in `~/Dev/<name>`, GitHub repos are **private** by default.

---

## 4. Cost (Workers Free)

| Service | Free allowance | Template usage |
|---|---|---|
| Workers | 100,000 requests/day, 10 ms CPU/request | see CPU note |
| D1 | 5M rows read/day, 100k rows written/day, 5 GB | one log row per request |
| Vectorize | 30M queried dims/month, 5M stored dims | ~1,024 dims per guide section |
| Workers AI | 10,000 Neurons/day | bge-m3 ~1,075 Neurons per 1M tokens; Llama 70B ~48k output tokens/day |
| Pages | static hosting free | - |

Paid plan, if ever needed: $5/month (includes 10M requests, 30M CPU ms, 25B D1 reads, 50M Vectorize queried dims).

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
