#!/usr/bin/env node
/**
 * Gate de CI: verifica tamanho dos chunks JS produzidos pelo `vite build`.
 *
 * Política em 3 camadas:
 *   1. Limite global por chunk (maxChunkBytes) — teto absoluto.
 *   2. Limite global total (maxTotalBytes) — teto agregado.
 *   3. Limites por chunk crítico (criticalChunks) — regressão específica de
 *      chunks estratégicos (react/router/query/supabase/ui/icons vendors).
 *   4. Regressão vs. snapshot: falha se qualquer chunk crítico crescer mais
 *      de `regressionThresholdPct` (default 15%) em relação ao snapshot.
 *
 * Chunks são identificados por prefixo do filename (ex.: "react-vendor" bate
 * com "assets/react-vendor-abc123.js"), permitindo hash rotativo.
 *
 * Limites e snapshot em bundle-size-baseline.json. Atualizar com:
 *   node scripts/check-bundle-size.mjs --update-baseline
 * (registra valores atuais e adiciona +20% de margem para crescimento orgânico).
 *
 * Saídas:
 *   exit 0 — dentro dos limites
 *   exit 1 — limite ultrapassado ou regressão detectada
 *   exit 2 — erro de execução (dist/ ausente ou baseline inválido)
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST_ASSETS = join(ROOT, 'dist', 'assets');
const BASELINE_PATH = join(ROOT, 'bundle-size-baseline.json');
const UPDATE_FLAG = process.argv.includes('--update-baseline');

// ─── Limites padrão (bytes, raw não-gzip) ───────────────────────────────────
const DEFAULT_LIMITS = {
  maxChunkBytes: 2_000_000,      // 2 MB por chunk (espelha chunkSizeWarningLimit)
  maxTotalBytes: 12_000_000,     // 12 MB total de JS
  warningThresholdPct: 75,       // aviso quando chunk ≥ 75% do limite
  regressionThresholdPct: 15,    // falha quando chunk crítico cresce > 15% vs snapshot
};

// ─── Chunks críticos padrão ─────────────────────────────────────────────────
// Prefixos (matching startsWith no filename dentro de dist/assets/). Cada um
// tem um teto individual mais apertado do que o global — regressões vazam
// aqui antes de bater no teto global. Ajuste com --update-baseline após
// refactor intencional.
const DEFAULT_CRITICAL_CHUNKS = {
  'react-vendor':    { maxBytes: 350_000, label: 'React + ReactDOM' },
  'router-vendor':   { maxBytes: 120_000, label: 'React Router' },
  'query-vendor':    { maxBytes: 200_000, label: 'TanStack Query' },
  'supabase-vendor': { maxBytes: 350_000, label: 'Supabase SDK' },
  'ui-vendor':       { maxBytes: 500_000, label: 'Radix UI + cmdk' },
  'icons-vendor':    { maxBytes: 250_000, label: 'lucide-react' },
  'date-vendor':     { maxBytes: 200_000, label: 'date-fns' },
  'charts-vendor':   { maxBytes: 700_000, label: 'Recharts + D3' },
};

// ─── Utilitários ─────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function formatDelta(current, previous) {
  if (!previous) return '(novo)';
  const delta = current - previous;
  const pct = (delta / previous) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${formatBytes(delta)} (${sign}${pct.toFixed(1)}%)`;
}

function readChunkSizes() {
  if (!existsSync(DIST_ASSETS)) {
    console.error('❌ dist/assets/ não encontrado. Execute `npm run build` antes deste check.');
    process.exit(2);
  }

  const chunks = [];
  for (const name of readdirSync(DIST_ASSETS)) {
    if (!name.endsWith('.js')) continue;
    const fullPath = join(DIST_ASSETS, name);
    const size = statSync(fullPath).size;
    chunks.push({ name, size, path: relative(ROOT, fullPath) });
  }
  return chunks.sort((a, b) => b.size - a.size);
}

/**
 * Extrai o "prefixo lógico" de um filename Vite (nome antes do primeiro hash).
 * "react-vendor-Abc123.js" → "react-vendor"
 * "index-Xyz789.js" → "index"
 */
function extractChunkPrefix(filename) {
  const withoutExt = filename.replace(/\.js$/, '');
  // Hash Vite: sufixo `-[A-Za-z0-9_-]{8,}` no final. Removemos apenas o último.
  const match = withoutExt.match(/^(.+?)-[A-Za-z0-9_-]{8,}$/);
  return match ? match[1] : withoutExt;
}

function findChunkByPrefix(chunks, prefix) {
  return chunks.find((c) => extractChunkPrefix(c.name) === prefix);
}

// ─── Update baseline ──────────────────────────────────────────────────────────
if (UPDATE_FLAG) {
  const chunks = readChunkSizes();
  const total = chunks.reduce((sum, c) => sum + c.size, 0);
  const maxChunk = chunks[0]?.size ?? 0;

  // Preserva criticalChunks existentes; recalcula os limites com +20%.
  const previousBaseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {};
  const existingCritical = previousBaseline.criticalChunks ?? DEFAULT_CRITICAL_CHUNKS;

  const criticalChunks = {};
  for (const [prefix, def] of Object.entries(existingCritical)) {
    const found = findChunkByPrefix(chunks, prefix);
    criticalChunks[prefix] = {
      ...def,
      maxBytes: found ? Math.ceil(found.size * 1.2) : def.maxBytes,
      currentBytes: found ? found.size : null,
    };
  }

  const baseline = {
    generatedAt: new Date().toISOString(),
    description: 'Bundle size baseline (raw JS bytes). Update: node scripts/check-bundle-size.mjs --update-baseline',
    limits: {
      maxChunkBytes: Math.ceil(maxChunk * 1.2),
      maxTotalBytes: Math.ceil(total * 1.2),
      warningThresholdPct: DEFAULT_LIMITS.warningThresholdPct,
      regressionThresholdPct: DEFAULT_LIMITS.regressionThresholdPct,
    },
    criticalChunks,
    snapshot: {
      totalBytes: total,
      chunkCount: chunks.length,
      // Snapshot completo por prefixo para detecção de regressão.
      chunksByPrefix: Object.fromEntries(
        chunks.map((c) => [extractChunkPrefix(c.name), c.size]),
      ),
      topChunks: chunks.slice(0, 10).map(({ name, size }) => ({ name, size })),
    },
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✅ Baseline atualizado em ${BASELINE_PATH}`);
  console.log(`   Total JS: ${formatBytes(total)} | Maior chunk: ${formatBytes(maxChunk)} | Chunks: ${chunks.length}`);
  console.log(`   Novo limite total: ${formatBytes(baseline.limits.maxTotalBytes)}`);
  console.log(`   Novo limite por-chunk global: ${formatBytes(baseline.limits.maxChunkBytes)}`);
  console.log(`   Chunks críticos rastreados: ${Object.keys(criticalChunks).length}`);
  process.exit(0);
}

// ─── Check mode ──────────────────────────────────────────────────────────────
let limits = DEFAULT_LIMITS;
let criticalChunks = DEFAULT_CRITICAL_CHUNKS;
let snapshot = null;

if (existsSync(BASELINE_PATH)) {
  try {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    limits = { ...DEFAULT_LIMITS, ...(baseline.limits ?? {}) };
    if (baseline.criticalChunks) criticalChunks = baseline.criticalChunks;
    snapshot = baseline.snapshot ?? null;
  } catch {
    console.warn('⚠️  Não foi possível ler bundle-size-baseline.json — usando defaults.');
  }
}

const chunks = readChunkSizes();
const total = chunks.reduce((sum, c) => sum + c.size, 0);
const warningBytes = Math.floor((limits.warningThresholdPct / 100) * limits.maxChunkBytes);

console.log('📦 Bundle size check');
console.log(`   Total JS chunks: ${chunks.length}`);
console.log(`   Total size: ${formatBytes(total)} / limite: ${formatBytes(limits.maxTotalBytes)}`);
console.log(`   Maior chunk: ${formatBytes(chunks[0]?.size ?? 0)} / limite: ${formatBytes(limits.maxChunkBytes)}`);
console.log('');

const violations = [];
const warnings = [];
const infos = [];

// ── Camada 1: limite global por chunk ─────────────────────────────────────
for (const chunk of chunks) {
  if (chunk.size > limits.maxChunkBytes) {
    violations.push(
      `[global] ${chunk.path}: ${formatBytes(chunk.size)} > limite ${formatBytes(limits.maxChunkBytes)}`,
    );
  } else if (chunk.size >= warningBytes) {
    warnings.push(
      `[global] ${chunk.path}: ${formatBytes(chunk.size)} (${limits.warningThresholdPct}% do limite)`,
    );
  }
}

// ── Camada 2: limite total ────────────────────────────────────────────────
if (total > limits.maxTotalBytes) {
  violations.push(
    `[total] ${formatBytes(total)} > limite ${formatBytes(limits.maxTotalBytes)}`,
  );
}

// ── Camada 3: chunks críticos ─────────────────────────────────────────────
console.log('🎯 Chunks críticos:');
for (const [prefix, def] of Object.entries(criticalChunks)) {
  const found = findChunkByPrefix(chunks, prefix);
  if (!found) {
    infos.push(`[critical] ${prefix} (${def.label}) — não encontrado no build (pode ter sido renomeado ou movido).`);
    continue;
  }

  const previousSize = snapshot?.chunksByPrefix?.[prefix];
  const delta = previousSize ? formatDelta(found.size, previousSize) : '';
  const status = found.size > def.maxBytes ? '❌' : '✅';
  console.log(
    `   ${status} ${prefix.padEnd(18)} ${formatBytes(found.size).padStart(9)} / ${formatBytes(def.maxBytes).padStart(9)}  ${delta}`,
  );

  if (found.size > def.maxBytes) {
    violations.push(
      `[critical] ${prefix} (${def.label}): ${formatBytes(found.size)} > limite ${formatBytes(def.maxBytes)}`,
    );
  }

  // Camada 4: regressão vs. snapshot
  if (previousSize && found.size > previousSize) {
    const pct = ((found.size - previousSize) / previousSize) * 100;
    if (pct > limits.regressionThresholdPct) {
      violations.push(
        `[regression] ${prefix}: cresceu ${pct.toFixed(1)}% (${formatBytes(previousSize)} → ${formatBytes(found.size)}, limite ${limits.regressionThresholdPct}%)`,
      );
    } else if (pct > limits.regressionThresholdPct / 2) {
      warnings.push(
        `[regression] ${prefix}: cresceu ${pct.toFixed(1)}% (${formatBytes(previousSize)} → ${formatBytes(found.size)})`,
      );
    }
  }
}
console.log('');

if (infos.length > 0) {
  console.log('ℹ️  Info:');
  infos.forEach((i) => console.log(`   ${i}`));
  console.log('');
}

if (warnings.length > 0) {
  console.warn('⚠️  Avisos:');
  warnings.forEach((w) => console.warn(`   ${w}`));
  console.warn('');
}

if (violations.length > 0) {
  console.error(`❌ Bundle size FALHOU — ${violations.length} violação(ões):`);
  violations.forEach((v) => console.error(`   ${v}`));
  console.error('');
  console.error('Para investigar visualmente: abra dist/stats.html após `npm run build`.');
  console.error('Para atualizar baseline após refactor intencional:');
  console.error('   node scripts/check-bundle-size.mjs --update-baseline');
  process.exit(1);
}

// Top 5 para visibilidade
console.log('Top 5 chunks:');
chunks.slice(0, 5).forEach(({ path, size }) => {
  const prefix = extractChunkPrefix(path.split('/').pop());
  const previousSize = snapshot?.chunksByPrefix?.[prefix];
  const delta = previousSize ? ` ${formatDelta(size, previousSize)}` : '';
  console.log(`   ${formatBytes(size).padStart(9)}  ${path}${delta}`);
});

console.log('');
console.log('✅ Bundle size dentro dos limites (global + críticos + regressão).');
process.exit(0);
