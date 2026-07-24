import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const VALIDATOR = 'scripts/validate-ssot-report.mjs';
const CURRENT_SCHEMA = 'schemas/ssot-report.schema.json';

/**
 * Um snapshot "histórico" v1.5.0 sintético: contrato mais permissivo
 * (aceita label extra 'legacy-gate' e não força os consts canonical/forbidden).
 * Serve para validar que:
 *   1) Retroativo pode ter shape diferente do corrente.
 *   2) Sem snapshot instalado, o validator falha com mensagem acionável.
 *   3) Artefatos v1.5.0 hoje são aceitos SOMENTE via --compat=major|any + janela.
 */
function makeHistoricalSchema(version: string) {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'timestamp', 'overallOk', 'gates'],
    properties: {
      schemaVersion: { type: 'string', const: version, pattern: '^\\d+\\.\\d+\\.\\d+$' },
      timestamp: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$' },
      canonical: { type: 'string' },
      forbidden: { type: 'string' },
      overallOk: { type: 'boolean' },
      gates: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'ok'],
          properties: {
            label: { type: 'string' },
            ok: { type: 'boolean' },
            exitCode: { type: 'integer' },
            durationMs: { type: 'integer', minimum: 0 },
          },
        },
      },
      details: {}, // sem restrição no histórico
    },
  };
}

function historicalReport(version: string) {
  // Artefato v1.5.0 com um label 'legacy-gate' que seria REJEITADO pelo schema
  // atual (enum restrito), mas é ACEITO pelo histórico.
  return {
    schemaVersion: version,
    timestamp: '2026-05-01T10:00:00.000Z',
    canonical: 'doufsxqlfjyuvxuezpln',
    forbidden: 'pqpdolkaeqlyzpdpbizo',
    overallOk: true,
    gates: [
      { label: 'legacy-gate', ok: true, exitCode: 0, durationMs: 10 },
      { label: 'validate-supabase-config', ok: true, exitCode: 0, durationMs: 5 },
    ],
    details: [],
  };
}

function run(file: string, extra: string[] = []) {
  return spawnSync(
    'node',
    [VALIDATOR, `--file=${file}`, `--schema=${CURRENT_SCHEMA}`, '--quiet', ...extra],
    { encoding: 'utf8' },
  );
}

describe('validate-ssot-report — validação retroativa', () => {
  let TMP: string;
  let HIST_DIR: string;
  const OLD = '1.5.0';

  beforeAll(() => {
    TMP = mkdtempSync(join(tmpdir(), 'ssot-retro-'));
    HIST_DIR = join(TMP, 'snapshots');
    mkdirSync(HIST_DIR, { recursive: true });
    writeFileSync(
      join(HIST_DIR, `ssot-report.v${OLD}.schema.json`),
      JSON.stringify(makeHistoricalSchema(OLD), null, 2),
    );
  });

  function write(name: string, obj: unknown) {
    const p = join(TMP, name);
    writeFileSync(p, JSON.stringify(obj));
    return p;
  }

  it('compat=strict (default) rejeita versão anterior', () => {
    const p = write('old.json', historicalReport(OLD));
    const r = run(p);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/compat=strict/);
  });

  it('compat=major com snapshot presente aceita artefato v1.5.0 (label legado)', () => {
    // Assumindo schema corrente MAJOR=2. Como snapshot v1.5.0 é externo,
    // usamos --historical-dir apontando para o tmp.
    // Para que compat=major aceite MAJOR diferente, precisamos usar 'any'.
    // Aqui validamos que 'any' + janela permite MAJOR distinto.
    const p = write('old.json', historicalReport(OLD));
    const r = run(p, [
      '--compat=any',
      `--min-version=${OLD}`,
      `--max-version=${OLD}`,
      `--historical-dir=${HIST_DIR}`,
    ]);
    expect(r.status).toBe(0);
  });

  it('compat=major bloqueia quando MAJOR difere', () => {
    const p = write('old.json', historicalReport(OLD));
    const r = run(p, ['--compat=major', `--historical-dir=${HIST_DIR}`]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/MAJOR/);
  });

  it('compat=any rejeita quando versão está fora de --min-version/--max-version', () => {
    const p = write('old.json', historicalReport(OLD));
    const r = run(p, [
      '--compat=any',
      '--min-version=1.6.0',
      '--max-version=1.9.9',
      `--historical-dir=${HIST_DIR}`,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/abaixo de --min-version/);
  });

  it('compat=any aceita, mas falha com mensagem acionável se snapshot histórico ausente', () => {
    const missing = '1.4.0';
    const p = write('missing.json', historicalReport(missing));
    const r = run(p, [
      '--compat=any',
      `--min-version=${missing}`,
      `--max-version=${missing}`,
      `--historical-dir=${HIST_DIR}`,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(new RegExp(`ssot-report\\.v${missing.replace(/\./g, '\\.')}\\.schema\\.json`));
    expect(r.stderr).toMatch(/ssot:schema:publish|snapshot ausente/);
  });

  it('artefato retroativo INVÁLIDO contra o próprio snapshot ainda é rejeitado', () => {
    const bad = { ...historicalReport(OLD) } as Record<string, unknown>;
    delete bad.gates; // required no snapshot também
    const p = write('bad-old.json', bad);
    const r = run(p, [
      '--compat=any',
      `--min-version=${OLD}`,
      `--max-version=${OLD}`,
      `--historical-dir=${HIST_DIR}`,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/gates/);
  });

  it('artefato corrente segue validando contra o schema corrente (sem regressão)', () => {
    // Não passamos --compat: default strict + version=corrente => usa schema corrente.
    const cur = JSON.parse(readFileSync(CURRENT_SCHEMA, 'utf8')).properties.schemaVersion.const;
    const report = {
      schemaVersion: cur,
      timestamp: '2026-07-15T12:00:00.000Z',
      canonical: 'doufsxqlfjyuvxuezpln',
      forbidden: 'pqpdolkaeqlyzpdpbizo',
      overallOk: true,
      gates: [
        { label: 'validate-supabase-config', ok: true, exitCode: 0, durationMs: 42 },
        { label: 'guard-canonical-project', ok: true, exitCode: 0, durationMs: 88 },
        { label: 'check-docs-supabase-hosts', ok: true, exitCode: 0, durationMs: 17 },
      ],
      details: [
        { label: 'validate-supabase-config', cmd: 'x', exitCode: 0, ok: true, durationMs: 42, stdout: '', stderr: '' },
        { label: 'guard-canonical-project', cmd: 'y', exitCode: 0, ok: true, durationMs: 88, stdout: '', stderr: '' },
        { label: 'check-docs-supabase-hosts', cmd: 'z', exitCode: 0, ok: true, durationMs: 17, stdout: '', stderr: '' },
      ],
    };
    const p = write('current.json', report);
    const r = run(p);
    expect(r.status).toBe(0);
  });

  it('--compat inválido retorna exit 2 (config error)', () => {
    const p = write('cur.json', historicalReport('2.0.0'));
    const r = run(p, ['--compat=potato']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--compat/);
  });

  it('fallback: busca snapshot em public/schemas/ quando --historical-dir não é passado', () => {
    // O snapshot v2.0.0 é publicado por publish-ssot-schema em public/schemas/.
    // Como MAJOR é igual ao corrente, testamos --compat=major sem --historical-dir.
    // O validator deve encontrar o snapshot publicado se a versão for != const,
    // mas quando é IGUAL ao const, usa o corrente sem histórico.
    const cur = JSON.parse(readFileSync(CURRENT_SCHEMA, 'utf8')).properties.schemaVersion.const;
    const report = historicalReport(cur);
    // ajusta gates para conformar ao schema corrente (labels enum + 3 items)
    report.gates = [
      { label: 'validate-supabase-config', ok: true, exitCode: 0, durationMs: 1 },
      { label: 'guard-canonical-project', ok: true, exitCode: 0, durationMs: 1 },
      { label: 'check-docs-supabase-hosts', ok: true, exitCode: 0, durationMs: 1 },
    ];
    (report as Record<string, unknown>).details = report.gates.map((g) => ({
      label: g.label,
      cmd: 'x',
      exitCode: 0,
      ok: true,
      durationMs: 1,
      stdout: '',
      stderr: '',
    }));
    const p = write('same-ver.json', report);
    const r = run(p, ['--compat=major']);
    expect(r.status).toBe(0);
  });
});
