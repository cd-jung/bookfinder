#!/usr/bin/env node
/**
 * Write project.config.json values into every file that needs them (wrangler.jsonc, frontend config,
 * index.html). Idempotent: run it after editing project.config.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
const cf = cfg.cloudflare;

function edit(file, replacements) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, 'utf8');
  for (const [pattern, value] of replacements) text = text.replace(pattern, value);
  fs.writeFileSync(full, text);
  console.log(`updated ${file}`);
}

const str = (key) => new RegExp(`("${key}":\\s*)"[^"]*"`);
edit('backend/wrangler.jsonc', [
  [/("name":\s*)"[^"]*"(,\s*\/\/ from project)/, `$1"${cf.workerName}"$2`],
  [str('database_name'), `$1"${cf.d1Name}"`],
  [str('database_id'), `$1"${cf.d1Id}"`],
  [str('index_name'), `$1"${cf.vectorizeIndex}"`],
  [str('APP_NAME'), `$1"${cfg.displayName}"`],
  [str('ALLOWED_ORIGINS'), `$1"https://${cf.frontendWorker}.${cf.workersSubdomain}.workers.dev${cfg.customDomain ? `,https://${cfg.customDomain}` : ''}"`],
  [str('EMBEDDING_MODEL'), `$1"${cfg.ai.embeddingModel}"`],
  [str('LLM_MODEL'), `$1"${cfg.ai.llmModel}"`],
  [str('RAG_TOP_K'), `$1"${cfg.ai.ragTopK}"`],
  [str('RAG_MINIMUM_SIMILARITY'), `$1"${cfg.ai.ragMinimumSimilarity}"`],
]);
edit('frontend/wrangler.jsonc', [[/("name":\s*)"[^"]*"/, `$1"${cf.frontendWorker}"`]]);
edit('frontend/src/config.ts', [[/export const APP_NAME = '[^']*';/, `export const APP_NAME = '${cfg.displayName.replace(/'/g, "\\'")}';`]]);
edit('frontend/index.html', [[/<title>[^<]*<\/title>/, `<title>${cfg.displayName}</title>`]]);
edit('backend/pyproject.toml', [[/^name = "[^"]*"/m, `name = "${cfg.name}-backend"`]]);
edit('frontend/package.json', [[/"name": "[^"]*"/, `"name": "${cfg.name}-frontend"`]]);
