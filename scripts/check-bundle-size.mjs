#!/usr/bin/env node
/**
 * Gate de CI: verifica tamanho dos chunks JS produzidos pelo `vite build`.
 *
 * Política:
 *   • Falha se algum chunk individual ultrapassar o limite por-chunk.
 *   • Falha se o total de JS (raw, não-gzip) ultrapassar o limite total.
 *   • Emite aviso quando um chunk ultrapassar 75% do limite (early warning).
 *
 * Limites em bundle-size-baseline.json (atualizar com:
 *   node scripts/check-bundle-size.mjs --update-baseline
 * Isso registra os valores atuais e os eleva 20% para margem).
 *
 * Saídas:
 *   exit 0 — dentro dos limites
 *   exit 1 — limite ultrapassado
 *   exit 2 — erro de execução (dist/ ausente ou baseline não encontrado)
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST_ASSETS = join(ROOT, 'dist', 'assets');
const BASELINE_PATH = join(ROOT, 'bundle-size-baseline.json');
const UPDATE_FLAG = process.argv.includes('--update-baseline');

// ─── Limites padrão (em bytes, raw não-gzip) ────────────────────────────────
// Ajustados conforme tamanho real do projeto (React + Radix + Supabase).
// Para apertar: diminua aqui + rode --update-baseline.
const DEFAULT_LIMITS = {
  maxChunkBytes: 2_000_000,      // 2 MB por chunk (espelha chunkSizeWarningLimit do vite)
  maxTotalBytes: 12_000_000,     // 12 MB total de JS (generoso para app com 100+ chunks)
  warningThresholdPct: 75,       // aviso quando chunk ≥ 75% do limite
};

// ─── Utilitários ─────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
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

// ─── Update baseline ──────────────────────────────────────────────────────────
if (UPDATE_FLAG) {
  const chunks = readChunkSizes();
  const total = chunks.reduce((sum, c) => sum + c.size, 0);
  const maxChunk = chunks[0]?.size ?? 0;

  const baseline = {
    generatedAt: new Date().toISOString(),
    description: 'Bundle size baseline (raw JS bytes). Update with: node scripts/check-bundle-size.mjs --update-baseline',
    limits: {
      // +20% margin on top of actual sizes to allow organic growth
      maxChunkBytes: Math.ceil(maxChunk * 1.2),
      maxTotalBytes: Math.ceil(total * 1.2),
      warningThresholdPct: DEFAULT_LIMITS.warningThresholdPct,
    },
    snapshot: {
      totalBytes: total,
      chunkCount: chunks.length,
      topChunks: chunks.slice(0, 10).map(({ name, size }) => ({ name, size })),
    },
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✅ Baseline atualizado em ${BASELINE_PATH}`);
  console.log(`   Total JS: ${formatBytes(total)} | Maior chunk: ${formatBytes(maxChunk)}`);
  console.log(`   Novo limite total: ${formatBytes(baseline.limits.maxTotalBytes)}`);
  console.log(`   Novo limite por-chunk: ${formatBytes(baseline.limits.maxChunkBytes)}`);
  process.exit(0);
}

// ─── Check mode ──────────────────────────────────────────────────────────────
let limits = DEFAULT_LIMITS;
if (existsSync(BASELINE_PATH)) {
  try {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    limits = { ...DEFAULT_LIMITS, ...baseline.limits };
  } catch {
    console.warn('⚠️  Não foi possível ler bundle-size-baseline.json — usando limites padrão.');
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

for (const chunk of chunks) {
  if (chunk.size > limits.maxChunkBytes) {
    violations.push(`${chunk.path}: ${formatBytes(chunk.size)} > limite de ${formatBytes(limits.maxChunkBytes)}`);
  } else if (chunk.size >= warningBytes) {
    warnings.push(`${chunk.path}: ${formatBytes(chunk.size)} (${limits.warningThresholdPct}% do limite)`);
  }
}

if (total > limits.maxTotalBytes) {
  violations.push(`Total JS: ${formatBytes(total)} > limite de ${formatBytes(limits.maxTotalBytes)}`);
}

if (warnings.length > 0) {
  console.warn('⚠️  Chunks próximos do limite:');
  warnings.forEach((w) => console.warn(`   ${w}`));
  console.warn('');
}

if (violations.length > 0) {
  console.error(`❌ Bundle size excede o limite — ${violations.length} violação(ões):`);
  violations.forEach((v) => console.error(`   ${v}`));
  console.error('');
  console.error('Para investigar: npm run build && node scripts/check-bundle-size.mjs');
  console.error('Para atualizar baseline após refactor intencional: node scripts/check-bundle-size.mjs --update-baseline');
  process.exit(1);
}

// Print top 5 chunks for visibility
console.log('Top 5 chunks:');
chunks.slice(0, 5).forEach(({ path, size }) => {
  console.log(`   ${formatBytes(size).padStart(9)}  ${path}`);
});

console.log('');
console.log('✅ Bundle size dentro dos limites.');
process.exit(0);
