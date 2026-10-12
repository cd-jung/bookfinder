// @ts-check
/**
 * Generates a self-contained HTML coverage report (no external CDNs — charts
 * are inline SVG so it opens offline).
 *
 * Output: coverage-report.html
 * Usage:  npm run report:coverage   (then open the file in a browser)
 */
const fs = require('fs');
const path = require('path');
const { computeCoverage, pct } = require('./lib/scenarioCoverage');
const { loadFlows } = require('./lib/uxFlows');

const OUT = process.env.COVERAGE_REPORT_OUT || path.resolve(__dirname, '..', 'coverage-report.html');
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const projectConfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'project.config.json'), 'utf8'));
const APP_NAME = projectConfig.displayName || projectConfig.name;
const unitSummary = (() => {
  const file = path.join(ROOT_DIR, 'coverage', 'unit-summary.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
})();
const data = computeCoverage();
const flowsData = loadFlows(data.journeys.flatMap((j) => j.scenarios));
const useFlows = Boolean(flowsData && flowsData.mermaidJs);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** JSON safe to embed inside a <script> element. */
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

/** Prevent the HTML parser from treating `<!--` in inlined JS as markup. */
const scriptSafe = (js) => js.replace(/<!--/g, '<\\!--').replace(/<\/script/gi, '<\\/script');

/** Inline SVG donut showing a single percentage. */
function donut(pctValue, label, color) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const filled = (pctValue / 100) * c;
  return `
  <div class="donut">
    <svg viewBox="0 0 140 140" width="150" height="150">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#2a2f3a" stroke-width="14"/>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="14"
              stroke-linecap="round" stroke-dasharray="${filled.toFixed(1)} ${(c - filled).toFixed(1)}"
              transform="rotate(-90 70 70)"/>
      <text x="70" y="66" text-anchor="middle" class="donut-pct">${pctValue}%</text>
      <text x="70" y="90" text-anchor="middle" class="donut-sub">${esc(label)}</text>
    </svg>
  </div>`;
}

/** Human-readable label for a priority rule id (C1, S2, ...) from the catalog. */
const ruleLabel = (ruleId) => {
  const rules = data.priorityRules || {};
  const text = (rules.core && rules.core[ruleId]) || (rules.secondary && rules.secondary[ruleId]) || '';
  const short = text.split(' - ')[0];
  return ruleId ? `${ruleId}${short ? ` · ${short}` : ''}` : 'Other';
};

/**
 * Sub-categories of a journey: the scenario's `group` field when present,
 * otherwise its priority rule. Keeps the catalog order of first appearance.
 */
function journeyGroups(journey) {
  const groups = new Map();
  journey.scenarios.forEach((s) => {
    const name = s.group || ruleLabel(s.rule);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(s);
  });
  return [...groups.entries()].map(([name, scenarios]) => ({
    name,
    scenarios,
    total: scenarios.length,
    covered: scenarios.filter((s) => s.covered).length
  }));
}

/**
 * Unit test panel: line coverage and test counts per suite, read from coverage/unit-summary.json
 * (written by scripts/unit-summary.mjs from pytest-cov and Vitest output).
 */
function unitPanel() {
  if (!unitSummary) {
    return `<div class="panel"><h2>Unit tests</h2><p class="muted">No unit summary yet. Run <code>npm run test:unit</code> at the repo root.</p></div>`;
  }
  const rows = unitSummary.suites
    .map(
      (u) => `<tr><td>${esc(u.name)}</td><td>${u.tests}</td><td>${u.passed}</td><td>${u.failed}</td>
        <td>${miniBar('all', u.linesCovered, u.linesTotal)}</td></tr>
        ${(u.files || [])
          .map(
            (f) => `<tr class="unit-file"><td class="mono">${esc(f.path)}</td><td></td><td></td><td></td><td>${miniBar('core', f.covered, f.total)}</td></tr>`
          )
          .join('')}`
    )
    .join('');
  return `<div class="panel">
      <h2>Unit tests</h2>
      <div class="kpis">
        ${unitSummary.suites.map((u) => donut(pct(u.linesCovered, u.linesTotal), u.name + ' lines', '#d29922')).join('')}
      </div>
      <details class="unit-details"><summary>Per-file line coverage</summary>
      <table class="flow-table"><tr><th>Suite / file</th><th>Tests</th><th>Passed</th><th>Failed</th><th>Line coverage</th></tr>${rows}</table>
      </details>
    </div>`;
}

/** Small "pct (covered/total)" bar used in collapsible headers. */
function miniBar(kind, covered, total) {
  const value = pct(covered, total);
  return `<span class="mini">
      <span class="bar-track mini-track" role="img" aria-label="${value}% (${covered} of ${total})"><span class="bar-fill ${kind}" style="width:${value}%"></span></span>
      <span class="bar-val">${value}% <span class="muted">(${covered}/${total})</span></span>
    </span>`;
}

/** One row per scenario: green when a test exists, dark grey when not implemented. */
function scenarioItem(s) {
  const state = s.covered ? 'impl' : 'todo';
  const mark = s.covered ? '✓' : '○';
  const star = s.priority === 'core' ? '<span class="star" title="core">★</span>' : '';
  const blocked = s._blocked ? `<span class="tag blocked" title="${esc(s._blocked)}">blocked</span>` : '';
  const finding = s._finding ? `<span class="tag finding" title="${esc(s._finding)}">finding</span>` : '';
  return `<li class="sc ${state}">
          <span class="sc-mark" aria-hidden="true">${mark}</span>
          <code class="sc-id">${esc(s.id)}</code>${star}
          <span class="sc-title">${esc(s.title)}</span>${blocked}${finding}
          <span class="sc-state">${s.covered ? 'implemented' : 'not implemented'}</span>
        </li>`;
}

/**
 * Collapsible coverage tree: journey (All / Core bars) > sub-category (%) > scenarios.
 * Uses native <details>/<summary> so it is keyboard accessible without extra JS.
 */
function journeyBars() {
  const bar = (kind, label, covered, total) => {
    if (!total) {
      return `
        <div class="bar-kind ${kind}">${label}</div>
        <div class="bar-track empty"></div>
        <div class="bar-val muted">no ${label.toLowerCase()} scenarios</div>`;
    }
    const value = pct(covered, total);
    return `
        <div class="bar-kind ${kind}">${label}</div>
        <div class="bar-track" role="img" aria-label="${label} ${value}% (${covered} of ${total})"><div class="bar-fill ${kind}" style="width:${value}%"></div></div>
        <div class="bar-val">${value}% <span class="muted">(${covered}/${total})</span></div>`;
  };
  return `
      <div class="bar-legend legend">
        <span><span class="sw" style="background:var(--blue)"></span>All scenarios</span>
        <span><span class="sw" style="background:var(--green)"></span>Core only</span>
        <span><span class="sw" style="background:var(--green)"></span>✓ test implemented</span>
        <span><span class="sw" style="background:var(--todo)"></span>○ not implemented</span>
        <span>Click a journey, then a sub-category, to expand</span>
      </div>
      ${data.journeys
        .map((j) => {
          const core = j.scenarios.filter((s) => s.priority === 'core');
          const coreCovered = core.filter((s) => s.covered).length;
          const groups = journeyGroups(j)
            .map(
              (g) => `
        <details class="sub">
          <summary><span class="sub-name">${esc(g.name)}</span>${miniBar('all', g.covered, g.total)}</summary>
          <ul class="sc-list">${g.scenarios.map(scenarioItem).join('')}</ul>
        </details>`
            )
            .join('');
          return `
      <details class="jr">
        <summary class="bar-group">
          <div class="bar-label">${esc(j.name)}</div>
          <div class="bar-rows">
            ${bar('all', 'All', j.covered, j.total)}
            ${bar('core', 'Core', coreCovered, core.length)}
          </div>
        </summary>
        <div class="subs">${groups}</div>
      </details>`;
        })
        .join('')}`;
}

/** Journey "graph": scenario nodes connected left-to-right per journey (fallback when no UX flows). */
function scenarioGraph() {
  return data.journeys
    .map((j) => {
      const nodes = j.scenarios
        .map((s, i) => {
          const cls = ['node', s.covered ? 'covered' : 'uncovered', s.priority].join(' ');
          const star = s.priority === 'core' ? '<span class="star">★</span>' : '';
          const tick = s.covered ? '✓' : '○';
          const arrow = i < j.scenarios.length - 1 ? '<div class="arrow">→</div>' : '';
          return `
          <div class="${cls}" title="${esc(s.title)}">
            <div class="node-id">${tick} ${esc(s.id)} ${star}</div>
            <div class="node-title">${esc(s.title)}</div>
            ${s.ticket ? `<div class="node-ticket">${esc(s.ticket)}</div>` : ''}
          </div>${arrow}`;
        })
        .join('');
      return `
      <div class="journey">
        <div class="journey-head">
          <span class="journey-name">${esc(j.name)}</span>
          <span class="journey-pct">${j.pct}%</span>
        </div>
        <div class="journey-flow">${nodes}</div>
      </div>`;
    })
    .join('');
}

/** Scenario graph built from the UX flow Mermaid flowcharts, coloured by coverage. */
function flowGraph() {
  const tabs = flowsData.flows
    .map((f, i) => {
      const badge = f.total ? `<span class="tab-badge">${f.covered}/${f.total}</span>` : '';
      return `<button type="button" class="flow-tab" role="tab" data-idx="${i}" aria-selected="false">${esc(f.title)}${badge}</button>`;
    })
    .join('');
  const warnings = [
    ...flowsData.unknownIds.map((u) => `Invalid node reference in catalog.json: ${u}`),
    ...flowsData.unmapped.map((s) => `Catalog scenario not placed on any flow node: [${s.id}] ${s.title}`)
  ];
  return `
      <div class="legend">
        <span><span class="sw sw-line" style="border-color:#2e7d32"></span>all mapped scenarios covered</span>
        <span><span class="sw sw-line" style="border-color:#1e88e5"></span>partially covered</span>
        <span><span class="sw sw-line sw-dash" style="border-color:#d29922"></span>mapped, not covered</span>
        <span>no outline = no E2E scenario mapped · click green "scenario N" boxes to jump</span>
      </div>
      <div class="flow-tabs" role="tablist">${tabs}</div>
      <div class="flow-canvas" id="flowCanvas"></div>
      <div id="flowError" class="flow-error"></div>
      <div id="flowNodes"></div>
      ${
        warnings.length
          ? `<details class="flow-warn"><summary>${warnings.length} mapping warning(s)</summary><ul>${warnings
              .map((w) => `<li>${esc(w)}</li>`)
              .join('')}</ul></details>`
          : ''
      }
      <div class="muted flow-src">Source: ${esc(path.relative(ROOT_DIR, flowsData.dir))}/</div>`;
}

/** Client-side script: renders the selected flow with the inlined Mermaid library. */
function flowScript() {
  const flows = flowsData.flows.map((f) => ({
    name: f.name,
    title: f.title,
    code: f.renderCode,
    links: f.links,
    nodes: f.nodes
  }));
  return `
<script>${scriptSafe(flowsData.mermaidJs)}</script>
<script>
(function () {
  'use strict';
  var FLOWS = ${jsonForScript(flows)};
  var seq = 0;
  var current = -1;
  var canvas = document.getElementById('flowCanvas');
  var errorBox = document.getElementById('flowError');
  var nodesBox = document.getElementById('flowNodes');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.flow-tab'));

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' }
  });

  function nodeIdOf(g) {
    var m = (g.getAttribute('id') || '').match(/flowchart-(.+)-\\d+$/);
    return g.getAttribute('data-id') || (m && m[1]);
  }

  function indexOfFile(file) {
    for (var i = 0; i < FLOWS.length; i += 1) if (FLOWS[i].name === file) return i;
    return -1;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderNodeTable(flow) {
    nodesBox.replaceChildren();
    if (!flow.nodes.length) {
      nodesBox.appendChild(el('p', 'muted', 'No E2E scenarios mapped to this flow.'));
      return;
    }
    var table = el('table', 'flow-table');
    var head = el('tr');
    ['Flow node', 'Scenario', 'Priority', 'Status'].forEach(function (h) { head.appendChild(el('th', '', h)); });
    table.appendChild(head);
    flow.nodes.forEach(function (n) {
      n.scenarios.forEach(function (s, k) {
        var tr = el('tr');
        tr.appendChild(el('td', 'mono', k === 0 ? n.nodeId : ''));
        tr.appendChild(el('td', '', '[' + s.id + '] ' + s.title + (s.ticket ? ' (' + s.ticket + ')' : '')));
        tr.appendChild(el('td', '', s.priority === 'core' ? '\\u2605 core' : 'secondary'));
        tr.appendChild(el('td', s.covered ? 'ok' : 'pending', s.covered ? '\\u2713 covered' : '\\u25CB pending'));
        table.appendChild(tr);
      });
    });
    nodesBox.appendChild(table);
  }

  function decorate(svg, flow) {
    var e2eByNode = {};
    flow.nodes.forEach(function (n) { e2eByNode[n.nodeId] = n; });
    Array.prototype.forEach.call(svg.querySelectorAll('g.node'), function (g) {
      var id = nodeIdOf(g);
      if (!id) return;
      var tips = [];
      var n = e2eByNode[id];
      if (n) {
        n.scenarios.forEach(function (s) {
          tips.push((s.covered ? '\\u2713 ' : '\\u25CB ') + s.id + ' - ' + s.title);
        });
      }
      var target = flow.links[id] ? indexOfFile(flow.links[id]) : -1;
      if (target >= 0) {
        tips.push('Click to open: ' + FLOWS[target].title);
        g.style.cursor = 'pointer';
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'link');
        g.setAttribute('aria-label', 'Open ' + FLOWS[target].title);
        g.addEventListener('click', function () { show(target); });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(target); }
        });
      }
      if (tips.length) {
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        t.textContent = tips.join('\\n');
        g.insertBefore(t, g.firstChild);
      }
    });
  }

  function show(i) {
    var flow = FLOWS[i];
    if (!flow) return;
    current = i;
    tabs.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); });
    if (history.replaceState) history.replaceState(null, '', '#' + encodeURIComponent(flow.name));
    errorBox.textContent = '';
    renderNodeTable(flow);
    var mySeq = ++seq;
    window.mermaid.render('flow-svg-' + mySeq, flow.code).then(function (res) {
      if (mySeq !== seq) return;
      // Mermaid output is sanitised (securityLevel: strict)
      canvas.innerHTML = res.svg;
      var svg = canvas.querySelector('svg');
      if (svg) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', flow.title);
        decorate(svg, flow);
      }
    }).catch(function (e) {
      if (mySeq !== seq) return;
      canvas.replaceChildren();
      errorBox.textContent = 'Mermaid error: ' + (e && e.message ? e.message : e);
      var junk = document.getElementById('dflow-svg-' + mySeq);
      if (junk) junk.remove();
    });
  }

  tabs.forEach(function (t, k) { t.addEventListener('click', function () { show(k); }); });
  var fromHash = indexOfFile(decodeURIComponent(location.hash.slice(1)));
  show(fromHash >= 0 ? fromHash : 0);
})();
</script>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="generator" content="coverage-report"/>
<title>${esc(APP_NAME)} Coverage</title>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e;
          --green:#3fb950; --blue:#58a6ff; --amber:#d29922; --todo:#484f58; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:1400px; margin:0 auto; padding:28px 20px 60px; }
  h1 { font-size:22px; margin:0 0 4px; }
  .ts { color:var(--muted); font-size:13px; margin-bottom:24px; }
  .panel { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:20px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:0 0 16px; }
  .kpis { display:flex; flex-wrap:wrap; gap:24px; align-items:center; }
  .donut { text-align:center; }
  .donut-pct { fill:var(--text); font-size:28px; font-weight:700; }
  .donut-sub { fill:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
  .stat-cards { display:flex; gap:16px; flex-wrap:wrap; margin-left:auto; }
  .stat { background:#0d1117; border:1px solid var(--border); border-radius:10px; padding:14px 18px; min-width:120px; }
  .stat .n { font-size:26px; font-weight:700; }
  .stat .l { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
  .bar-group { display:grid; grid-template-columns:220px 1fr; gap:12px; align-items:center;
               padding:8px 0; border-bottom:1px solid var(--border); }
  .bar-group:last-child { border-bottom:none; }
  .bar-rows { display:grid; grid-template-columns:44px 1fr 150px; align-items:center; gap:6px 12px; }
  .bar-label { font-size:13px; }
  .bar-kind { font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
  .bar-kind.all { color:var(--blue); }
  .bar-kind.core { color:var(--green); }
  .bar-track { background:#0d1117; border:1px solid var(--border); border-radius:999px; height:12px; overflow:hidden; }
  .bar-track.empty { border-style:dashed; }
  .bar-fill { height:100%; border-radius:999px; transition:width .3s; }
  .bar-fill.all { background:var(--blue); }
  .bar-fill.core { background:var(--green); }
  .bar-val { font-size:13px; text-align:right; }
  .muted { color:var(--muted); }
  .jr { border-bottom:1px solid var(--border); }
  .jr:last-child { border-bottom:none; }
  .jr > summary { list-style:none; cursor:pointer; border-bottom:none; }
  .jr > summary::-webkit-details-marker, .sub > summary::-webkit-details-marker { display:none; }
  .jr > summary .bar-label::before, .sub > summary::before { content:'▸'; display:inline-block; width:14px; color:var(--muted); transition:transform .15s; }
  .jr[open] > summary .bar-label::before, .sub[open] > summary::before { transform:rotate(90deg); }
  .jr > summary:focus-visible, .sub > summary:focus-visible { outline:2px solid var(--blue); outline-offset:2px; border-radius:6px; }
  .subs { padding:0 0 10px 24px; }
  .sub > summary { list-style:none; cursor:pointer; display:grid; grid-template-columns:14px 1fr 260px; align-items:center;
                   gap:8px; padding:6px 0; font-size:13px; }
  .sub > summary:hover .sub-name, .jr > summary:hover .bar-label { color:var(--blue); }
  .mini { display:grid; grid-template-columns:1fr 110px; gap:10px; align-items:center; }
  .mini-track { display:block; height:8px; }
  .mini-track .bar-fill { display:block; }
  .sc-list { list-style:none; margin:4px 0 10px 22px; padding:0; }
  .sc { display:flex; align-items:baseline; gap:8px; padding:5px 10px; margin:3px 0; border-radius:6px; font-size:12px;
        border-left:4px solid; }
  .sc.impl { background:rgba(63,185,80,.14); border-left-color:var(--green); color:var(--green); }
  .sc.todo { background:#21262d; border-left-color:var(--todo); color:#9ea7b3; }
  .sc .sc-title { flex:1; color:inherit; }
  .sc .sc-id { font-family:ui-monospace,Menlo,monospace; white-space:nowrap; }
  .sc .sc-state { font-size:11px; white-space:nowrap; opacity:.85; }
  .tag { font-size:10px; text-transform:uppercase; letter-spacing:.04em; border:1px solid; border-radius:4px; padding:0 4px; cursor:help; }
  .tag.blocked { color:#f85149; border-color:#f85149; }
  .tag.finding { color:var(--amber); border-color:var(--amber); }
  .legend { display:flex; gap:18px; flex-wrap:wrap; font-size:12px; color:var(--muted); margin-bottom:16px; }
  .legend .sw { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
  .journey { margin-bottom:18px; }
  .journey-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
  .journey-name { font-weight:600; }
  .journey-pct { color:var(--muted); font-size:13px; }
  .journey-flow { display:flex; align-items:stretch; flex-wrap:wrap; gap:6px; }
  .node { background:#0d1117; border:1px solid var(--border); border-radius:10px; padding:10px 12px; width:190px; }
  .node.covered { border-color:var(--green); box-shadow:inset 0 0 0 1px rgba(63,185,80,.25); }
  .node.uncovered { opacity:.75; }
  .node.core { border-left-width:4px; }
  .node.core.covered { border-left-color:var(--green); }
  .node.core.uncovered { border-left-color:var(--amber); }
  .node-id { font-family:ui-monospace,Menlo,monospace; font-size:12px; margin-bottom:4px; }
  .node.covered .node-id { color:var(--green); }
  .node-title { font-size:12px; color:var(--text); line-height:1.3; }
  .node-ticket { font-size:11px; color:var(--blue); margin-top:4px; }
  .star { color:var(--amber); }
  .arrow { display:flex; align-items:center; color:var(--muted); padding:0 2px; }
  .sw-line { background:transparent; border:3px solid; }
  .sw-dash { border-style:dashed; }
  .flow-tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
  .flow-tab { font:inherit; font-size:12px; color:var(--text); background:#0d1117; border:1px solid var(--border);
              border-radius:8px; padding:6px 10px; cursor:pointer; }
  .flow-tab:hover { border-color:var(--blue); }
  .flow-tab:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
  .flow-tab[aria-selected="true"] { border-color:var(--blue); background:#1f2a3a; }
  .tab-badge { margin-left:6px; font-size:11px; color:var(--muted); }
  .flow-canvas { background:#ffffff; border-radius:10px; padding:16px; overflow:auto; min-height:120px; }
  .flow-canvas svg { max-width:100%; height:auto; }
  .flow-canvas g.node[role="link"]:focus { outline:3px solid #1e88e5; }
  .flow-error { color:#f85149; font-size:13px; white-space:pre-wrap; margin-top:8px; }
  .flow-table { width:100%; border-collapse:collapse; margin-top:14px; font-size:12px; }
  .flow-table th, .flow-table td { border-bottom:1px solid var(--border); padding:6px 8px; text-align:left; vertical-align:top; }
  .flow-table th { color:var(--muted); font-weight:600; }
  .flow-table .mono { font-family:ui-monospace,Menlo,monospace; }
  .flow-table .ok { color:var(--green); white-space:nowrap; }
  .flow-table .pending { color:var(--amber); white-space:nowrap; }
  .flow-warn { margin-top:12px; font-size:12px; color:var(--amber); }
  .flow-src { font-size:11px; margin-top:10px; }
  .unit-details summary { cursor:pointer; color:var(--muted); font-size:13px; margin-top:12px; }
  .unit-file td { color:var(--muted); }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${esc(APP_NAME)} Coverage</h1>
    <div class="ts">Generated ${new Date().toISOString()} · ${data.totals.total} scenarios in ${data.journeys.length} journeys</div>

    <div class="panel">
      <div class="kpis">
        ${donut(data.overallPct, 'Overall', '#58a6ff')}
        ${donut(data.corePct, 'Core', '#3fb950')}
        <div class="stat-cards">
          <div class="stat"><div class="n">${data.totals.covered}/${data.totals.total}</div><div class="l">Implemented</div></div>
          <div class="stat"><div class="n">${data.totals.coreCovered}/${data.totals.coreTotal}</div><div class="l">Core done</div></div>
          <div class="stat"><div class="n">${data.journeys.length}</div><div class="l">Journeys</div></div>
          <div class="stat"><div class="n">${data.uncoveredCore.length}</div><div class="l">Core gaps</div></div>
        </div>
      </div>
    </div>

    ${unitPanel()}

    <div class="panel">
      <h2>E2E coverage by journey</h2>
      ${journeyBars()}
    </div>

    <div class="panel">
      <h2>Scenario graph</h2>
      ${
        useFlows
          ? flowGraph()
          : `<div class="legend">
        <span><span class="sw" style="background:var(--green)"></span>covered</span>
        <span><span class="sw" style="background:#484f58"></span>not yet</span>
        <span><span class="star">★</span> core (left border)</span>
        <span>✓ implemented · ○ pending</span>
      </div>
      ${scenarioGraph()}`
      }
    </div>

    ${
      data.uncoveredCore.length
        ? `<div class="panel">
      <h2>Uncovered core — build next</h2>
      <ul>${data.uncoveredCore
        .map((s) => `<li><code>[${esc(s.id)}]</code> ${esc(s.title)}${s.ticket ? ` <span class="muted">(${esc(s.ticket)})</span>` : ''}</li>`)
        .join('')}</ul>
    </div>`
        : ''
    }
  </div>
${useFlows ? flowScript() : ''}
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT}`);
if (!useFlows) {
  console.log(
    flowsData
      ? `UX flows found but mermaid.min.js missing in ${flowsData.dir}; used the journey graph instead.`
      : 'No UX flows found (set UX_FLOWS_DIR); used the journey graph instead.'
  );
} else {
  console.log(`Scenario graph: ${flowsData.flows.length} flow(s) from ${flowsData.dir}`);
  flowsData.unknownIds.forEach((u) => console.log(`WARN invalid node reference: ${u}`));
  flowsData.unmapped.forEach((s) => console.log(`WARN unmapped catalog scenario: [${s.id}] ${s.title}`));
}
