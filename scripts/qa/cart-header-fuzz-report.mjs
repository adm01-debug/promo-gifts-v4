#!/usr/bin/env node
/**
 * Relatório automático das invariantes do CartHeader fuzz.
 *
 * Roda vitest com reporter JSON, parseia resultados e gera:
 *   - qa/reports/cart-header-fuzz-report.md
 *
 * Cada teste do fuzzer expõe:
 *   - qual invariante cobre (extraído do nome do test/describe)
 *   - viewport range e estados condicionais cobertos
 *   - status (pass/fail) e duração
 *
 * Uso:
 *   node scripts/qa/cart-header-fuzz-report.mjs
 *   node scripts/qa/cart-header-fuzz-report.mjs --strict   # falha se houver skips
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'qa/reports');
const OUT_FILE = resolve(OUT_DIR, 'cart-header-fuzz-report.md');
const JSON_TMP = resolve(ROOT, '.cart-header-fuzz.json');

const STRICT = process.argv.includes('--strict');

const SPECS = [
  'src/pages/products/__tests__/CartShippingDeadlineLayout.test.ts',
  'src/pages/products/__tests__/CartHeaderExhaustiveFuzz.test.ts',
  'src/pages/products/__tests__/CartHeaderEdgeCases.test.ts',
];

const INVARIANTS = [
  { key: 'anchor-right', label: 'Ações ancoradas à direita', re: /ancorad.*direita|justify-end|content-end/i },
  { key: 'no-shrink', label: 'Ações nunca comprimem', re: /nunca comprim|flex-shrink-0/i },
  { key: 'wrap-safe', label: 'Wrap seguro em qualquer viewport', re: /wrap|quebra/i },
  { key: 'gap-progressive', label: 'Gap progressivo por breakpoint', re: /gap progressiv|gap-\d/i },
  { key: 'two-lines', label: 'Prazo em 2 linhas estruturais', re: /2 linhas|flex-col|prazo.*envio/i },
  { key: 'semantic-order', label: 'Ordem semântica empresa→prazo→ações', re: /ordem semântica|empresa.*ações|nesta ordem/i },
  { key: 'a11y', label: 'A11y (label↔input, aria-*)', re: /a11y|label|aria/i },
  { key: 'no-hardcoded-colors', label: 'Sem cores hardcoded', re: /hardcoded|tokens semânticos|cores/i },
  { key: 'schema-edge', label: 'Schema com valores extremos', re: /extremos|schema|passado|inválido|vazio/i },
  { key: 'badge-error-xor', label: 'Badge XOR erro (mutuamente exclusivos)', re: /XOR|mutuamente|badge.*error/i },
  { key: 'status-transitions', label: 'Transições de status por dia', re: /status|fronteir|dias/i },
];

console.log('▶ Rodando fuzzer com reporter JSON...');
try {
  execSync(
    `bunx vitest run ${SPECS.join(' ')} --reporter=json --outputFile=${JSON_TMP}`,
    { stdio: ['ignore', 'ignore', 'inherit'], cwd: ROOT },
  );
} catch (err) {
  console.error('⚠️  Vitest terminou com código não-zero — relatório ainda será gerado.');
}

if (!existsSync(JSON_TMP)) {
  console.error('❌ JSON de saída não gerado.');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(JSON_TMP, 'utf8'));

// Flatten assertion results
const tests = [];
for (const file of raw.testResults ?? []) {
  for (const t of file.assertionResults ?? []) {
    tests.push({
      file: file.name?.replace(ROOT + '/', '') ?? '?',
      title: t.fullName ?? t.title,
      status: t.status,
      duration: t.duration ?? 0,
    });
  }
}

// Bucketize por invariante
const buckets = new Map(INVARIANTS.map((i) => [i.key, { ...i, tests: [] }]));
const orphans = [];
for (const t of tests) {
  let matched = false;
  for (const inv of INVARIANTS) {
    if (inv.re.test(t.title)) {
      buckets.get(inv.key).tests.push(t);
      matched = true;
      break;
    }
  }
  if (!matched) orphans.push(t);
}

// Agrega totais
const total = tests.length;
const passed = tests.filter((t) => t.status === 'passed').length;
const failed = tests.filter((t) => t.status === 'failed').length;
const skipped = tests.filter((t) => t.status === 'pending' || t.status === 'skipped').length;
const totalMs = tests.reduce((a, t) => a + (t.duration ?? 0), 0);

// Markdown
let md = `# CartHeader — Relatório de Invariantes\n\n`;
md += `_Gerado em ${new Date().toISOString()}_\n\n`;
md += `## Resumo\n\n`;
md += `| Métrica | Valor |\n|---|---|\n`;
md += `| Total de testes | ${total} |\n`;
md += `| ✅ Passou | ${passed} |\n`;
md += `| ❌ Falhou | ${failed} |\n`;
md += `| ⏭️ Pulou | ${skipped} |\n`;
md += `| Tempo total | ${totalMs.toFixed(0)} ms |\n\n`;

md += `## Invariantes cobertas\n\n`;
md += `| # | Invariante | Testes | ✅ | ❌ | Duração |\n|---|---|---|---|---|---|\n`;
[...buckets.values()].forEach((b, i) => {
  const bp = b.tests.filter((t) => t.status === 'passed').length;
  const bf = b.tests.filter((t) => t.status === 'failed').length;
  const bd = b.tests.reduce((a, t) => a + (t.duration ?? 0), 0);
  md += `| ${i + 1} | ${b.label} | ${b.tests.length} | ${bp} | ${bf} | ${bd.toFixed(0)} ms |\n`;
});

if (failed > 0) {
  md += `\n## ❌ Falhas\n\n`;
  for (const t of tests.filter((t) => t.status === 'failed')) {
    md += `- \`${t.file}\` → **${t.title}**\n`;
  }
}

if (orphans.length) {
  md += `\n## ⚠️ Testes sem invariante mapeada (${orphans.length})\n\n`;
  md += `Considere adicionar regex ao array \`INVARIANTS\` deste script:\n\n`;
  for (const t of orphans.slice(0, 20)) md += `- ${t.title}\n`;
}

md += `\n## Especificação de cobertura fuzz\n\n`;
md += `- **Viewports simulados**: 25 (320 → 2560 px)\n`;
md += `- **Estados condicionais**: 80 (logo × items × badge × erro × 5 tamanhos de nome)\n`;
md += `- **Simulações principais**: 25 × 80 = **2000**\n`;
md += `- **Mutações de fonte**: 300 permutações × 13 tokens = 3900 asserts\n`;
md += `- **Simulações de wrap CSS numérico**: 50\n`;
md += `- **Datas fuzz (schema)**: 200 aleatórias em ±400 dias\n`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, md, 'utf8');

console.log(`✅ Relatório em: ${OUT_FILE.replace(ROOT + '/', '')}`);
console.log(`   ${total} testes, ${passed}✅ ${failed}❌ ${skipped}⏭️  em ${totalMs.toFixed(0)}ms`);

if (failed > 0) process.exit(1);
if (STRICT && skipped > 0) {
  console.error(`❌ Strict mode: ${skipped} testes pulados.`);
  process.exit(1);
}
