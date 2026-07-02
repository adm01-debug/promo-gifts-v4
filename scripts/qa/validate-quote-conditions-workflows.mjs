#!/usr/bin/env node
/**
 * Auditoria dos workflows de PR check e update de snapshots do card "Condições".
 * Usa parser YAML nativo (Node 20+ tem `yaml` via bundle? não — usamos regex + JSON via node --input-type).
 * Como não podemos assumir `js-yaml`, validamos por REGEX estritas + parser leve.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');

const PR = resolve(root, '.github/workflows/e2e-quote-conditions-pr-check.yml');
const UP = resolve(root, '.github/workflows/e2e-update-quote-conditions-snapshots.yml');

const errors = [];
const ok = [];

function check(cond, msg) {
  (cond ? ok : errors).push(msg);
}

for (const f of [PR, UP]) check(existsSync(f), `existe: ${f}`);

const pr = readFileSync(PR, 'utf8');
const up = readFileSync(UP, 'utf8');

// PR check
check(/on:\s*\n\s*pull_request:/.test(pr), 'PR: trigger pull_request');
check(/branches:\s*\[main\]/.test(pr), 'PR: branch main');
check(/paths:/.test(pr), 'PR: paths filter');
check(/quote-conditions-visual\.spec\.ts/.test(pr), 'PR: path do spec');
check(/__screenshots__/.test(pr), 'PR: path dos baselines');
check(/QuoteBuilderPage\.tsx/.test(pr), 'PR: path do QuoteBuilderPage');
check(/components\/quotes\/\*\*/.test(pr), 'PR: path components/quotes/**');
check(/playwright\.config\.ts/.test(pr), 'PR: path playwright.config');
check(/permissions:/.test(pr), 'PR: permissions');
check(/concurrency:/.test(pr), 'PR: concurrency');
check(/timeout-minutes:/.test(pr), 'PR: timeout-minutes');
check(/actions\/cache@v4/.test(pr), 'PR: cache de browsers');
check(/npm run e2e:bootstrap/.test(pr), 'PR: bootstrap');
check(/--project=chromium-public/.test(pr), 'PR: project chromium-public');
check(!/--update-snapshots/.test(pr), 'PR: SEM --update-snapshots (fail-on-diff)');
check(!/contents:\s*write/.test(pr), 'PR: SEM permissão contents:write');

// Update manual
check(/workflow_dispatch:/.test(up), 'UP: workflow_dispatch');
check(/inputs:\s*\n\s*branch:/.test(up), 'UP: input branch');
check(/contents:\s*write/.test(up), 'UP: contents:write');
check(/--update-snapshots/.test(up), 'UP: --update-snapshots');
check(/git push origin HEAD:\$\{\{\s*github\.event\.inputs\.branch\s*\}\}/.test(up), 'UP: push para branch do input');
check(/concurrency:/.test(up), 'UP: concurrency');
check(/timeout-minutes:/.test(up), 'UP: timeout-minutes');
check(/actions\/cache@v4/.test(up), 'UP: cache de browsers');

// YAML syntax sanity: sem TABs, sem trailing crlf estranho
for (const [name, txt] of [['PR', pr], ['UP', up]]) {
  check(!/\t/.test(txt), `${name}: sem TABs`);
  check(txt.endsWith('\n'), `${name}: termina com newline`);
}

// Coerência: mesma cache key entre os dois workflows
const key = (t) => (t.match(/key:\s*(.+)/) || [])[1]?.trim();
check(key(pr) === key(up), `cache key alinhado entre PR e UP (${key(pr)} vs ${key(up)})`);

console.log('OK:', ok.length);
for (const m of ok) console.log('  ✓', m);
if (errors.length) {
  console.log('FAIL:', errors.length);
  for (const m of errors) console.log('  ✗', m);
  process.exit(1);
}
console.log('\nQuote Conditions workflows: PASS');
