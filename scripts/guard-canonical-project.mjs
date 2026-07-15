import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// fix_version: guard-scope-runtime+docs-operational-2026-07-15
// Fases:
//   1) Runtime code (src/, supabase/functions/) — bloqueia QUALQUER referência ao ID proibido
//      (exceto linhas de comentário puro), reproduzindo o comportamento clássico.
//   2) Arquivos críticos — exige presença do ID canônico em client.ts e config.toml.
//   3) Docs .md — bloqueia menções OPERACIONAIS ao ID proibido; menções informacionais
//      (com marcador de legado) são permitidas.
//
// Flags:
//   --skip-docs    pula fase 3
//   --docs-only    executa apenas fase 3
//   --json         saída estruturada para CI

const CANONICAL_ID = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN_ID = 'pqpdolkaeqlyzpdpbizo';

const argv = new Set(process.argv.slice(2));
const SKIP_DOCS = argv.has('--skip-docs');
const DOCS_ONLY = argv.has('--docs-only');
const JSON_OUT = argv.has('--json');

// Marcadores que classificam a linha como INFORMACIONAL/LEGADA.
// Se qualquer um casar na linha (ou nas 2 linhas anteriores), o hit não bloqueia.
const LEGACY_MARKERS = [
  /LEGACY[_ ]?INFORMATIV/i,
  /\bLEGACY\b/,
  /\blegado\b/i,
  /\blegacy\b/i,
  /\bdeprecated\b/i,
  /\bobsolet[oa]\b/i,
  /N[ÃA]O\s+USE/i,
  /N[ÃA]O\s+USAR/i,
  /Do not use/i,
  /Don['’]t use/i,
  /\bhist[óo]ric[oa]\b/i,
  /\bhistorical\b/i,
  /\bforbidden\b/i,
  /\bproibido\b/i,
  /apenas informativ[oa]/i,
  /informational only/i,
  /SSOT[- ]?ALLOW/,
  /projeto legado/i,
  /reference only/i,
  /somente refer[êe]ncia/i,
  /⚠️/,
  /banco canônico/i,
  /canonical\s+(is|é)/i,
];

// Padrões que caracterizam INSTRUÇÃO OPERACIONAL (aumentam severidade se
// aparecerem na mesma linha do ID proibido — a linha DEVE ter marcador legado).
const OPERATIONAL_HINTS = [
  /supabase\s+link/i,
  /supabase\s+db\s+push/i,
  /--project-ref/,
  /project[_-]?id\s*[:=]/i,
  /VITE_SUPABASE_(URL|PROJECT_ID|PUBLISHABLE_KEY)/,
  /connect(?:\s+to)?/i,
  /conectar\s+(?:ao|no|em)/i,
  /apontar\s+para/i,
  /point\s+to/i,
  /rodar/i,
  /aplicar\s+migra/i,
  /run\s+migration/i,
  /deploy/i,
];

// Diretórios excluídos (raiz do repo).
const DOC_EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  '.turbo', '.cache', 'playwright-report', 'test-results',
]);

// ── Helpers ───────────────────────────────────────────────────────────────
function hasCommand(cmd) {
  try { execSync('command -v ' + cmd, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') ||
         t.startsWith('--') || t.startsWith('#') || t.startsWith('<!--');
}

function extractContent(matchLine) {
  const parts = matchLine.split(':');
  if (parts.length >= 3 && /^\d+$/.test(parts[1])) return parts.slice(2).join(':');
  return parts.slice(1).join(':');
}

function hasLegacyMarker(line) {
  return LEGACY_MARKERS.some((r) => r.test(line));
}

function isOperational(line) {
  return OPERATIONAL_HINTS.some((r) => r.test(line));
}

// ── Fase 1 + 2: runtime code (mantido do guard clássico) ─────────────────
function runRuntimePhase() {
  console.log('[CI Guard] Fase 1/3 — Runtime code (' + FORBIDDEN_ID + ')…');

  const SCAN_DIRS = ['src', 'supabase/functions'];
  const EXCLUDE_GLOBS = [
    '**/__tests__/**', '**/tests/**',
    '**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.jsx',
    '**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js',
  ];
  const EXCLUDE_DIRS_GREP = ['__tests__', 'tests', 'node_modules', '.git', 'dist'];
  const EXCLUDE_EXTS_GREP = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js', '.spec.js'];

  let rawHits = [];
  const existingDirs = SCAN_DIRS.filter((d) => fs.existsSync(d));
  if (existingDirs.length === 0) {
    console.log('[CI Guard]  · nenhum dir de scan runtime — skip.');
  } else if (hasCommand('rg')) {
    const excludeArgs = EXCLUDE_GLOBS.map((g) => '--glob "!' + g + '"').join(' ');
    const cmd = 'rg "' + FORBIDDEN_ID + '" --line-number ' + excludeArgs + ' ' + existingDirs.join(' ');
    try {
      rawHits = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    } catch (e) {
      rawHits = (e.stdout || '').trim().split('\n').filter(Boolean);
    }
  } else {
    for (const dir of existingDirs) {
      const exDirs = EXCLUDE_DIRS_GREP.map((d) => '--exclude-dir=' + d).join(' ');
      const exFiles = EXCLUDE_EXTS_GREP.map((e) => '--exclude="*' + e + '"').join(' ');
      try {
        const out = execSync('grep -rIn ' + exDirs + ' ' + exFiles + ' "' + FORBIDDEN_ID + '" "' + dir + '"', { encoding: 'utf8' });
        rawHits = rawHits.concat(out.trim().split('\n').filter(Boolean));
      } catch (ge) {
        rawHits = rawHits.concat((ge.stdout || '').trim().split('\n').filter(Boolean));
      }
    }
  }

  const hits = rawHits.filter((line) => !isCommentLine(extractContent(line)));
  if (hits.length > 0) {
    console.error('\x1b[31m[CRITICAL]\x1b[0m ID proibido em código runtime:');
    console.error(hits.join('\n'));
    console.error('\x1b[33mAponte para o canônico: ' + CANONICAL_ID + '\x1b[0m');
    return { ok: false, hits };
  }
  console.log('\x1b[32m[OK]\x1b[0m Runtime code limpo.');

  console.log('[CI Guard] Fase 2/3 — Arquivos críticos contêm ID canônico…');
  const criticalFiles = ['src/integrations/supabase/client.ts', 'supabase/config.toml'];
  for (const file of criticalFiles) {
    if (!fs.existsSync(file)) continue;
    if (!fs.readFileSync(file, 'utf8').includes(CANONICAL_ID)) {
      console.error('\x1b[31m[ERROR]\x1b[0m ID canônico ausente em ' + file);
      return { ok: false, hits: [file + ' :: missing canonical id'] };
    }
  }
  console.log('\x1b[32m[OK]\x1b[0m Arquivos críticos ancorados no canônico.');
  return { ok: true, hits: [] };
}

// ── Fase 3: docs operacionais ─────────────────────────────────────────────
function collectMarkdownFiles() {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (DOC_EXCLUDE_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.mdx?$/i.test(e.name)) out.push(p);
    }
  }
  walk('.');
  return out;
}

function runDocsPhase() {
  console.log('[CI Guard] Fase 3/3 — Docs .md operacionais…');
  const files = collectMarkdownFiles();
  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(FORBIDDEN_ID)) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes(FORBIDDEN_ID)) continue;

      // Contexto local: linha atual + 2 anteriores + próxima 1 (para pegar
      // rótulos que estão em cabeçalho de bloco).
      const context = [lines[i - 2], lines[i - 1], line, lines[i + 1]]
        .filter(Boolean).join('\n');

      if (hasLegacyMarker(context)) continue; // OK — informacional

      const operational = isOperational(line);
      violations.push({
        file: file.replace(/^\.\//, ''),
        line: i + 1,
        text: line.trim().slice(0, 240),
        severity: operational ? 'operational' : 'unlabeled',
      });
    }
  }

  if (violations.length === 0) {
    console.log('\x1b[32m[OK]\x1b[0m Nenhuma menção operacional ao ID legado em docs.');
    return { ok: true, violations: [] };
  }

  console.error('\x1b[31m[DOCS]\x1b[0m ' + violations.length + ' menção(ões) ao ID legado sem marcador de legado:');
  for (const v of violations.slice(0, 60)) {
    const tag = v.severity === 'operational' ? '⚠️  OPERACIONAL' : '·  sem-rótulo';
    console.error('  ' + tag + '  ' + v.file + ':' + v.line + '  ' + v.text);
  }
  if (violations.length > 60) {
    console.error('  … e mais ' + (violations.length - 60) + ' violação(ões).');
  }
  console.error('\nComo resolver:');
  console.error('  · Se a menção é histórica, adicione um marcador na mesma linha ou nas 2 anteriores:');
  console.error('      [LEGACY_INFORMATIVO], "projeto legado", "não use", "⚠️", "deprecated"…');
  console.error('  · Se a instrução é operacional, troque o ID pelo canônico: ' + CANONICAL_ID);

  // Regra de bloqueio: qualquer violação "operational" bloqueia sempre.
  // Violações "unlabeled" também bloqueiam (previne novos hits sem rótulo).
  return { ok: false, violations };
}

// ── Runner ────────────────────────────────────────────────────────────────
try {
  const results = { runtime: null, docs: null };

  if (!DOCS_ONLY) {
    results.runtime = runRuntimePhase();
  }
  if (!SKIP_DOCS) {
    results.docs = runDocsPhase();
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ canonical: CANONICAL_ID, forbidden: FORBIDDEN_ID, ...results }, null, 2));
  }

  const runtimeOk = !results.runtime || results.runtime.ok;
  const docsOk = !results.docs || results.docs.ok;

  if (!runtimeOk || !docsOk) process.exit(1);

  console.log('\x1b[32m[OK]\x1b[0m Guard canônico aprovado.');
  process.exit(0);
} catch (error) {
  console.error('[CI Guard] Erro inesperado:', error.message);
  process.exit(1);
}
