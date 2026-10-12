# AGENTS.md - How to work in this repository

This file is the working method for every AI agent and developer on this project. Claude Code loads it
through `CLAUDE.md`; other tools (Codex, Cursor, Copilot, Kiro) read `AGENTS.md` directly.
The Korean translation is `AGENTS.ko.md`. Architecture and the reasons behind each decision are in `README.md`.

## 1. Stack (fixed; do not change without asking the user)

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite, **MUI** for every UI component, react-router, served by **Cloudflare Pages** |
| Backend | **Django** (WSGI) on **Cloudflare Python Workers** (Pyodide), via `django-cf` |
| Database | **Cloudflare D1** (SQLite) through the Django ORM; no transactions |
| RAG | User Guide Markdown -> **Workers AI** embeddings (`@cf/baai/bge-m3`) -> **Vectorize**; text in D1 |
| LLM | **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), only through `backend/src/core/llm.py` |
| Logs | Every API request -> Workers Logs (stdout) and the `RequestLog` table |
| Tests | pytest + pytest-django, Vitest + Testing Library, Playwright (UX-flow scenarios) |
| CI/CD | GitHub Actions: verify on every push / PR, deploy on `main` |
| Plan | Cloudflare **Workers Free**; keep per-request CPU low (few Django apps, no heavy imports) |

## 2. Repository map

```
AGENTS.md / AGENTS.ko.md     this method (English / Korean)
README.md / README.ko.md     decisions, setup, new-project and interview runbook
project.config.json          names and ids; apply with `node scripts/apply-config.mjs`
backend/                     Django on Python Workers
  src/config/                settings (DJANGO_ENV = workers | local | test), urls
  src/core/                  llm.py (only LLM entry point), middleware (CORS, request logs), health
  src/nlsearch/              natural language -> JSON filter -> ORM (Catalog, compiler, translate)
  src/logs/                  RequestLog model, log catalogue, list / stats / translate API
  src/rag/                   User Guide chunking, retrieval, answers
  tests/                     pytest, one file per module or feature: test_<app>_*.py
  d1_migrations/             generated from Django migrations, never edited by hand
  scripts/                   export_d1_migrations.py, index_guide.py (CD)
frontend/src/                one folder per feature (chat/, logs/, guide/, ...), tests next to code
docs/user-guide/             NN-<topic>.md: the User Guide page AND the RAG corpus
ux-flows/                    NN-<feature>.md Mermaid flowcharts + viewer (index.html, build.py)
e2e/                         scenarios/catalog.json, tests/*.spec.js, coverage report scripts
scripts/                     check-consistency, new-project, build-site, dev, unit-summary
.github/workflows/ci.yml     CI/CD
```

## 3. Work in feature units

A **feature** is one user-visible capability (a page, a panel, a search, an API used by the UI).
Work on one feature at a time. Every feature change, including deletion, updates **all six artefacts
together in the same commit**:

| # | Artefact | Location | Create / change / delete when |
|---|---|---|---|
| 1 | UX flow | `ux-flows/NN-<feature>.md` | screens, states, errors or navigation change |
| 2 | E2E scenarios | journey in `e2e/scenarios/catalog.json` | any flow node is added, changed or removed |
| 3 | E2E tests | `e2e/tests/<feature>.spec.js` | any scenario is added, changed or removed |
| 4 | Unit tests | `backend/tests/`, `frontend/src/**/*.test.tsx` | any code is added, changed or removed |
| 5 | User Guide | `docs/user-guide/NN-<topic>.md` | anything the user sees or does changes |
| 6 | Code | `backend/src/`, `frontend/src/` | - |

Order of work: **flow -> scenarios -> code + unit tests -> E2E tests -> User Guide -> verify -> commit**.
Commit message: `feat(<feature>): ...`, `fix(<feature>): ...`, `refactor(<feature>): ...`.

### Definition of done (checked by `npm run verify` and the Stop hook)

- [ ] `npm run lint` passes (ruff, oxlint, tsc).
- [ ] `npm run test:unit` passes. New or changed code has unit tests; tests of removed code are deleted.
- [ ] `npm run check` passes: every scenario sits on an existing flow node, no orphan E2E tags, every
      flow has a journey and a `%% guide` page, `ux-flows/scenarios.js` rebuilt, D1 migrations exported.
- [ ] Every **core** scenario has an E2E test (`npm run coverage`; CI runs the check with `--strict`).
- [ ] `npm run test:e2e` passes.
- [ ] The User Guide uses the exact UI labels (button text, tab names, messages).

## 4. Artefact rules

### 4.1 UX flows (`ux-flows/`)

- One file per feature: `NN-<feature>.md`, `# N. Title`, a one-paragraph description, one ```` ```mermaid ```` `flowchart TD` block.
- Node ids are short camelCase words (`panel`, `noContext`); scenarios reference them as `"NN:nodeId"`,
  so **renaming a node means updating the catalog**.
- Classes: `screen` (visible UI), `hidden` (error / edge state), `link` (jumps to another flow), `internal` (server step).
  Copy the four `classDef` lines from an existing flow.
- Directives (Mermaid comments): `%% link <nodeId> <file.md>` makes a node open another flow;
  `%% guide <page>.md` names the User Guide page that documents the flow (required).
- `00-overview.md` links every flow. After editing run `npm run flows` (rebuilds `scenarios.js`).

### 4.2 E2E scenarios (`e2e/scenarios/catalog.json`)

- One journey per flow: `{"id", "name", "flow": "NN-<feature>.md", "scenarios": [...]}`.
- Scenario: `id` (`PREFIX-NNN`, prefix per feature, never reused), `priority` (`core` / `secondary`),
  `rule` (from `_priority_rules`: core C1-C5 wins over secondary S1-S5), `account` (test context),
  `group`, `title` (observable behaviour), `nodes` (one or more `"NN:nodeId"`).
- Removing behaviour removes its scenarios and their tests.

### 4.3 E2E tests (`e2e/tests/`)

- `<feature>.spec.js`, one `test()` per scenario, title starts with the id: `test('[HELP-002] ...')`.
  The tag is how the coverage report links tests to scenarios.
- Select by role and accessible name first, then `data-testid`. No CSS selectors or text-position logic.
- The local stack runs with `LLM_MODE=stub` (deterministic). `llm_down` / `api_down` contexts use
  `page.route()` interception (`tests/helpers.js`). Mobile-only tests carry `@mobile` in the title.
- Wait for the response that changes the UI (`page.waitForResponse`) instead of sleeping.

### 4.4 Unit tests

- Backend: `backend/tests/test_<app>_<topic>.py`, pytest-django, in-memory SQLite, `LLM_MODE=stub`.
  Every API endpoint: success, validation (400), domain errors (422), LLM down (502/503).
  Mock `core.llm.generate / embed / vector_query` to test the `real` code paths.
- Frontend: `<Component>.test.tsx` next to the component; inject API functions as props (see
  `LogsPage`, `HelpChat`) instead of mocking modules. Use `test/render.tsx` (`renderAt`).
- Delete or rewrite tests when behaviour is removed or changed. Never skip a failing test to go green.

### 4.5 User Guide (`docs/user-guide/`)

- `NN-<topic>.md`, starts with `# Title`; `##` sections become link anchors for the Help assistant
  (slug rule shared by `rag/chunking.py` and `guide/slug.ts`).
- Written for end users: what to click, what they see, what errors mean. No implementation details.
- These files are both the **User Guide menu** and the **RAG corpus**; CD re-indexes changed sections.

## 5. Code conventions

### Backend

- Keep `INSTALLED_APPS` minimal (each app costs Worker start-up and CPU). No admin, auth or sessions
  unless the user decides to add them.
- All LLM / embedding / vector calls go through `core.llm` (`generate`, `embed`, `vector_query`) so the
  `stub` / `down` / `real` modes work everywhere. Never import `workers` or `js` outside `core/`.
- D1: no transactions (`atomic` does nothing), SQLite dialect, avoid huge `IN` lists; paginate lists.
- Models changed -> `npm run migrations` (Django migration + `d1_migrations/*.sql`). Never edit the SQL by hand.
- Errors to the client as `{"detail": "..."}` (plus `"code"` for LLM errors). Views stay thin.
- Format with `ruff format`; lint with `ruff check`.

### Natural language search (non-negotiable)

1. The LLM returns a **JSON filter**, never SQL. Define a `nlsearch.Catalog` per searchable model
   (fields with ORM paths, templates, examples); prompt, compiler and stub all read it.
2. LLM output and `nl_filter` from the URL are untrusted: validate on **every** request that uses them.
3. Field names and ORM paths come only from the catalogue; values are bound parameters.
4. The prompt contains the catalogue and the question only (in `<<<QUESTION` markers). No rows, no secrets.
5. Examples in the catalogue double as LLM few-shots and stub fixtures: add one per new capability.

### RAG (Help assistant)

- Answers only from User Guide sections above `RAG_MINIMUM_SIMILARITY`; nothing found -> fixed answer,
  **no LLM call**. Sources (links) come from retrieval results, never from the model text.
- The answer is a short summary plus links to `/guide/<page>#<section>`.

### Frontend

- MUI components only (no other UI kits, no raw CSS files). MUI v9: layout props go in `sx`
  (`<Stack sx={{ alignItems: 'center' }}>`), not as component props.
- One folder per feature in `src/`; API calls in `<feature>/api.ts` through `api/client.ts`.
- Accessible names on every control (the E2E tests depend on them); `data-testid` for repeated items.
- New page: route in `App.tsx`, menu entry in `layout/navItems.ts`, flow, scenarios, guide page.

## 6. Commands

| Command | What it does |
|---|---|
| `npm run setup` | install everything (uv, npm, Playwright) |
| `npm run dev` | Django :8000 (SQLite, LLM stub) + Vite :5173 |
| `npm run lint` | ruff + oxlint + tsc |
| `npm run test:unit` | pytest + Vitest with coverage -> `coverage/unit-summary.json` |
| `npm run test:e2e` | Playwright against the local stack |
| `npm run check` | consistency check (add `-- --strict` to fail on uncovered core scenarios) |
| `npm run coverage` | E2E scenario coverage in the terminal |
| `npm run build:site` | app + `/coverage/` report + `/ux-flows/` viewer into `frontend/dist` |
| `npm run migrations` | Django migrations + D1 SQL export |
| `npm run verify` | everything CI runs before deploy |

## 7. Decisions and communication

- Decisions that belong to the user: anything that costs money (paid plans, new services), changes the
  stack in section 1, deletes data, changes security or what data is stored. Ask before acting.
- Everything else (naming, structure, test design): decide, follow this file, and mention it in the summary.
- Report results honestly: failing tests, skipped steps and known gaps go in the summary.
