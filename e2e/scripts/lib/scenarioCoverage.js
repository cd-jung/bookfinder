// @ts-check
/**
 * Shared scenario-coverage computation.
 * Reads scenarios/catalog.json and scans tests/ for `[ID]` tags, then returns a
 * structured coverage model used by both the CLI report and the HTML report.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATALOG = path.join(ROOT, 'scenarios', 'catalog.json');
const TESTS_DIR = path.join(ROOT, 'tests');

function readAllSpecText(dir) {
  let text = '';
  if (!fs.existsSync(dir)) return text;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) text += readAllSpecText(full);
    else if (entry.name.endsWith('.spec.js')) text += '\n' + fs.readFileSync(full, 'utf8');
  }
  return text;
}

function pct(n, d) {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function computeCoverage() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const specText = readAllSpecText(TESTS_DIR);

  const totals = { total: 0, covered: 0, coreTotal: 0, coreCovered: 0 };
  const uncoveredCore = [];

  const journeys = catalog.journeys.map((j) => {
    let jTotal = 0;
    let jCovered = 0;
    const scenarios = j.scenarios.map((s) => {
      const covered = specText.includes(`[${s.id}]`);
      jTotal += 1;
      totals.total += 1;
      if (covered) {
        jCovered += 1;
        totals.covered += 1;
      }
      if (s.priority === 'core') {
        totals.coreTotal += 1;
        if (covered) totals.coreCovered += 1;
        else uncoveredCore.push(s);
      }
      return { ...s, covered };
    });
    return { id: j.id, name: j.name, scenarios, total: jTotal, covered: jCovered, pct: pct(jCovered, jTotal) };
  });

  return {
    priorityRules: catalog._priority_rules || {},
    journeys,
    totals,
    uncoveredCore,
    overallPct: pct(totals.covered, totals.total),
    corePct: pct(totals.coreCovered, totals.coreTotal)
  };
}

module.exports = { computeCoverage, pct };
