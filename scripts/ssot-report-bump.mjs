#!/usr/bin/env node
/**
 * ssot-report-bump.mjs — Bump versionado do contrato ssot-report.json.
 *
 * Atualiza atomicamente:
 *   - schemas/ssot-report.schema.json  ($.properties.schemaVersion.const)
 *   - scripts/ssot-report.mjs          (constante SCHEMA_VERSION)
 *   - schemas/ssot-report.CHANGELOG.md (nova entrada no topo)
 *
 * Uso:
 *   node scripts/ssot-report-bump.mjs --kind=<major|minor|patch> --reason="texto obrigatório" [--dry]
 *
 * Regras:
 *   - --reason é obrigatório (aparece no changelog).
 *   - --kind DEVE ser major | minor | patch.
 *   - Falha se schema e emitter estiverem dessincronizados (sanity check antes do bump).
 *
 * Exit codes:
 *   0 — bump aplicado (ou --dry sem falhas)
 *   1 — argumentos inválidos / dessincronia detectada
 *   2 — erro de I/O
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const SCHEMA_PATH = 'schemas/ssot-report.schema.json';
const EMITTER_PATH = 'scripts/ssot-report.mjs';
const CHANGELOG_PATH = 'schemas/ssot-report.CHANGELOG.md';

const argv = process.argv.slice(2);
const getArg = (name) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const KIND = getArg('kind');
const REASON = getArg('reason');
const DRY = argv.includes('--dry');

const KINDS = new Set(['major', 'minor', 'patch']);

function fail(code, msg) {
  process.stderr.write(`[ssot-report-bump] ${msg}\n`);
  process.exit(code);
}

if (!KIND || !KINDS.has(KIND)) fail(1, `--kind obrigatório e deve ser major|minor|patch (recebido: ${KIND ?? 'ausente'})`);
if (!REASON || REASON.trim().length < 8) fail(1, `--reason obrigatório com pelo menos 8 caracteres explicando o motivo do bump.`);

for (const p of [SCHEMA_PATH, EMITTER_PATH, CHANGELOG_PATH]) {
  if (!existsSync(p)) fail(2, `arquivo ausente: ${p}`);
}

const schemaText = readFileSync(SCHEMA_PATH, 'utf8');
const emitterText = readFileSync(EMITTER_PATH, 'utf8');
const changelogText = readFileSync(CHANGELOG_PATH, 'utf8');

let schema;
try {
  schema = JSON.parse(schemaText);
} catch (e) {
  fail(2, `JSON inválido em ${SCHEMA_PATH}: ${e.message}`);
}

const currentSchemaVersion = schema?.properties?.schemaVersion?.const;
if (typeof currentSchemaVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(currentSchemaVersion)) {
  fail(1, `schema não expõe schemaVersion.const válido: ${JSON.stringify(currentSchemaVersion)}`);
}

const emitterMatch = emitterText.match(/export const SCHEMA_VERSION = '(\d+\.\d+\.\d+)';/);
if (!emitterMatch) fail(1, `emitter (${EMITTER_PATH}) não expõe "export const SCHEMA_VERSION = 'x.y.z';".`);
const currentEmitterVersion = emitterMatch[1];

if (currentSchemaVersion !== currentEmitterVersion) {
  fail(
    1,
    `Dessincronia: schema=${currentSchemaVersion} vs emitter=${currentEmitterVersion}. Corrija manualmente antes de bumpar.`,
  );
}

// Compute next version
const [maj, min, pat] = currentSchemaVersion.split('.').map(Number);
const next =
  KIND === 'major'
    ? `${maj + 1}.0.0`
    : KIND === 'minor'
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${pat + 1}`;

// Apply patches
const newSchema = structuredClone(schema);
newSchema.properties.schemaVersion.const = next;
const newSchemaText = JSON.stringify(newSchema, null, 2) + '\n';

const newEmitterText = emitterText.replace(
  /export const SCHEMA_VERSION = '\d+\.\d+\.\d+';/,
  `export const SCHEMA_VERSION = '${next}';`,
);
if (newEmitterText === emitterText) fail(1, `substituição no emitter não teve efeito (regex mudou?).`);

const today = new Date().toISOString().slice(0, 10);
const marker = '\n## ';
const idx = changelogText.indexOf(marker);
const header =
  idx >= 0 ? changelogText.slice(0, idx + 1) : changelogText.endsWith('\n') ? changelogText : changelogText + '\n';
const tail = idx >= 0 ? changelogText.slice(idx + 1) : '';
const entry = `## ${next} — ${today}\n\nBump ${KIND.toUpperCase()} (de ${currentSchemaVersion}).\n\n${REASON.trim()}\n\n`;
const newChangelogText = `${header}${entry}${tail}`;

const plan = {
  from: currentSchemaVersion,
  to: next,
  kind: KIND,
  reason: REASON.trim(),
  files: [SCHEMA_PATH, EMITTER_PATH, CHANGELOG_PATH],
};

if (DRY) {
  process.stdout.write(JSON.stringify({ dryRun: true, ...plan }, null, 2) + '\n');
  process.exit(0);
}

writeFileSync(SCHEMA_PATH, newSchemaText);
writeFileSync(EMITTER_PATH, newEmitterText);
writeFileSync(CHANGELOG_PATH, newChangelogText);

// Auto-publica os mirrors em public/schemas/ — mantém endpoint estável em dia
// junto com o bump. Falhas aqui só emitem aviso: o gate `publish:check` no CI
// bloqueia PRs com drift, então o commit continua consistente.
try {
  const { spawnSync } = await import('child_process');
  const pub = spawnSync('node', ['scripts/publish-ssot-schema.mjs'], { encoding: 'utf8' });
  if (pub.status !== 0) {
    process.stderr.write(`[ssot-report-bump] ⚠ publish-ssot-schema falhou (exit ${pub.status}):\n${pub.stderr}\n`);
  } else {
    process.stderr.write(`[ssot-report-bump] ✓ mirrors public/schemas/ sincronizados\n`);
  }
} catch (e) {
  process.stderr.write(`[ssot-report-bump] ⚠ não foi possível auto-publicar: ${e.message}\n`);
}

process.stdout.write(JSON.stringify({ ok: true, ...plan }, null, 2) + '\n');
process.stderr.write(
  `[ssot-report-bump] ✓ ${currentSchemaVersion} → ${next} (${KIND}). Commit dedicado + rodar "npm run ssot:report && npm run ssot:report:validate" antes de push.\n`,
);
