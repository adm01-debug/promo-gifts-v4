#!/usr/bin/env node
/**
 * Verificação automática de hosts/links Supabase em arquivos .md.
 *
 * Regras:
 *   • Toda URL `https://<ref>.supabase.co` DEVE apontar para o canônico
 *     `doufsxqlfjyuvxuezpln.supabase.co` — a menos que a linha (ou as 2
 *     linhas anteriores) tenham marcador de legado/histórico.
 *   • Links `https://supabase.com/dashboard/project/<ref>/…` seguem a mesma
 *     regra (bloqueia refs != canonical sem marcador).
 *   • `<ref>` genéricos como `<PROJECT_REF>`, `YOUR_PROJECT`, `example`
 *     são ignorados (placeholders de doc).
 *
 * Uso:
 *   node scripts/check-docs-supabase-hosts.mjs [--json] [--fix-report <path>]
 */
import fs from 'node:fs';
import path from 'node:path';

const CANONICAL_REF = 'doufsxqlfjyuvxuezpln';

// Refs adicionais LEGÍTIMAS (bancos externos conhecidos usados pela plataforma).
// Não são o SSOT do app, mas são bancos operacionais válidos em outro contexto.
const ALLOWED_REFS = new Set([
  'pgxfvjmuubtbowutlide', // CRM externo (Gestão de Clientes)
]);

const PLACEHOLDER_REFS = new Set([
  '<project_ref>', '<project-ref>', '<projeto>', '<ref>',
  'your_project_ref', 'your-project-ref', 'your_project',
  'example', 'placeholder', 'xxxxxxxxxxxxx', 'projectref',
  'seu-projeto', 'seuprojeto', 'x', 'xxx', 'foo', 'bar',
]);

// Arquivos históricos: menções toleradas sem marcador explícito.
const HISTORICAL_PATH_PATTERNS = [
  /^docs\/redeploy\//,
  /^docs\/audit\//,
  /^docs\/incidents\//,
  /^docs\/sessoes\//,
  /^docs\/AUDITORIA[_-]/i,
  /^docs\/HANDOFF/i,
  /^docs\/issues-pendentes/i,
  /^docs\/prompts\/history\//,
  /^qa\/reports\//,
  /^qa\/migrations-draft\//,
  /^\.lovable\//,
];

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  '.turbo', '.cache', 'playwright-report', 'test-results',
]);

const LEGACY_MARKERS = [
  /LEGACY[_ ]?INFORMATIV/i, /\bLEGACY\b/, /\blegado\b/i, /\blegacy\b/i,
  /\bdeprecated\b/i, /N[ÃA]O\s+US[AE]/i, /Do not use/i, /\bhist[óo]ric[oa]\b/i,
  /\bforbidden\b/i, /\bproibido\b/i, /apenas informativ[oa]/i,
  /informational only/i, /SSOT[- ]?ALLOW/, /projeto legado/i, /⚠️/,
  /reference only/i, /somente refer[êe]ncia/i, /banco canônico/i,
];

const HOST_RE = /https?:\/\/([a-z0-9-]+)\.supabase\.co\b/gi;
const DASHBOARD_RE = /https?:\/\/supabase\.com\/dashboard\/project\/([a-z0-9-]+)/gi;

const argv = new Set(process.argv.slice(2));
const JSON_OUT = argv.has('--json');

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && /\.mdx?$/i.test(e.name)) out.push(p);
  }
}

function hasLegacyMarker(context) {
  return LEGACY_MARKERS.some((r) => r.test(context));
}

function scanLine(line, prev, prev2) {
  const violations = [];
  const context = [prev2, prev, line].filter(Boolean).join('\n');
  const skip = hasLegacyMarker(context);

  for (const re of [HOST_RE, DASHBOARD_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const ref = m[1].toLowerCase();
      if (PLACEHOLDER_REFS.has(ref)) continue;
      if (ref.length < 12) continue; // Refs curtos são placeholders/exemplos.
      if (ref === CANONICAL_REF) continue;
      if (ALLOWED_REFS.has(ref)) continue;
      if (skip) continue;
      violations.push({
        kind: re === HOST_RE ? 'host' : 'dashboard',
        ref,
        match: m[0],
      });
    }
  }
  return violations;
}

const files = [];
walk('.', files);
const all = [];

for (const file of files) {
  const relFile = file.replace(/^\.\//, '');
  const isHistorical = HISTORICAL_PATH_PATTERNS.some((r) => r.test(relFile));
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('supabase.co') && !content.includes('supabase.com/dashboard')) continue;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const vs = scanLine(line, lines[i - 1], lines[i - 2]);
    for (const v of vs) {
      // Arquivos históricos: só bloqueia se linha for operacional (deploy/link/etc).
      if (isHistorical) continue;
      all.push({ file: relFile, line: i + 1, ...v, text: line.trim().slice(0, 200) });
    }
  }
}


if (JSON_OUT) {
  console.log(JSON.stringify({ canonicalRef: CANONICAL_REF, violations: all }, null, 2));
  process.exit(all.length ? 1 : 0);
}

console.log(`🔗 Supabase hosts em .md — canônico esperado: ${CANONICAL_REF}.supabase.co`);
console.log(`   arquivos varridos: ${files.length}`);

if (all.length === 0) {
  console.log('\x1b[32m[OK]\x1b[0m Todos os hosts operacionais apontam para o canônico.');
  process.exit(0);
}

// Agrupa por ref para relatório.
const byRef = new Map();
for (const v of all) {
  const arr = byRef.get(v.ref) ?? [];
  arr.push(v);
  byRef.set(v.ref, arr);
}

console.error(`\n\x1b[31m[FAIL]\x1b[0m ${all.length} host/link Supabase não-canônico(s) sem marcador de legado:`);
for (const [ref, list] of byRef) {
  console.error(`\n  ref=${ref}  (${list.length} ocorrência(s))`);
  for (const v of list.slice(0, 20)) {
    console.error(`    ${v.file}:${v.line}  [${v.kind}]  ${v.match}`);
    console.error(`      ${v.text}`);
  }
  if (list.length > 20) console.error(`    … +${list.length - 20} omitida(s).`);
}
console.error('\nComo resolver:');
console.error(`  · Se operacional: troque para https://${CANONICAL_REF}.supabase.co`);
console.error('  · Se histórico:  marque a linha (ou as 2 anteriores) com [LEGACY_INFORMATIVO], "projeto legado", "⚠️", "deprecated"…');
process.exit(1);
