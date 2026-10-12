// @ts-check
/**
 * Reads the UX flow scenarios (Mermaid flowcharts in markdown) and places the
 * catalog scenarios on their nodes so the HTML report can colour each node by
 * E2E coverage.
 *
 * Node placement comes from catalog.json: each scenario has
 *   "nodes": ["<flow prefix>:<nodeId>", ...]   e.g. "03:dash" = node `dash` in 03-*.md
 *
 * Directive inside a ```mermaid block (Mermaid ignores `%%` comments):
 *   %% link <nodeId> <file.md>    clicking the node opens another flow
 *
 * Location: UX_FLOWS_DIR env var, default ../ux-flows (sibling of the e2e folder)
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.resolve(__dirname, '..', '..', '..', 'ux-flows');
const FLOWS_DIR = process.env.UX_FLOWS_DIR ? path.resolve(process.env.UX_FLOWS_DIR) : DEFAULT_DIR;
const MERMAID_JS = path.join(FLOWS_DIR, 'mermaid.min.js');

function parseFlow(name, text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const codeMatch = normalized.match(/```mermaid[^\n]*\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : '';
  const title = (normalized.match(/^#\s+(.+)$/m) || [])[1] || name;

  const links = {};
  for (const m of code.matchAll(/^\s*%%\s*link\s+(\S+)\s+(\S+\.md)\s*$/gm)) links[m[1]] = m[2];

  // Node ids used in the diagram (ignoring comment lines), for validating catalog refs
  const body = code
    .split('\n')
    .filter((l) => !l.trim().startsWith('%%'))
    .join('\n');
  return { name, title, code, links, body };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {Array<{id: string, title: string, priority: string, covered: boolean, ticket?: string, nodes?: string[]}>} catalogScenarios
 */
function loadFlows(catalogScenarios) {
  if (!fs.existsSync(FLOWS_DIR)) return null;
  const files = fs
    .readdirSync(FLOWS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  if (!files.length) return null;

  const flows = files.map((file) => parseFlow(file, fs.readFileSync(path.join(FLOWS_DIR, file), 'utf8')));
  const flowByPrefix = (prefix) => flows.find((f) => f.name.startsWith(`${prefix}-`));

  /** @type {Map<string, Map<string, any[]>>} flow name -> nodeId -> scenarios */
  const placement = new Map(flows.map((f) => [f.name, new Map()]));
  const unknownRefs = [];
  const unmapped = [];

  catalogScenarios.forEach((s) => {
    const refs = Array.isArray(s.nodes) ? s.nodes : [];
    if (!refs.length) {
      unmapped.push(s);
      return;
    }
    refs.forEach((ref) => {
      const m = String(ref).match(/^([^:]+):(.+)$/);
      const flow = m && flowByPrefix(m[1]);
      if (!m || !flow) {
        unknownRefs.push(`[${s.id}] ${ref}: flow not found`);
        return;
      }
      const nodeId = m[2];
      if (!new RegExp(`(^|[^\\w-])${escapeRe(nodeId)}(?![\\w-])`, 'm').test(flow.body)) {
        unknownRefs.push(`[${s.id}] ${ref}: node not found in ${flow.name}`);
        return;
      }
      const nodes = placement.get(flow.name);
      nodes.set(nodeId, [...(nodes.get(nodeId) || []), s]);
    });
  });

  const result = flows.map((flow) => {
    const nodes = [...placement.get(flow.name).entries()].map(([nodeId, list]) => {
      const scenarios = list.map((s) => ({
        id: s.id,
        title: s.title,
        priority: s.priority,
        covered: s.covered,
        ticket: s.ticket || ''
      }));
      const coveredCount = scenarios.filter((s) => s.covered).length;
      let status = 'none';
      if (coveredCount === scenarios.length) status = 'covered';
      else if (coveredCount > 0) status = 'partial';
      return { nodeId, scenarios, coveredCount, status };
    });

    // Append coverage classes; stroke-only so the node's own fill is kept
    const byStatus = { covered: [], partial: [], none: [] };
    nodes.forEach((n) => byStatus[n.status].push(n.nodeId));
    const extra = [
      '',
      '  classDef e2eCovered stroke:#2e7d32,stroke-width:4px',
      '  classDef e2ePartial stroke:#1e88e5,stroke-width:4px',
      '  classDef e2eNone stroke:#d29922,stroke-width:4px,stroke-dasharray:6 3'
    ];
    if (byStatus.covered.length) extra.push(`  class ${byStatus.covered.join(',')} e2eCovered`);
    if (byStatus.partial.length) extra.push(`  class ${byStatus.partial.join(',')} e2ePartial`);
    if (byStatus.none.length) extra.push(`  class ${byStatus.none.join(',')} e2eNone`);

    // Count each scenario once per flow, even when it sits on several nodes
    const distinct = new Map();
    nodes.forEach((n) => n.scenarios.forEach((s) => distinct.set(s.id, s.covered)));
    const covered = [...distinct.values()].filter(Boolean).length;
    return {
      name: flow.name,
      title: flow.title,
      links: flow.links,
      renderCode: `${flow.code}\n${extra.join('\n')}`,
      nodes,
      total: distinct.size,
      covered
    };
  });

  const mermaidJs = fs.existsSync(MERMAID_JS) ? fs.readFileSync(MERMAID_JS, 'utf8') : null;
  return { dir: FLOWS_DIR, flows: result, unmapped, unknownIds: unknownRefs, mermaidJs };
}

module.exports = { loadFlows, FLOWS_DIR };
