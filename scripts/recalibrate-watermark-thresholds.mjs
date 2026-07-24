#!/usr/bin/env node
/**
 * Recalibra os thresholds de pixel-diff do watermark do PDF a partir de
 * amostras APROVADAS por humanos.
 *
 * Como funciona
 * -------------
 * 1. Recebe um diretório com PNGs `actual/` e `expected/` do Playwright
 *    (típico: `test-results/**` baixado do artifact do CI).
 * 2. Para cada par `<nome>-actual.png` × `<nome>-expected.png`, calcula:
 *      - diffPixels        (pixels não-idênticos após tolerância por pixel)
 *      - diffPixelRatio    (diffPixels / total)
 *    Não faz diff sofisticado (pixelmatch) para manter o script sem
 *    dependências extras — usa comparação byte-a-byte em PNGs decodificados
 *    via `pngjs` (transitiva do Playwright, já disponível no repo).
 * 3. Agrega por escopo (`element`, `framed`) e propõe threshold:
 *      threshold = clamp(percentile(P95, ratios) * SAFETY, MIN, MAX)
 *    - P95 para tolerar outliers residuais sem inflar por eles.
 *    - SAFETY = 1.5x — margem de segurança sobre a pior amostra aprovada.
 *    - MIN/MAX = clamp para não descer abaixo do ruído de antialiasing
 *      nem subir a ponto de mascarar regressão real do watermark.
 * 4. Gera resumo Markdown para revisão humana; NÃO altera os thresholds
 *    do spec — só sugere. A mudança final continua sendo commit manual
 *    no `WATERMARK_ELEMENT_TOLERANCE` / `WATERMARK_FRAMED_TOLERANCE`.
 *
 * Uso
 * ---
 *   node scripts/recalibrate-watermark-thresholds.mjs \
 *     --samples <dir> \
 *     [--out qa/reports/watermark-threshold-recalibration.md]
 *
 * Exit codes
 * ----------
 *   0  → resumo gerado com sucesso (mesmo que sugira manter thresholds).
 *   1  → erro de I/O ou nenhum par válido encontrado.
 *   2  → sugestão diverge >20% dos thresholds atuais → revisão urgente.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { PNG } from 'pngjs';

// ── SSOT dos thresholds atuais (mantido em sync com o spec) ─────────────
const CURRENT = {
  element: 0.02,
  framed: 0.03,
};
const BOUNDS = {
  element: { min: 0.005, max: 0.05 },
  framed: { min: 0.01, max: 0.08 },
};
const SAFETY = 1.5;
const DIVERGENCE_ALERT = 0.2; // sugestão vs atual > 20% → exit 2.

// ── CLI ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const [k, v] = argv[i].startsWith('--') ? [argv[i].slice(2), argv[i + 1]] : [null, null];
    if (k) {
      out[k] = v;
      i++;
    }
  }
  return out;
}
const args = parseArgs(process.argv);
if (!args.samples) {
  console.error('❌ Uso: --samples <dir> [--out <md>] [--json <path>]');
  process.exit(1);
}
const SAMPLES_DIR = resolve(args.samples);
const OUT_PATH = resolve(args.out ?? 'qa/reports/watermark-threshold-recalibration.md');
const JSON_PATH = args.json ? resolve(args.json) : null;

// ── Coleta pares actual/expected ────────────────────────────────────────
function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) results.push(...walk(p));
    else if (extname(p) === '.png') results.push(p);
  }
  return results;
}

let files;
try {
  files = walk(SAMPLES_DIR);
} catch (e) {
  console.error(`❌ Não consegui ler ${SAMPLES_DIR}: ${e.message}`);
  process.exit(1);
}

// Pareamento: <base>-actual.png com <base>-expected.png.
const pairs = new Map();
for (const f of files) {
  const name = basename(f);
  const m = name.match(/^(.+?)-(actual|expected)\.png$/);
  if (!m) continue;
  const key = join(dirname(f), m[1]);
  const slot = pairs.get(key) ?? {};
  slot[m[2]] = f;
  pairs.set(key, slot);
}
const validPairs = [...pairs.entries()].filter(([, v]) => v.actual && v.expected);
if (validPairs.length === 0) {
  console.error(`❌ Nenhum par actual/expected encontrado em ${SAMPLES_DIR}`);
  process.exit(1);
}

// ── Diff por par ────────────────────────────────────────────────────────
function decode(path) {
  return PNG.sync.read(readFileSync(path));
}

/** Tolerância por-pixel: diff RGB médio > 25 (0-255) conta como diff. */
const PIXEL_TOL = 25;

function ratio(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: 1, note: `dimensões divergem ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const total = a.width * a.height;
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const dr = Math.abs(a.data[i] - b.data[i]);
    const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
    const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
    if ((dr + dg + db) / 3 > PIXEL_TOL) diff++;
  }
  return { ratio: diff / total, note: '' };
}

const measurements = [];
for (const [key, { actual, expected }] of validPairs) {
  try {
    const a = decode(actual);
    const b = decode(expected);
    const { ratio: r, note } = ratio(a, b);
    // Classificação pelo nome do arquivo — segue convenção do spec.
    const name = basename(key);
    const scope = /page-watermark-framed/.test(name) ? 'framed' : 'element';
    measurements.push({ name, scope, ratio: r, note });
  } catch (e) {
    measurements.push({ name: basename(key), scope: 'unknown', ratio: null, note: `erro: ${e.message}` });
  }
}

// ── Agregação ───────────────────────────────────────────────────────────
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

const scopes = ['element', 'framed'];
const suggestions = {};
for (const scope of scopes) {
  const ratios = measurements.filter((m) => m.scope === scope && m.ratio != null).map((m) => m.ratio);
  const p95 = percentile(ratios, 95);
  const raw = p95 * SAFETY;
  const suggested = Number(clamp(raw, BOUNDS[scope].min, BOUNDS[scope].max).toFixed(4));
  suggestions[scope] = {
    samples: ratios.length,
    max: Number((Math.max(0, ...ratios) || 0).toFixed(4)),
    p95: Number(p95.toFixed(4)),
    suggested,
    current: CURRENT[scope],
    delta: Number(((suggested - CURRENT[scope]) / CURRENT[scope]).toFixed(3)),
    clamped: raw !== suggested,
  };
}

// ── Report Markdown ─────────────────────────────────────────────────────
const now = new Date().toISOString();
const anyDivergent = Object.values(suggestions).some(
  (s) => Math.abs(s.delta) > DIVERGENCE_ALERT,
);

const md = `# Recalibração de threshold — pixel-diff do watermark

_Gerado em ${now} por \`scripts/recalibrate-watermark-thresholds.mjs\`._

## Contexto

Este relatório sugere novos valores para \`WATERMARK_ELEMENT_TOLERANCE\` e
\`WATERMARK_FRAMED_TOLERANCE\` em \`e2e/flows/pdf-dialog.spec.ts\`, com base em
amostras aprovadas por humanos (PNGs \`actual\`/\`expected\` do Playwright).

**Fórmula:** \`threshold = clamp(percentile95(ratios) * ${SAFETY}, MIN, MAX)\`.
**Regra de aceitação:** delta ≤ ±${(DIVERGENCE_ALERT * 100).toFixed(0)}% → aplicar direto.
Acima disso → exige justificativa no PR (pode indicar regressão real do watermark).

## Sugestão por escopo

| Escopo   | Amostras | Máx    | P95    | Sugerido | Atual  | Δ       | Clamp |
|----------|---------:|-------:|-------:|---------:|-------:|--------:|:-----:|
${scopes
  .map((s) => {
    const x = suggestions[s];
    return `| ${s.padEnd(8)} | ${String(x.samples).padStart(8)} | ${x.max.toFixed(4)} | ${x.p95.toFixed(4)} | **${x.suggested.toFixed(4)}** | ${x.current.toFixed(4)} | ${(x.delta * 100).toFixed(1)}% | ${x.clamped ? 'sim' : 'não'} |`;
  })
  .join('\n')}

## Como aplicar

1. Revisar os PNGs em \`${SAMPLES_DIR}\` — confirmar que TODAS as amostras
   são visualmente aceitáveis (nenhuma esconde regressão do watermark).
2. Atualizar as constantes em \`e2e/flows/pdf-dialog.spec.ts\`:
   \`\`\`ts
   const WATERMARK_ELEMENT_TOLERANCE = ${suggestions.element.suggested};
   const WATERMARK_FRAMED_TOLERANCE  = ${suggestions.framed.suggested};
   \`\`\`
3. Rebaselinar via workflow \`E2E — PDF Dialog\` com \`update_snapshots=true\`.

## Amostras individuais (top 10 por ratio)

| Escopo   | Ratio  | Arquivo |
|----------|-------:|---------|
${[...measurements]
  .filter((m) => m.ratio != null)
  .sort((a, b) => b.ratio - a.ratio)
  .slice(0, 10)
  .map((m) => `| ${m.scope.padEnd(8)} | ${m.ratio.toFixed(4)} | \`${m.name}\` ${m.note ? '(' + m.note + ')' : ''} |`)
  .join('\n') || '_(sem amostras)_'}

---
_Total de pares analisados: ${measurements.length}. Erros: ${measurements.filter((m) => m.ratio == null).length}._
`;

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, md, 'utf8');
console.log(`✅ Resumo gravado em ${OUT_PATH}`);
console.log(
  `   element: ${suggestions.element.current} → ${suggestions.element.suggested} (Δ ${(suggestions.element.delta * 100).toFixed(1)}%)`,
);
console.log(
  `   framed:  ${suggestions.framed.current} → ${suggestions.framed.suggested} (Δ ${(suggestions.framed.delta * 100).toFixed(1)}%)`,
);

// Emite JSON máquina-legível para consumo do workflow (comentário em PR,
// gate de drift, artifact). Estrutura estável — consumers dependem dela.
if (JSON_PATH) {
  const payload = {
    generatedAt: now,
    safety: SAFETY,
    divergenceAlert: DIVERGENCE_ALERT,
    anyDivergent,
    suggestions,
    totalPairs: measurements.length,
    errors: measurements.filter((m) => m.ratio == null).length,
    reportPath: OUT_PATH,
  };
  mkdirSync(dirname(JSON_PATH), { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`📄 JSON gravado em ${JSON_PATH}`);
}

if (anyDivergent) {
  console.error(
    `\n⚠️  Divergência > ${(DIVERGENCE_ALERT * 100).toFixed(0)}% em algum escopo — revisão humana obrigatória antes de aplicar.`,
  );
  process.exit(2);
}
process.exit(0);
