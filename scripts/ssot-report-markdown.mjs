#!/usr/bin/env node
/**
 * ssot-report-markdown.mjs — Converte ssot-report.json em Markdown para revisão de PR.
 *
 * Uso:
 *   node scripts/ssot-report-markdown.mjs --in=<report.json> [--out=<report.md>]
 *   cat report.json | node scripts/ssot-report-markdown.mjs            # stdin → stdout
 *   node scripts/ssot-report.mjs --out=/tmp/r.json && \
 *     node scripts/ssot-report-markdown.mjs --in=/tmp/r.json --out=/tmp/r.md
 *
 * Saída: título, badges, resumo de campos, tabela de gates, contagem de erros,
 * detalhes colapsáveis de stdout/stderr por gate. Estável e determinística.
 */

import { readFileSync, writeFileSync } from 'fs';

const argv = process.argv.slice(2);
const inArg = argv.find((a) => a.startsWith('--in='));
const outArg = argv.find((a) => a.startsWith('--out='));
const IN_PATH = inArg ? inArg.slice(5) : null;
const OUT_PATH = outArg ? outArg.slice(6) : null;

function readInput() {
  if (IN_PATH) return readFileSync(IN_PATH, 'utf8');
  if (process.stdin.isTTY) {
    process.stderr.write(
      'Erro: forneça --in=<arquivo> ou pipe o JSON via stdin.\n' +
        'Ex.: node scripts/ssot-report.mjs --out=/tmp/r.json && \\\n' +
        '     node scripts/ssot-report-markdown.mjs --in=/tmp/r.json\n',
    );
    process.exit(2);
  }
  return readFileSync(0, 'utf8');
}

let report;
try {
  report = JSON.parse(readInput());
} catch (e) {
  process.stderr.write(`Erro: JSON inválido — ${e.message}\n`);
  process.exit(2);
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const fence = (s, lang = '') =>
  '```' + lang + '\n' + String(s ?? '').replace(/```/g, '`\u200b``') + '\n```';
const badge = (ok) => (ok ? '🟢 PASS' : '🔴 FAIL');

// Heurística: conta linhas do stderr que "parecem erro" para dar sinal ao revisor.
const ERROR_RE = /(^|\b)(error|erro|fail(ed)?|falhou|✗|✘|denied|forbidden|missing)/i;
function countErrorLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).filter((l) => ERROR_RE.test(l)).length;
}

// ---------- extração ----------
const {
  schemaVersion = '?',
  timestamp = '?',
  canonical = '?',
  forbidden = '?',
  overallOk = false,
  gates = [],
  details = [],
} = report;

const detailsByLabel = new Map(details.map((d) => [d.label, d]));
const totalGates = gates.length;
const okGates = gates.filter((g) => g.ok).length;
const failGates = totalGates - okGates;
const totalErrLines = details.reduce(
  (acc, d) => acc + countErrorLines(d.stderr) + countErrorLines(d.stdout),
  0,
);
const totalDuration = details.reduce((acc, d) => acc + (d.durationMs || 0), 0);

// ---------- render ----------
const lines = [];
lines.push(`# SSOT Report — ${badge(overallOk)}`);
lines.push('');
lines.push(
  `> Overall: **${overallOk ? 'PASS' : 'FAIL'}** · Gates: **${okGates}/${totalGates}** OK` +
    ` · Falhas: **${failGates}** · Linhas de erro detectadas: **${totalErrLines}**`,
);
lines.push('');

// Resumo de campos
lines.push('## Resumo');
lines.push('');
lines.push('| Campo | Valor |');
lines.push('|---|---|');
lines.push(`| \`schemaVersion\` | \`${esc(schemaVersion)}\` |`);
lines.push(`| \`timestamp\` | \`${esc(timestamp)}\` |`);
lines.push(`| \`canonical\` | \`${esc(canonical)}\` |`);
lines.push(`| \`forbidden\` | \`${esc(forbidden)}\` |`);
lines.push(`| \`overallOk\` | \`${overallOk}\` |`);
lines.push(`| Duração total | \`${totalDuration}ms\` |`);
lines.push('');

// Tabela de gates
lines.push('## Gates');
lines.push('');
if (totalGates === 0) {
  lines.push('_Nenhum gate registrado no relatório._');
} else {
  lines.push('| # | Gate | Status | Exit | Duração | Linhas de erro |');
  lines.push('|---:|---|:---:|---:|---:|---:|');
  gates.forEach((g, i) => {
    const d = detailsByLabel.get(g.label) || {};
    const errs = countErrorLines(d.stderr) + countErrorLines(d.stdout);
    lines.push(
      `| ${i + 1} | \`${esc(g.label)}\` | ${badge(g.ok)} | \`${g.exitCode}\` | \`${g.durationMs}ms\` | ${errs} |`,
    );
  });
}
lines.push('');

// Contagens agregadas
lines.push('## Contagens');
lines.push('');
lines.push('| Métrica | Valor |');
lines.push('|---|---:|');
lines.push(`| Gates totais | ${totalGates} |`);
lines.push(`| Gates OK | ${okGates} |`);
lines.push(`| Gates com falha | ${failGates} |`);
lines.push(`| Linhas de erro (stdout+stderr) | ${totalErrLines} |`);
lines.push(`| Duração acumulada | ${totalDuration}ms |`);
lines.push('');

// Detalhes por gate (colapsável — não polui o diff do PR)
lines.push('## Detalhes por gate');
lines.push('');
for (const d of details) {
  const errs = countErrorLines(d.stderr) + countErrorLines(d.stdout);
  const openAttr = d.ok ? '' : ' open';
  lines.push(`<details${openAttr}>`);
  lines.push(
    `<summary>${badge(d.ok)} <code>${esc(d.label)}</code> — exit <code>${d.exitCode}</code>, <code>${d.durationMs}ms</code>, erros: ${errs}</summary>`,
  );
  lines.push('');
  lines.push(`**Comando:** \`${esc(d.cmd)}\``);
  lines.push('');
  if (d.stdout) {
    lines.push('**stdout**');
    lines.push('');
    lines.push(fence(d.stdout));
    lines.push('');
  }
  if (d.stderr) {
    lines.push('**stderr**');
    lines.push('');
    lines.push(fence(d.stderr));
    lines.push('');
  }
  if (!d.stdout && !d.stderr) {
    lines.push('_Sem saída capturada._');
    lines.push('');
  }
  lines.push('</details>');
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push(
  `_Gerado a partir de \`ssot-report.json\` (schema v${esc(schemaVersion)}) em ${esc(timestamp)}._`,
);
lines.push('');

const md = lines.join('\n');

if (OUT_PATH) {
  writeFileSync(OUT_PATH, md);
  process.stderr.write(`Escrito: ${OUT_PATH}\n`);
} else {
  process.stdout.write(md);
}

// Exit code espelha overallOk para uso encadeado em CI.
process.exit(overallOk ? 0 : 1);
