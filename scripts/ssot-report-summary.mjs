#!/usr/bin/env node
/**
 * ssot-report-summary.mjs
 *
 * Gera resumo humano do ssot-report.json em Markdown, com contagens
 * de gates (total/pass/fail) e de linhas de erro extraídas do stderr
 * de cada gate falho. Escreve em stdout (para o log do job) e, quando
 * $GITHUB_STEP_SUMMARY estiver definido, também nele.
 *
 * Uso:
 *   node scripts/ssot-report-summary.mjs --in=ssot-report.json
 *
 * Exit 0 sempre (UX-only).
 */

import { readFileSync, existsSync, appendFileSync } from 'fs';

const argv = process.argv.slice(2);
const inArg = argv.find((a) => a.startsWith('--in='));
const IN_PATH = inArg ? inArg.slice(5) : 'ssot-report.json';

const NOISE = /^(?:npm (?:warn|notice|info)|>|\s*$|===|---)/i;

function countErrorLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !NOISE.test(l)).length;
}

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function build(report) {
  const gates = Array.isArray(report.details) ? report.details : [];
  const total = gates.length;
  const passed = gates.filter((g) => g.ok).length;
  const failed = total - passed;

  const perGate = gates.map((g) => ({
    label: g.label,
    ok: g.ok,
    exitCode: g.exitCode,
    durationMs: g.durationMs,
    errorLines: g.ok ? 0 : countErrorLines(`${g.stdout}\n${g.stderr}`),
  }));

  const totalErrors = perGate.reduce((acc, g) => acc + g.errorLines, 0);

  const lines = [];
  lines.push('### SSOT Supabase Gates');
  lines.push('');
  lines.push(`- **Status geral:** ${report.overallOk ? '✅ PASS' : '❌ FAIL'}`);
  lines.push(`- **Gates:** ${total} total · ${passed} ✅ · ${failed} ❌`);
  lines.push(`- **Linhas de erro (stderr/stdout):** ${totalErrors}`);
  lines.push(`- **Schema:** v${report.schemaVersion ?? '?'}`);
  lines.push(`- **Canônico:** \`${report.canonical ?? '?'}\``);
  lines.push(`- **Legado (proibido):** \`${report.forbidden ?? '?'}\``);
  lines.push(`- **Timestamp:** ${report.timestamp ?? '?'}`);
  lines.push('');
  lines.push('| Gate | Status | Exit | Duração | Erros |');
  lines.push('|---|---|---:|---:|---:|');
  for (const g of perGate) {
    lines.push(
      `| \`${g.label}\` | ${g.ok ? '✅' : '❌'} | ${g.exitCode} | ${fmtMs(g.durationMs)} | ${g.errorLines} |`,
    );
  }

  const failedGates = gates.filter((g) => !g.ok);
  if (failedGates.length) {
    lines.push('');
    lines.push('#### Primeiras linhas de erro por gate');
    for (const g of failedGates) {
      const preview = `${g.stderr || ''}\n${g.stdout || ''}`
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !NOISE.test(l))
        .slice(0, 10);
      lines.push('');
      lines.push(`<details><summary><code>${g.label}</code> — exit ${g.exitCode} (${preview.length} linha(s))</summary>`);
      lines.push('');
      lines.push('```');
      for (const l of preview) lines.push(l);
      lines.push('```');
      lines.push('</details>');
    }
  }

  return { md: lines.join('\n') + '\n', totalErrors, failed };
}

if (!existsSync(IN_PATH)) {
  const msg = `### SSOT Supabase Gates\n\n⚠️ \`${IN_PATH}\` não encontrado — nada a resumir.\n`;
  process.stdout.write(msg);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg);
  }
  process.exit(0);
}

let report;
try {
  report = JSON.parse(readFileSync(IN_PATH, 'utf8'));
} catch (e) {
  const msg = `### SSOT Supabase Gates\n\n⚠️ JSON inválido em \`${IN_PATH}\`: ${e.message}\n`;
  process.stdout.write(msg);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg);
  }
  process.exit(0);
}

const { md } = build(report);
process.stdout.write(md);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
