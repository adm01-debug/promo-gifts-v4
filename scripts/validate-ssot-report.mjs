#!/usr/bin/env node
/**
 * validate-ssot-report.mjs — Valida ssot-report.json contra
 * schemas/ssot-report.schema.json (JSON Schema draft-07), com suporte a
 * VALIDAÇÃO RETROATIVA de artefatos de versões anteriores.
 *
 * Zero dependências: implementa apenas o subset necessário
 * (type, const, enum, required, additionalProperties, minItems/maxItems,
 * minimum, pattern, format:date-time).
 *
 * Uso:
 *   node scripts/validate-ssot-report.mjs [flags]
 *
 * Flags de contrato:
 *   --file=<path>              artefato a validar (default: ssot-report.json)
 *   --schema=<path>            schema "corrente" (default: schemas/ssot-report.schema.json)
 *   --expected-version=X.Y.Z   força um alvo exato (bypassa o const do schema)
 *
 * Flags de compatibilidade retroativa (aceitar versões anteriores):
 *   --compat=<strict|major|any>
 *       strict (default) — exige data.schemaVersion === const do schema
 *       major            — aceita qualquer patch/minor do MESMO MAJOR corrente
 *       any              — aceita qualquer versão dentro da janela min/max
 *   --min-version=X.Y.Z        limite inferior inclusivo (usado com compat!=strict)
 *   --max-version=X.Y.Z        limite superior inclusivo (usado com compat!=strict)
 *   --historical-dir=<path>    diretório de snapshots imutáveis por versão
 *                              (default tenta: schemas/, depois public/schemas/)
 *
 * Diagnóstico:
 *   --quiet                    silencia o resumo em sucesso
 *
 * Exit codes:
 *   0 — válido (contra schema corrente ou contra snapshot histórico compatível)
 *   1 — inválido (imprime lista de erros)
 *   2 — erro de I/O (arquivo/schema ausente ou JSON inválido)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const argv = process.argv.slice(2);
const getArg = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const QUIET = argv.includes('--quiet');
const FILE = resolve(getArg('file', 'ssot-report.json'));
const SCHEMA = resolve(getArg('schema', 'schemas/ssot-report.schema.json'));
const EXPECTED_VERSION = getArg('expected-version', null);
const COMPAT = (getArg('compat', 'strict') || 'strict').toLowerCase();
const MIN_VERSION = getArg('min-version', null);
const MAX_VERSION = getArg('max-version', null);
const HISTORICAL_DIR = getArg('historical-dir', null);

const COMPAT_MODES = new Set(['strict', 'major', 'any']);
if (!COMPAT_MODES.has(COMPAT)) {
  process.stderr.write(`[validate-ssot-report] --compat inválido: ${COMPAT} (use strict|major|any)\n`);
  process.exit(2);
}

function die(code, msg) {
  process.stderr.write(`[validate-ssot-report] ${msg}\n`);
  process.exit(code);
}

if (!existsSync(FILE)) die(2, `arquivo não encontrado: ${FILE}`);
if (!existsSync(SCHEMA)) die(2, `schema não encontrado: ${SCHEMA}`);

let data, schema;
try {
  data = JSON.parse(readFileSync(FILE, 'utf8'));
} catch (e) {
  die(2, `JSON inválido em ${FILE}: ${e.message}`);
}
try {
  schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));
} catch (e) {
  die(2, `Schema inválido em ${SCHEMA}: ${e.message}`);
}

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** @returns {string[]} lista de erros (vazia se válido) */
function validate(value, sch, path = '$') {
  const errs = [];
  if (sch === true) return errs;
  if (sch === false) return [`${path}: schema false`];

  // type
  if (sch.type) {
    const types = Array.isArray(sch.type) ? sch.type : [sch.type];
    const actual =
      value === null
        ? 'null'
        : Array.isArray(value)
          ? 'array'
          : Number.isInteger(value)
            ? 'integer'
            : typeof value;
    const ok =
      types.includes(actual) ||
      (types.includes('number') && typeof value === 'number') ||
      (types.includes('integer') && Number.isInteger(value));
    if (!ok) errs.push(`${path}: type esperado ${types.join('|')}, recebido ${actual}`);
  }

  // const
  if ('const' in sch && value !== sch.const) {
    errs.push(`${path}: const esperado ${JSON.stringify(sch.const)}, recebido ${JSON.stringify(value)}`);
  }

  // enum
  if (Array.isArray(sch.enum) && !sch.enum.includes(value)) {
    errs.push(`${path}: enum ${JSON.stringify(sch.enum)} não contém ${JSON.stringify(value)}`);
  }

  // string constraints
  if (typeof value === 'string') {
    if (sch.pattern && !new RegExp(sch.pattern).test(value)) {
      errs.push(`${path}: string não casa com pattern ${sch.pattern}`);
    }
    if (sch.format === 'date-time' && !ISO_DATE_TIME.test(value)) {
      errs.push(`${path}: string não é date-time ISO-8601`);
    }
  }

  // number constraints
  if (typeof value === 'number') {
    if (typeof sch.minimum === 'number' && value < sch.minimum) {
      errs.push(`${path}: ${value} < minimum ${sch.minimum}`);
    }
    if (typeof sch.maximum === 'number' && value > sch.maximum) {
      errs.push(`${path}: ${value} > maximum ${sch.maximum}`);
    }
  }

  // arrays
  if (Array.isArray(value)) {
    if (typeof sch.minItems === 'number' && value.length < sch.minItems) {
      errs.push(`${path}: length ${value.length} < minItems ${sch.minItems}`);
    }
    if (typeof sch.maxItems === 'number' && value.length > sch.maxItems) {
      errs.push(`${path}: length ${value.length} > maxItems ${sch.maxItems}`);
    }
    if (sch.items) {
      value.forEach((v, i) => errs.push(...validate(v, sch.items, `${path}[${i}]`)));
    }
  }

  // objects
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(sch.required)) {
      for (const key of sch.required) {
        if (!(key in value)) errs.push(`${path}: propriedade obrigatória ausente: ${key}`);
      }
    }
    if (sch.properties) {
      for (const [k, subSch] of Object.entries(sch.properties)) {
        if (k in value) errs.push(...validate(value[k], subSch, `${path}.${k}`));
      }
    }
    if (sch.additionalProperties === false && sch.properties) {
      const allowed = new Set(Object.keys(sch.properties));
      for (const k of Object.keys(value)) {
        if (!allowed.has(k)) errs.push(`${path}: propriedade não permitida: ${k}`);
      }
    }
  }

  return errs;
}

// --- Pré-checagem de versão + resolução de compatibilidade retroativa ---
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const cmpSemver = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
const schemaExpected = schema?.properties?.schemaVersion?.const ?? null;
const targetVersion = EXPECTED_VERSION ?? schemaExpected;

// Localiza um snapshot histórico de schema para a versão pedida.
// Ordem de busca:
//   1) --historical-dir=<path> (se fornecido)
//   2) schemas/ssot-report.v<X.Y.Z>.schema.json (source of truth)
//   3) public/schemas/ssot-report.v<X.Y.Z>.schema.json (mirror publicado)
function locateHistoricalSchema(version) {
  const candidates = [];
  if (HISTORICAL_DIR) candidates.push(resolve(HISTORICAL_DIR, `ssot-report.v${version}.schema.json`));
  candidates.push(resolve(`schemas/ssot-report.v${version}.schema.json`));
  candidates.push(resolve(`public/schemas/ssot-report.v${version}.schema.json`));
  return candidates.find((p) => existsSync(p)) ?? null;
}

// Decide se `dataVersion` é aceitável dado o modo de compat + janela.
function acceptsVersion(dataVersion) {
  if (!targetVersion) return { ok: true, reason: 'sem alvo fixado' };
  if (dataVersion === targetVersion) return { ok: true, reason: 'exato' };
  if (COMPAT === 'strict') {
    return {
      ok: false,
      reason: `compat=strict exige ${targetVersion}, recebido ${dataVersion}. Use --compat=major|any + --min-version/--max-version para aceitar retroativos.`,
    };
  }
  if (MIN_VERSION && cmpSemver(dataVersion, MIN_VERSION) < 0) {
    return { ok: false, reason: `versão ${dataVersion} abaixo de --min-version=${MIN_VERSION}` };
  }
  if (MAX_VERSION && cmpSemver(dataVersion, MAX_VERSION) > 0) {
    return { ok: false, reason: `versão ${dataVersion} acima de --max-version=${MAX_VERSION}` };
  }
  if (COMPAT === 'major') {
    const majT = targetVersion.split('.')[0];
    const majD = dataVersion.split('.')[0];
    if (majT !== majD) {
      return { ok: false, reason: `compat=major exige MAJOR=${majT}, recebido ${dataVersion} (MAJOR=${majD})` };
    }
  }
  return { ok: true, reason: `retroativo aceito sob compat=${COMPAT}` };
}

let activeSchema = schema;
let activeSchemaPath = SCHEMA;
const versionErrors = [];

if (!('schemaVersion' in (data ?? {}))) {
  versionErrors.push(
    `$.schemaVersion: campo ausente — artefato legado (< 2.0.0). Regere com "node scripts/ssot-report.mjs --out=<path>" na versão atual (${targetVersion ?? 'desconhecida'}).`,
  );
} else if (typeof data.schemaVersion !== 'string' || !SEMVER_RE.test(data.schemaVersion)) {
  versionErrors.push(
    `$.schemaVersion: valor ${JSON.stringify(data.schemaVersion)} não é SemVer válido (MAJOR.MINOR.PATCH).`,
  );
} else {
  const verdict = acceptsVersion(data.schemaVersion);
  if (!verdict.ok) {
    versionErrors.push(
      `$.schemaVersion: ${verdict.reason}. Bump correto via "node scripts/ssot-report-bump.mjs --kind=<major|minor|patch> --reason=\"...\"" ou ajuste --compat/--min-version/--max-version.`,
    );
  } else if (data.schemaVersion !== schemaExpected) {
    // Retroativo aceito: carrega snapshot histórico da versão exata do artefato.
    const histPath = locateHistoricalSchema(data.schemaVersion);
    if (!histPath) {
      versionErrors.push(
        `$.schemaVersion: retroatividade aceita para ${data.schemaVersion}, mas snapshot ausente. Esperado em schemas/ssot-report.v${data.schemaVersion}.schema.json ou public/schemas/ (rode "npm run ssot:schema:publish" na versão correspondente).`,
      );
    } else {
      try {
        activeSchema = JSON.parse(readFileSync(histPath, 'utf8'));
        activeSchemaPath = histPath;
      } catch (e) {
        versionErrors.push(`Schema histórico inválido em ${histPath}: ${e.message}`);
      }
    }
  }
}

const errors = [...versionErrors, ...(versionErrors.length ? [] : validate(data, activeSchema))];

if (errors.length === 0) {
  if (!QUIET) {
    const retro = activeSchemaPath !== SCHEMA ? ' [retroativo]' : '';
    process.stderr.write(
      `[validate-ssot-report] ✓ ${FILE} válido contra ${activeSchemaPath} (v${data.schemaVersion})${retro}\n`,
    );
    const summary = {
      schemaVersion: data.schemaVersion,
      schemaUsed: activeSchemaPath,
      compat: COMPAT,
      timestamp: data.timestamp,
      overallOk: data.overallOk,
      gates: data.gates?.map((g) => `${g.label}=${g.ok ? 'ok' : 'fail'}`),
    };
    process.stderr.write(`  ${JSON.stringify(summary)}\n`);
  }
  process.exit(0);
}

process.stderr.write(`[validate-ssot-report] ✗ ${errors.length} erro(s) em ${FILE}:\n`);
for (const e of errors) process.stderr.write(`  - ${e}\n`);
process.exit(1);
