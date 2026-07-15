import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SCRIPT = 'scripts/ssot-report-markdown.mjs';

let TMP: string;
beforeAll(() => {
  TMP = mkdtempSync(join(tmpdir(), 'ssot-md-'));
});

function baseReport(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '2.0.0',
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
      { label: 'validate-supabase-config', cmd: 'node a', exitCode: 0, ok: true, durationMs: 42, stdout: 'ok', stderr: '' },
      { label: 'guard-canonical-project', cmd: 'node b', exitCode: 0, ok: true, durationMs: 88, stdout: '', stderr: '' },
      { label: 'check-docs-supabase-hosts', cmd: 'node c', exitCode: 0, ok: true, durationMs: 17, stdout: '', stderr: '' },
    ],
    ...overrides,
  };
}

function runFromFile(json: unknown) {
  const file = join(TMP, `r-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(json));
  return spawnSync('node', [SCRIPT, `--in=${file}`], { encoding: 'utf8' });
}

describe('ssot-report-markdown.mjs', () => {
  it('renderiza PASS quando overallOk=true e exit 0', () => {
    const r = runFromFile(baseReport());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('# SSOT Report');
    expect(r.stdout).toContain('🟢 PASS');
    expect(r.stdout).toContain('Gates: **3/3** OK');
    expect(r.stdout).toContain('`schemaVersion`');
    expect(r.stdout).toContain('doufsxqlfjyuvxuezpln');
  });

  it('renderiza FAIL e exit 1 quando overallOk=false, com contagem de falhas', () => {
    const rep = baseReport({
      overallOk: false,
      gates: [
        { label: 'validate-supabase-config', ok: false, exitCode: 1, durationMs: 42 },
        { label: 'guard-canonical-project', ok: true, exitCode: 0, durationMs: 88 },
        { label: 'check-docs-supabase-hosts', ok: true, exitCode: 0, durationMs: 17 },
      ],
      details: [
        { label: 'validate-supabase-config', cmd: 'node a', exitCode: 1, ok: false, durationMs: 42, stdout: '', stderr: 'Error: forbidden project id\nfailed check' },
        { label: 'guard-canonical-project', cmd: 'node b', exitCode: 0, ok: true, durationMs: 88, stdout: '', stderr: '' },
        { label: 'check-docs-supabase-hosts', cmd: 'node c', exitCode: 0, ok: true, durationMs: 17, stdout: '', stderr: '' },
      ],
    });
    const r = runFromFile(rep);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('🔴 FAIL');
    expect(r.stdout).toContain('Falhas: **1**');
    expect(r.stdout).toMatch(/Linhas de erro detectadas: \*\*2\*\*/);
    // gate falhado abre <details open>
    expect(r.stdout).toContain('<details open>');
    expect(r.stdout).toContain('Error: forbidden project id');
  });

  it('grava em --out e mantém stdout vazio', () => {
    const out = join(TMP, 'out.md');
    const file = join(TMP, 'in.json');
    writeFileSync(file, JSON.stringify(baseReport()));
    const r = spawnSync('node', [SCRIPT, `--in=${file}`, `--out=${out}`], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(existsSync(out)).toBe(true);
    const md = readFileSync(out, 'utf8');
    expect(md).toContain('# SSOT Report');
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('Escrito:');
  });

  it('aceita JSON via stdin', () => {
    const r = spawnSync('node', [SCRIPT], { encoding: 'utf8', input: JSON.stringify(baseReport()) });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('# SSOT Report');
  });

  it('exit 2 quando JSON é inválido', () => {
    const file = join(TMP, 'bad.json');
    writeFileSync(file, '{not json');
    const r = spawnSync('node', [SCRIPT, `--in=${file}`], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('JSON inválido');
  });

  it('escapa pipes e code fences do stderr para não quebrar markdown', () => {
    const rep = baseReport({
      overallOk: false,
      gates: [{ label: 'validate-supabase-config', ok: false, exitCode: 1, durationMs: 1 }],
      details: [{ label: 'validate-supabase-config', cmd: 'node a', exitCode: 1, ok: false, durationMs: 1, stdout: '', stderr: '```error|pipe```' }],
    });
    const r = runFromFile(rep);
    expect(r.status).toBe(1);
    // fence interna neutralizada com zero-width space
    expect(r.stdout).toContain('`\u200b``');
  });

  it('tabela de gates inclui coluna de linhas de erro por gate', () => {
    const r = runFromFile(baseReport());
    expect(r.stdout).toMatch(/\| # \| Gate \| Status \| Exit \| Duração \| Linhas de erro \|/);
  });

  it('reporta 0 gates gracefulmente', () => {
    const r = runFromFile(baseReport({ gates: [], details: [], overallOk: true }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Nenhum gate registrado');
  });
});
