#!/usr/bin/env node
/**
 * validate-ssot-report.mjs — Valida ssot-report.json contra
 * schemas/ssot-report.schema.json (JSON Schema draft-07).
 *
 * Zero dependências: implementa apenas o subset necessário
 * (type, const, enum, required, additionalProperties, minItems/maxItems,
 * minimum, pattern, format:date-time).
 *
 * Uso:
 *   node scripts/validate-ssot-report.mjs [--file=<path>] [--schema=<path>] [--quiet]
 *
 * Exit codes:
 *   0 — válido
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
const EXPECTED_VERSION = getArg('expected-version', null); // opcional; senão usa const do schema

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

// --- Pré-checagem de versão (mensagem acionável para artefatos legados) ---
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const schemaExpected = schema?.properties?.schemaVersion?.const ?? null;
const expectedVersion = EXPECTED_VERSION ?? schemaExpected;

const versionErrors = [];
if (!('schemaVersion' in (data ?? {}))) {
  versionErrors.push(
    `$.schemaVersion: campo ausente — artefato legado (< 2.0.0). Regere com "node scripts/ssot-report.mjs --out=<path>" na versão atual (${expectedVersion ?? 'desconhecida'}).`,
  );
} else if (typeof data.schemaVersion !== 'string' || !SEMVER_RE.test(data.schemaVersion)) {
  versionErrors.push(`$.schemaVersion: valor ${JSON.stringify(data.schemaVersion)} não é SemVer válido (MAJOR.MINOR.PATCH).`);
} else if (expectedVersion && data.schemaVersion !== expectedVersion) {
  versionErrors.push(
    `$.schemaVersion: esperado ${expectedVersion}, recebido ${data.schemaVersion}. Bump correto via "node scripts/ssot-report-bump.mjs --kind=<major|minor|patch> --reason=\"...\"".`,
  );
}

const errors = [...versionErrors, ...validate(data, schema)];

if (errors.length === 0) {
  if (!QUIET) {
    process.stderr.write(`[validate-ssot-report] ✓ ${FILE} válido contra ${SCHEMA} (v${data.schemaVersion})\n`);
    const summary = {
      schemaVersion: data.schemaVersion,
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
