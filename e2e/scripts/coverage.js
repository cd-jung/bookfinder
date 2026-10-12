// @ts-check
/**
 * E2E scenario coverage checker (CLI).
 *
 * Prints overall %, core-only %, and a per-journey breakdown, then lists the
 * uncovered CORE scenarios so you know what to build next.
 *
 * Usage:  npm run coverage         (soft: never fails the process)
 *         node scripts/coverage.js (strict: non-zero exit if a core gap exists)
 */
const { computeCoverage } = require('./lib/scenarioCoverage');

const SOFT = process.argv.includes('--soft');
const { journeys, totals, uncoveredCore, overallPct, corePct } = computeCoverage();

function bar(p) {
  const filled = Math.round(p / 5);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
}

console.log('\nE2E Scenario Coverage');
console.log('='.repeat(60));
for (const j of journeys) {
  console.log(`${j.name.padEnd(26)} ${bar(j.pct)} ${String(j.pct).padStart(5)}%  (${j.covered}/${j.total})`);
}
console.log('-'.repeat(60));
console.log(`${'OVERALL'.padEnd(26)} ${bar(overallPct)} ${String(overallPct).padStart(5)}%  (${totals.covered}/${totals.total})`);
console.log(`${'CORE'.padEnd(26)} ${bar(corePct)} ${String(corePct).padStart(5)}%  (${totals.coreCovered}/${totals.coreTotal})`);

if (uncoveredCore.length) {
  console.log('\nUncovered CORE scenarios (build these next):');
  for (const s of uncoveredCore) {
    console.log(`  - [${s.id}] ${s.title}${s.ticket ? `  (${s.ticket})` : ''}`);
  }
}
console.log('');

if (!SOFT && uncoveredCore.length) {
  process.exitCode = 1;
}
