#!/usr/bin/env node
/**
 * ssot-report.mjs — Relatório unificado dos gates SSOT.
 *
 * Executa os 3 gates em modo estruturado, agrega resultados em um único
 * JSON e imprime resumo humano no stderr. Exit 1 se qualquer gate falhar.
 *
 * Uso:
 *   node scripts/ssot-report.mjs              # resumo humano
 *   node scripts/ssot-report.mjs --json       # JSON puro em stdout
 *   node scripts/ssot-report.mjs --out=<path> # grava JSON no arquivo
 */

import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';

const CANONICAL = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN = 'pqpdolkaeqlyzpdpbizo';

const argv = process.argv.slice(2);
const JSON_ONLY = argv.includes('--json');
const OUT_ARG = argv.find((a) => a.startsWith('--out='));
const OUT_PATH = OUT_ARG ? OUT_ARG.slice(6) : null;

function runGate(label, cmd, args) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  const durationMs = Date.now() - t0;
  return {
    label,
    cmd: [cmd, ...args].join(' '),
    exitCode: r.status ?? -1,
    ok: r.status === 0,
    durationMs,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

const gates = [
  runGate('validate-supabase-config', 'node', ['scripts/validate-supabase-config.mjs']),
  runGate('guard-canonical-project', 'node', ['scripts/guard-canonical-project.mjs']),
  runGate('check-docs-supabase-hosts', 'node', ['scripts/check-docs-supabase-hosts.mjs']),
];

const summary = {
  timestamp: new Date().toISOString(),
  canonical: CANONICAL,
  forbidden: FORBIDDEN,
  overallOk: gates.every((g) => g.ok),
  gates: gates.map((g) => ({
    label: g.label,
    ok: g.ok,
    exitCode: g.exitCode,
    durationMs: g.durationMs,
  })),
  details: gates,
};

if (OUT_PATH) {
  writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
}

if (JSON_ONLY) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else {
  const stream = process.stderr;
  stream.write('\n=== SSOT Report ===\n');
  stream.write(`Canônico:  ${CANONICAL}\n`);
  stream.write(`Legado:    ${FORBIDDEN}\n`);
  stream.write(`Timestamp: ${summary.timestamp}\n\n`);
  for (const g of gates) {
    const badge = g.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    stream.write(`  ${badge} ${g.label.padEnd(32)} exit=${g.exitCode} ${g.durationMs}ms\n`);
  }
  stream.write(`\nOverall: ${summary.overallOk ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}\n`);
  if (OUT_PATH) stream.write(`Escrito: ${OUT_PATH}\n`);
}

process.exit(summary.overallOk ? 0 : 1);
