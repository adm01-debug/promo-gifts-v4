#!/usr/bin/env node
/**
 * publish-ssot-schema.mjs — Espelha schemas/ssot-report.schema.json para public/
 * gerando endpoint estável + snapshot imutável por versão + índice.
 *
 * Saídas geradas (idempotentes):
 *   - public/schemas/ssot-report.schema.json           (sempre a versão corrente)
 *   - public/schemas/ssot-report.v<X.Y.Z>.schema.json  (snapshot imutável)
 *   - public/schemas/versions.json                     (índice consultável)
 *
 * Uso:
 *   node scripts/publish-ssot-schema.mjs           # aplica
 *   node scripts/publish-ssot-schema.mjs --check   # falha se algo estiver stale (CI)
 *   node scripts/publish-ssot-schema.mjs --json    # imprime plano
 *
 * Exit codes: 0 ok / 1 drift em --check / 2 I-O
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

const SRC = 'schemas/ssot-report.schema.json';
const OUT_DIR = 'public/schemas';
const LATEST_OUT = `${OUT_DIR}/ssot-report.schema.json`;
const INDEX_OUT = `${OUT_DIR}/versions.json`;

// URI canônico do contrato. Deve permanecer estável independente do host
// atual — consumidores usam-no como identificador, não necessariamente
// como URL de fetch.
const CANONICAL_ID = 'https://promogifts.com.br/schemas/ssot-report.schema.json';

// Mirrors publicados de onde o schema pode ser buscado (todos servem o mesmo
// artefato bit-a-bit). Adicione novos endpoints aqui — o publisher e o
// validator externo consultam esta lista.
const PUBLIC_ENDPOINTS = [
  'https://promogifts.com.br/schemas/ssot-report.schema.json',
  'https://www.promogifts.com.br/schemas/ssot-report.schema.json',
  'https://https-www-promogifts-com-br.lovable.app/schemas/ssot-report.schema.json',
];

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const JSON_ONLY = argv.includes('--json');

function fail(code, msg) {
  process.stderr.write(`[publish-ssot-schema] ${msg}\n`);
  process.exit(code);
}

if (!existsSync(SRC)) fail(2, `origem ausente: ${SRC}`);

const rawSource = readFileSync(SRC, 'utf8');
let source;
try {
  source = JSON.parse(rawSource);
} catch (e) {
  fail(2, `JSON inválido em ${SRC}: ${e.message}`);
}

const version = source?.properties?.schemaVersion?.const;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail(2, `schema não expõe schemaVersion.const válido: ${JSON.stringify(version)}`);
}

// Payload publicado — carimba $id canônico e uma lista de mirrors sem tocar
// no arquivo fonte. Mantém pretty-print para diff amigável no PR.
const publishedPayload = {
  ...source,
  $id: CANONICAL_ID,
  'x-published': {
    canonical: CANONICAL_ID,
    endpoints: PUBLIC_ENDPOINTS,
    version,
    updatedAt: new Date().toISOString().slice(0, 10),
  },
};
const publishedText = JSON.stringify(publishedPayload, null, 2) + '\n';
const versionedOut = `${OUT_DIR}/ssot-report.v${version}.schema.json`;

// Índice — enumera todos os v<X.Y.Z>.schema.json presentes.
mkdirSync(OUT_DIR, { recursive: true });
const existingVersioned = existsSync(OUT_DIR)
  ? readdirSync(OUT_DIR)
      .filter((f) => /^ssot-report\.v\d+\.\d+\.\d+\.schema\.json$/.test(f))
      .map((f) => f.match(/v(\d+\.\d+\.\d+)/)[1])
  : [];
const versionSet = new Set(existingVersioned);
versionSet.add(version);
const orderedVersions = [...versionSet].sort((a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
});

const indexPayload = {
  canonical: CANONICAL_ID,
  endpoints: PUBLIC_ENDPOINTS,
  latest: version,
  latestPath: '/schemas/ssot-report.schema.json',
  versions: orderedVersions.map((v) => ({
    version: v,
    path: `/schemas/ssot-report.v${v}.schema.json`,
    immutable: true,
  })),
  generatedAt: new Date().toISOString(),
};
const indexText = JSON.stringify(indexPayload, null, 2) + '\n';

// Snapshot imutável — se já existe, DEVE coincidir bit-a-bit com o payload
// atual (caso contrário sinalizamos violação de imutabilidade).
const immutableViolations = [];
if (existsSync(versionedOut)) {
  const existing = readFileSync(versionedOut, 'utf8');
  if (existing !== publishedText) {
    immutableViolations.push(
      `${versionedOut} já existe com conteúdo divergente — snapshot imutável não pode mudar. Bumpe a versão antes de alterar o schema.`,
    );
  }
}

const plan = {
  version,
  canonical: CANONICAL_ID,
  writes: [
    { path: LATEST_OUT, bytes: publishedText.length },
    { path: versionedOut, bytes: publishedText.length, immutable: true },
    { path: INDEX_OUT, bytes: indexText.length },
  ],
  endpoints: PUBLIC_ENDPOINTS,
  immutableViolations,
};

if (immutableViolations.length > 0) {
  for (const v of immutableViolations) process.stderr.write(`[publish-ssot-schema] ✗ ${v}\n`);
  process.exit(1);
}

if (CHECK) {
  const drift = [];
  const cmp = (path, expected) => {
    if (!existsSync(path)) drift.push(`ausente: ${path}`);
    else if (readFileSync(path, 'utf8') !== expected) drift.push(`stale: ${path}`);
  };
  cmp(LATEST_OUT, publishedText);
  cmp(versionedOut, publishedText);
  // Índice: compara ignorando generatedAt (varia por execução).
  if (!existsSync(INDEX_OUT)) drift.push(`ausente: ${INDEX_OUT}`);
  else {
    try {
      const cur = JSON.parse(readFileSync(INDEX_OUT, 'utf8'));
      const norm = (x) => ({ ...x, generatedAt: undefined });
      if (JSON.stringify(norm(cur)) !== JSON.stringify(norm(indexPayload))) drift.push(`stale: ${INDEX_OUT}`);
    } catch {
      drift.push(`inválido: ${INDEX_OUT}`);
    }
  }
  if (drift.length) {
    process.stderr.write(`[publish-ssot-schema] ✗ ${drift.length} drift(s):\n`);
    for (const d of drift) process.stderr.write(`  - ${d}\n`);
    process.stderr.write(`Rode: node scripts/publish-ssot-schema.mjs\n`);
    process.exit(1);
  }
  if (!JSON_ONLY) process.stderr.write(`[publish-ssot-schema] ✓ mirrors em dia (v${version})\n`);
  else process.stdout.write(JSON.stringify({ ok: true, ...plan }, null, 2) + '\n');
  process.exit(0);
}

mkdirSync(dirname(LATEST_OUT), { recursive: true });
writeFileSync(LATEST_OUT, publishedText);
writeFileSync(versionedOut, publishedText);
writeFileSync(INDEX_OUT, indexText);

if (JSON_ONLY) process.stdout.write(JSON.stringify({ ok: true, ...plan }, null, 2) + '\n');
else process.stderr.write(`[publish-ssot-schema] ✓ publicado v${version} → ${OUT_DIR}/\n`);
