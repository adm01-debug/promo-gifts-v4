import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SCHEMA = 'schemas/ssot-report.schema.json';
const VALIDATOR = 'scripts/validate-ssot-report.mjs';

function run(file: string) {
  return spawnSync('node', [VALIDATOR, `--file=${file}`, `--schema=${SCHEMA}`, '--quiet'], {
    encoding: 'utf8',
  });
}

let TMP: string;
beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), 'ssot-schema-'));
});

function validReport() {
  return {
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
      { label: 'validate-supabase-config', cmd: 'node x', exitCode: 0, ok: true, durationMs: 42, stdout: '', stderr: '' },
      { label: 'guard-canonical-project', cmd: 'node y', exitCode: 0, ok: true, durationMs: 88, stdout: '', stderr: '' },
      { label: 'check-docs-supabase-hosts', cmd: 'node z', exitCode: 0, ok: true, durationMs: 17, stdout: '', stderr: '' },
    ],
  };
}

function write(name: string, obj: unknown) {
  const p = join(TMP, name);
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

describe('ssot-report.json — schema', () => {
  it('schema JSON é parseável e draft-07', () => {
    const s = JSON.parse(readFileSync(SCHEMA, 'utf8'));
    expect(s.$schema).toContain('draft-07');
    expect(s.required).toContain('overallOk');
  });

  it('aceita relatório válido', () => {
    const p = write('ok.json', validReport());
    const r = run(p);
    expect(r.status).toBe(0);
  });

  it('rejeita canonical inesperado', () => {
    const bad = { ...validReport(), canonical: 'pqpdolkaeqlyzpdpbizo' };
    const r = run(write('bad-canon.json', bad));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/canonical/);
  });

  it('rejeita forbidden inesperado', () => {
    const bad = { ...validReport(), forbidden: 'outro' };
    const r = run(write('bad-forb.json', bad));
    expect(r.status).toBe(1);
  });

  it('rejeita overallOk não booleano', () => {
    const bad = { ...validReport(), overallOk: 'true' };
    const r = run(write('bad-bool.json', bad));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/overallOk/);
  });

  it('rejeita timestamp fora do ISO-8601', () => {
    const bad = { ...validReport(), timestamp: '15/07/2026' };
    const r = run(write('bad-ts.json', bad));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/timestamp/);
  });

  it('rejeita gates com quantidade diferente de 3', () => {
    const bad = { ...validReport(), gates: validReport().gates.slice(0, 2) };
    const r = run(write('bad-gates-len.json', bad));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/gates/);
  });

  it('rejeita label de gate desconhecido', () => {
    const v = validReport();
    v.gates[0].label = 'gate-novo-nao-listado' as never;
    const r = run(write('bad-label.json', v));
    expect(r.status).toBe(1);
  });

  it('rejeita durationMs negativo', () => {
    const v = validReport();
    v.gates[0].durationMs = -1;
    const r = run(write('bad-dur.json', v));
    expect(r.status).toBe(1);
  });

  it('rejeita propriedade extra em gates[]', () => {
    const v = validReport();
    (v.gates[0] as Record<string, unknown>).extraField = 'x';
    const r = run(write('bad-extra.json', v));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/não permitida/);
  });

  it('rejeita campo obrigatório ausente', () => {
    const v = validReport() as Record<string, unknown>;
    delete v.overallOk;
    const r = run(write('bad-missing.json', v));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/overallOk/);
  });

  it('gera artefato real e valida contra schema', () => {
    const out = join(TMP, 'live.json');
    const r = spawnSync('node', ['scripts/ssot-report.mjs', `--out=${out}`, '--json'], {
      encoding: 'utf8',
    });
    // execução pode falhar (exit 1) mas o arquivo deve ser válido
    expect([0, 1]).toContain(r.status);
    const check = run(out);
    expect(check.status).toBe(0);
  });
});
