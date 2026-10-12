#!/usr/bin/env node
/**
 * Consistency check for the methodology in CLAUDE.md. Runs in CI and as a Claude Code Stop hook.
 *
 * Errors (exit 1):
 *  - catalog scenario ids are unique; every scenario sits on an existing ux-flows node
 *  - every [ID] tag in e2e/tests exists in the catalog (no orphan tests)
 *  - every journey's flow file exists; every ux-flow (01+) has a journey and a `%% guide <page>.md`
 *    directive pointing to an existing docs/user-guide page
 *  - every User Guide page starts with a "# " title
 *  - ux-flows/scenarios.js is in sync with the .md files
 *  - every backend app has tests/test_<app>*.py; every frontend feature folder has a *.test.tsx
 *  - D1 migrations are exported for every Django migration (--with-backend, needs uv)
 * Warnings: uncovered core scenarios (errors with --strict).
 *
 * --hook: Claude Code Stop hook mode. Also compares the working tree with HEAD: source changes
 * without test changes, or UI changes without any ux-flows / e2e / user guide change, block the
 * stop once (exit 2) so the agent updates them or explains why no update is needed.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = new Set(process.argv.slice(2));
const errors = [];
const warnings = [];
const rel = (p) => path.relative(ROOT, p);

function readHookInput() {
  if (!args.has('--hook')) return {};
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

const hookInput = readHookInput();
if (hookInput.stop_hook_active) process.exit(0); // already blocked once in this stop: let it finish

// ---- E2E catalog <-> UX flows <-> tests -------------------------------------------------------
const { computeCoverage } = require(path.join(ROOT, 'e2e/scripts/lib/scenarioCoverage.js'));
const { loadFlows } = require(path.join(ROOT, 'e2e/scripts/lib/uxFlows.js'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'e2e/scenarios/catalog.json'), 'utf8'));
const coverage = computeCoverage();
const scenarios = coverage.journeys.flatMap((j) => j.scenarios);

const seen = new Set();
for (const s of scenarios) {
  if (seen.has(s.id)) errors.push(`duplicate scenario id ${s.id} in e2e/scenarios/catalog.json`);
  seen.add(s.id);
}

const flows = loadFlows(scenarios);
flows.unknownIds.forEach((u) => errors.push(`catalog node reference not found: ${u}`));
flows.unmapped.forEach((s) => errors.push(`scenario [${s.id}] is not placed on any ux-flows node`));

const flowDir = path.join(ROOT, 'ux-flows');
const flowFiles = fs.readdirSync(flowDir).filter((f) => /^\d\d-.+\.md$/.test(f));
const journeyFlows = new Set(catalog.journeys.map((j) => j.flow));
for (const j of catalog.journeys) {
  if (!flowFiles.includes(j.flow)) errors.push(`journey ${j.id}: flow ux-flows/${j.flow} does not exist`);
}
const guideDir = path.join(ROOT, 'docs/user-guide');
const guidePages = fs.existsSync(guideDir) ? fs.readdirSync(guideDir).filter((f) => f.endsWith('.md')) : [];
for (const file of flowFiles.filter((f) => !f.startsWith('00-'))) {
  const text = fs.readFileSync(path.join(flowDir, file), 'utf8');
  if (!journeyFlows.has(file)) errors.push(`ux-flows/${file} has no journey in e2e/scenarios/catalog.json`);
  const guides = [...text.matchAll(/%%\s*guide\s+(\S+\.md)/g)].map((m) => m[1]);
  if (!guides.length) errors.push(`ux-flows/${file} has no "%% guide <page>.md" directive`);
  guides.filter((g) => !guidePages.includes(g)).forEach((g) => errors.push(`ux-flows/${file}: guide page docs/user-guide/${g} does not exist`));
}
for (const page of guidePages) {
  const text = fs.readFileSync(path.join(guideDir, page), 'utf8');
  if (!/^# \S/.test(text)) errors.push(`docs/user-guide/${page} must start with a "# Title" line`);
}

const testsDir = path.join(ROOT, 'e2e/tests');
const specText = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.spec.js'))
  .map((f) => fs.readFileSync(path.join(testsDir, f), 'utf8'))
  .join('\n');
for (const m of specText.matchAll(/test(?:\.\w+)?\(\s*['"`]\[([A-Z0-9]+-\d+)\]/g)) {
  if (!seen.has(m[1])) errors.push(`e2e test tag [${m[1]}] is not in the catalog (remove the test or add the scenario)`);
}

// scenarios.js must match the .md files (the viewer reads it when opened from disk)
const bundle = path.join(flowDir, 'scenarios.js');
const expected = JSON.stringify(
  fs.readdirSync(flowDir).filter((f) => f.endsWith('.md')).sort().map((name) => ({ name, text: fs.readFileSync(path.join(flowDir, name), 'utf8') })),
);
try {
  const actual = fs.readFileSync(bundle, 'utf8').replace(/^[^\n]*\n/, '').replace(/^window\.UX_FLOW_SCENARIOS = /, '').replace(/;\s*$/, '');
  if (JSON.stringify(JSON.parse(actual)) !== expected) errors.push('ux-flows/scenarios.js is stale: run python3 ux-flows/build.py');
} catch {
  errors.push('ux-flows/scenarios.js missing or invalid: run python3 ux-flows/build.py');
}

// ---- unit test presence ------------------------------------------------------------------------
const backendSrc = path.join(ROOT, 'backend/src');
const backendTests = fs.readdirSync(path.join(ROOT, 'backend/tests'));
for (const app of fs.readdirSync(backendSrc)) {
  if (app === 'config' || !fs.existsSync(path.join(backendSrc, app, '__init__.py'))) continue;
  const aliases = { core: ['core', 'health', 'middleware', 'llm'], nlsearch: ['nlsearch'] }[app] || [app];
  if (!backendTests.some((t) => aliases.some((a) => t.startsWith(`test_${a}`)))) {
    errors.push(`backend app "${app}" has no backend/tests/test_${app}*.py`);
  }
}
const frontendSrc = path.join(ROOT, 'frontend/src');
for (const dir of fs.readdirSync(frontendSrc, { withFileTypes: true })) {
  if (!dir.isDirectory() || ['test', 'pages'].includes(dir.name)) continue;
  const files = fs.readdirSync(path.join(frontendSrc, dir.name));
  if (files.some((f) => /\.tsx?$/.test(f) && !f.includes('.test.')) && !files.some((f) => /\.test\.tsx?$/.test(f))) {
    errors.push(`frontend/src/${dir.name} has no *.test.ts(x)`);
  }
}

if (args.has('--with-backend')) {
  try {
    execSync('uv run python scripts/export_d1_migrations.py --check', { cwd: path.join(ROOT, 'backend'), stdio: 'pipe' });
  } catch (e) {
    errors.push(`D1 migrations out of date:\n${e.stdout}`);
  }
}

coverage.uncoveredCore.forEach((s) => (args.has('--strict') ? errors : warnings).push(`core scenario [${s.id}] has no E2E test`));

// ---- hook: working tree vs HEAD -----------------------------------------------------------------
if (args.has('--hook')) {
  let changed = [];
  try {
    changed = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).replace(/^.* -> /, ''));
  } catch {
    /* not a git repo */
  }
  const isTest = (f) => /(^backend\/tests\/|\.test\.tsx?$|^e2e\/tests\/)/.test(f);
  const backendSrcChanged = changed.filter((f) => f.startsWith('backend/src/') && f.endsWith('.py') && !f.includes('/migrations/'));
  const frontendSrcChanged = changed.filter((f) => f.startsWith('frontend/src/') && /\.tsx?$/.test(f) && !isTest(f));
  if (backendSrcChanged.length && !changed.some((f) => f.startsWith('backend/tests/'))) {
    errors.push(`backend source changed without any backend/tests change: ${backendSrcChanged.join(', ')}`);
  }
  if (frontendSrcChanged.length && !changed.some((f) => /^frontend\/src\/.*\.test\.tsx?$/.test(f))) {
    errors.push(`frontend source changed without any *.test.tsx change: ${frontendSrcChanged.join(', ')}`);
  }
  const touchedSpec = changed.some((f) => /^(ux-flows\/|e2e\/|docs\/user-guide\/)/.test(f));
  if ((frontendSrcChanged.length || backendSrcChanged.some((f) => /views|urls/.test(f))) && !touchedSpec) {
    errors.push(
      'user-facing code changed but ux-flows/, e2e/ and docs/user-guide/ are untouched. Update the UX flow, ' +
        'catalog scenarios, E2E tests and User Guide, or state in your reply why no update is needed.',
    );
  }
  if (changed.some((f) => f.includes('/migrations/')) && !changed.some((f) => f.startsWith('backend/d1_migrations/'))) {
    errors.push('Django migrations changed: run (cd backend && uv run python scripts/export_d1_migrations.py)');
  }
}

warnings.forEach((w) => console.log(`WARN  ${w}`));
if (errors.length) {
  const text = `Consistency check failed (see CLAUDE.md "Definition of done"):\n${errors.map((e) => `- ${e}`).join('\n')}`;
  if (args.has('--hook')) {
    console.error(text);
    process.exit(2);
  }
  console.log(text);
  process.exit(1);
}
console.log(`Consistency check passed: ${scenarios.length} scenarios, ${flowFiles.length} flows, ${guidePages.length} guide pages.`);
