---
name: feature
description: Build, change or remove one feature end to end following AGENTS.md (code, unit tests, UX flow, E2E scenarios and tests, User Guide). Use when the user asks to add, change or remove a feature or screen.
---

Follow AGENTS.md exactly. For the feature described in the arguments:

1. Restate the feature in one or two sentences and list the user-visible behaviour (screens, states, errors).
   If a decision belongs to the user (cost, scope, data, security), ask before writing code.
2. UX flow first: create, edit or delete `ux-flows/NN-<feature>.md` (Mermaid flowchart with the
   classDef conventions, `%% link` and `%% guide` directives). Run `npm run flows`.
3. Scenarios: update the journey in `e2e/scenarios/catalog.json` (ids, priority + rule, nodes).
   Delete scenarios of removed behaviour.
4. Implement backend and frontend in small steps. Models changed -> `npm run migrations`.
5. Unit tests next to each change; delete tests for removed code.
6. E2E tests in `e2e/tests/<feature>.spec.js`, one test per scenario, title starting with `[ID]`.
7. User Guide: update `docs/user-guide/NN-<topic>.md` so it matches the UI labels exactly.
8. Run `npm run verify`. Fix until it passes. Commit as `feat(<feature>): <summary>`.
9. Report: what changed, scenario coverage (`npm run coverage`), anything left for the user to decide.
