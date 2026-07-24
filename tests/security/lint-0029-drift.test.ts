import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function fixture(list: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'lint29-'));
  const p = join(dir, 'lints.json');
  writeFileSync(p, JSON.stringify(list.map((fn) => ({ fn }))));
  return p;
}

function run(fromFile: string) {
  return spawnSync('node', ['scripts/check-lint-0029-drift.mjs', `--from-file=${fromFile}`], {
    encoding: 'utf8',
  });
}

describe('check-lint-0029-drift', () => {
  it('passa quando todos os findings estão na allowlist', () => {
    const p = fixture(['public.has_role(_user_id uuid, _role app_role)', 'public.is_admin()']);
    const r = run(p);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/todos documentados/);
  });

  it('falha quando surge finding novo não documentado', () => {
    const p = fixture([
      'public.has_role(_user_id uuid, _role app_role)',
      'public.nova_funcao_perigosa(param uuid)', // não está na allowlist
    ]);
    const r = run(p);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/nova_funcao_perigosa/);
    expect(r.stderr).toMatch(/NÃO documentados/);
  });

  it('avisa (mas não falha por si só) quando allowlist tem entradas órfãs', () => {
    // Só uma função no DB — resto da allowlist fica órfão.
    const p = fixture(['public.has_role(_user_id uuid, _role app_role)']);
    const r = run(p);
    // Ainda passa (0) porque não há findings NOVOS; drift stale é warning.
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/não existem mais no DB/);
  });
});
