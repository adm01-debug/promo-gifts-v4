import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function makeReport(details: Array<{ label: string; ok: boolean; exitCode?: number; stderr?: string; stdout?: string; durationMs?: number }>) {
  const dir = mkdtempSync(join(tmpdir(), 'ssot-sum-'));
  const p = join(dir, 'ssot-report.json');
  writeFileSync(
    p,
    JSON.stringify({
      schemaVersion: '2.0.0',
      timestamp: '2026-07-15T00:00:00.000Z',
      canonical: 'CAN',
      forbidden: 'FBD',
      overallOk: details.every((d) => d.ok),
      gates: details.map((d) => ({ label: d.label, ok: d.ok, exitCode: d.exitCode ?? (d.ok ? 0 : 1), durationMs: d.durationMs ?? 10 })),
      details: details.map((d) => ({
        label: d.label,
        cmd: 'x',
        ok: d.ok,
        exitCode: d.exitCode ?? (d.ok ? 0 : 1),
        durationMs: d.durationMs ?? 10,
        stdout: d.stdout ?? '',
        stderr: d.stderr ?? '',
      })),
    }),
  );
  return { path: p, dir };
}

function run(reportPath: string, extraEnv: Record<string, string> = {}) {
  return spawnSync('node', ['scripts/ssot-report-summary.mjs', `--in=${reportPath}`], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

describe('ssot-report-summary', () => {
  it('gera resumo PASS com contagens', () => {
    const { path } = makeReport([
      { label: 'a', ok: true },
      { label: 'b', ok: true },
    ]);
    const r = run(path);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Status geral:.*PASS/);
    expect(r.stdout).toMatch(/Gates:\*\* 2 total · 2 ✅ · 0 ❌/);
    expect(r.stdout).toMatch(/Linhas de erro[^\n]*\b0\b/);
  });

  it('conta linhas de erro em gate falho', () => {
    const { path } = makeReport([
      { label: 'a', ok: true },
      { label: 'guard', ok: false, exitCode: 1, stderr: 'docs/x.md:1: erro\nother line\n\nnpm warn ignorada' },
    ]);
    const r = run(path);
    expect(r.stdout).toMatch(/FAIL/);
    expect(r.stdout).toMatch(/2 total · 1 ✅ · 1 ❌/);
    // 2 linhas úteis (npm warn é ruído filtrado)
    expect(r.stdout).toMatch(/Linhas de erro.*: 2/);
    expect(r.stdout).toMatch(/Primeiras linhas de erro por gate/);
    expect(r.stdout).toMatch(/docs\/x\.md:1: erro/);
  });

  it('anexa em GITHUB_STEP_SUMMARY quando definido', () => {
    const { path, dir } = makeReport([{ label: 'a', ok: true }]);
    const summaryPath = join(dir, 'step-summary.md');
    writeFileSync(summaryPath, '');
    const r = run(path, { GITHUB_STEP_SUMMARY: summaryPath });
    expect(r.status).toBe(0);
    const written = readFileSync(summaryPath, 'utf8');
    expect(written).toMatch(/SSOT Supabase Gates/);
    expect(written).toMatch(/Status geral/);
  });

  it('trata arquivo ausente com aviso', () => {
    const r = run('/tmp/definitely-missing-ssot.json');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/não encontrado/);
  });
});
