#!/usr/bin/env node
/** Merge pytest-cov / JUnit and Vitest coverage / results into coverage/unit-summary.json for the report. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const C = path.join(ROOT, 'coverage');
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const suites = [];

const pyCov = read(path.join(C, 'backend/coverage.json'));
const junit = read(path.join(C, 'backend/junit.xml'));
if (pyCov) {
  const data = JSON.parse(pyCov);
  const attr = (name) => Number((junit?.match(new RegExp(`<testsuite[^>]*\\s${name}="(\\d+)"`)) || [])[1] || 0);
  const tests = attr('tests');
  const failed = attr('failures') + attr('errors');
  suites.push({
    name: 'Backend',
    tests,
    passed: tests - failed - attr('skipped'),
    failed,
    linesCovered: data.totals.covered_lines,
    linesTotal: data.totals.num_statements,
    files: Object.entries(data.files).map(([file, f]) => ({ path: `backend/${file}`, covered: f.summary.covered_lines, total: f.summary.num_statements })),
  });
}

const jsCov = read(path.join(C, 'frontend/coverage-summary.json'));
const jsResults = read(path.join(C, 'frontend/results.json'));
if (jsCov) {
  const data = JSON.parse(jsCov);
  const results = jsResults ? JSON.parse(jsResults) : { numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  suites.push({
    name: 'Frontend',
    tests: results.numTotalTests,
    passed: results.numPassedTests,
    failed: results.numFailedTests,
    linesCovered: data.total.lines.covered,
    linesTotal: data.total.lines.total,
    files: Object.entries(data)
      .filter(([k]) => k !== 'total')
      .map(([file, f]) => ({ path: path.relative(ROOT, file), covered: f.lines.covered, total: f.lines.total })),
  });
}

fs.mkdirSync(C, { recursive: true });
fs.writeFileSync(path.join(C, 'unit-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), suites }, null, 2));
console.log(`unit summary: ${suites.map((s) => `${s.name} ${s.passed}/${s.tests} tests, ${s.linesCovered}/${s.linesTotal} lines`).join('; ')}`);
