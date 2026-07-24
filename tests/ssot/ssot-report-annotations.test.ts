import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function run(reportPath: string) {
  return spawnSync('node', ['scripts/ssot-report-annotations.mjs', `--in=${reportPath}`], {
    encoding: 'utf8',
  });
}

function makeReport(details: Array<Partial<{ label: string; ok: boolean; exitCode: number; stdout: string; stderr: string }>>) {
  const dir = mkdtempSync(join(tmpdir(), 'ssot-ann-'));
  const p = join(dir, 'ssot-report.json');
  writeFileSync(
    p,
    JSON.stringify({
      schemaVersion: '2.0.0',
      timestamp: new Date().toISOString(),
      canonical: 'x',
      forbidden: 'y',
      overallOk: details.every((d) => d.ok),
      gates: details.map((d) => ({ label: d.label, ok: d.ok, exitCode: d.exitCode, durationMs: 1 })),
      details: details.map((d) => ({
        label: d.label,
        cmd: 'x',
        exitCode: d.exitCode ?? (d.ok ? 0 : 1),
        ok: !!d.ok,
        durationMs: 1,
        stdout: d.stdout ?? '',
        stderr: d.stderr ?? '',
      })),
    }),
  );
  return p;
}

describe('ssot-report-annotations', () => {
  it('não emite nada quando todos os gates passam', () => {
    const p = makeReport([{ label: 'a', ok: true, exitCode: 0 }]);
    const r = run(p);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/::error/);
  });

  it('extrai file:line:col do stderr', () => {
    const p = makeReport([
      {
        label: 'guard',
        ok: false,
        exitCode: 1,
        stderr: 'docs/README.md:12:3: host proibido detectado',
      },
    ]);
    const r = run(p);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/::error [^:]*file=docs\/README\.md,line=12,col=3::/);
  });

  it('extrai file:line sem col', () => {
    const p = makeReport([
      { label: 'g', ok: false, exitCode: 1, stdout: 'src/foo.ts:42 algo errado' },
    ]);
    const r = run(p);
    expect(r.stdout).toMatch(/file=src\/foo\.ts,line=42/);
  });

  it('emite fallback quando não há file:line', () => {
    const p = makeReport([{ label: 'g', ok: false, exitCode: 2, stderr: 'erro genérico sem path' }]);
    const r = run(p);
    expect(r.stdout).toMatch(/::error title=SSOT gate falhou.*::erro gen/);
    expect(r.stdout).not.toMatch(/file=/);
  });

  it('ignora node_modules e node: internals', () => {
    const p = makeReport([
      {
        label: 'g',
        ok: false,
        exitCode: 1,
        stderr: 'at node_modules/foo/bar.js:1:1\nnode:internal/x:2:2',
      },
    ]);
    const r = run(p);
    expect(r.stdout).not.toMatch(/file=node_modules/);
    expect(r.stdout).not.toMatch(/file=node:/);
  });
});
