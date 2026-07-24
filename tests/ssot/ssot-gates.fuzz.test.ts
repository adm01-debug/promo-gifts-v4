import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Fuzz de cenários para os gates SSOT.
 *
 * Estratégia:
 * - Criamos um sandbox em /tmp com arquivos .md operacionais/informativos.
 * - Executamos `scripts/guard-canonical-project.mjs --docs-only` apontando o CWD
 *   para o sandbox e verificamos exit code + payload JSON.
 *
 * NÃO altera o repo — o guard é isolado por CWD.
 */

const LEGACY = 'pqpdolkaeqlyzpdpbizo';
const CANON = 'doufsxqlfjyuvxuezpln';
const SANDBOX = join(tmpdir(), 'ssot-fuzz-' + Date.now());
const SCRIPT = join(process.cwd(), 'scripts/guard-canonical-project.mjs');

function run(cwd: string) {
  try {
    const out = execFileSync('node', [SCRIPT, '--docs-only', '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status ?? 1, out: err.stdout ?? '' };
  }
}

function writeCase(name: string, content: string) {
  const dir = join(SANDBOX, name.replace(/[^\w]/g, '_'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'doc.md'), content);
  return dir;
}

describe('SSOT gates — fuzz de docs (guard --docs-only)', () => {
  beforeAll(() => {
    if (existsSync(SANDBOX)) rmSync(SANDBOX, { recursive: true });
    mkdirSync(SANDBOX, { recursive: true });
  });
  afterAll(() => {
    if (existsSync(SANDBOX)) rmSync(SANDBOX, { recursive: true });
  });

  const opTemplates = [
    (id: string) => `Execute a migration em https://${id}.supabase.co para aplicar.`,
    (id: string) => `Rodar edge function no projeto ${id}.`,
    (id: string) => `Configure VITE_SUPABASE_URL=https://${id}.supabase.co no CI.`,
    (id: string) => `Deploy contra ${id} imediatamente.`,
    (id: string) => `psql postgresql://postgres@db.${id}.supabase.co:5432/postgres`,
    (id: string) => `supabase link --project-ref ${id}`,
    (id: string) => `Apontar para ${id} na config de produção.`,
    // Obfuscated / edge patterns descobertos no simulador onda 2
    (id: string) => `Usar 'supabase secrets set --project-ref ${id}' agora.`,
    (id: string) => `curl https://${id}.functions.supabase.co/... para invocar`,
    (id: string) => `Rotate token no projeto ${id}`,
    (id: string) => `Alter database em ${id} para adicionar coluna`,
    (id: string) => `Configurar service_role_key do ${id} em produção`,
    (id: string) => `\`${id}\` deve ser o project ref no CLI`,
  ];

  const legacyMarkers = [
    '[LEGACY_INFORMATIVO]',
    'projeto legado (não use)',
    'deprecated — apenas informativo',
    '⚠️ Histórico do incidente',
    'Do not use — reference only',
  ];

  it.each(opTemplates.map((t, i) => [i, t] as const))(
    'cenário OPERACIONAL sem marcador [%s] DEVE falhar',
    (i, template) => {
      const cwd = writeCase(`op-${i}`, template(LEGACY));
      const r = run(cwd);
      expect(r.code, `caso ${i}: ${template(LEGACY)}`).toBe(1);
    },
  );

  it.each(opTemplates.map((t, i) => [i, t] as const))(
    'cenário OPERACIONAL COM marcador legado [%s] deve passar',
    (i, template) => {
      const marker = legacyMarkers[i % legacyMarkers.length];
      const cwd = writeCase(`op-marked-${i}`, `${marker}\n\n${template(LEGACY)}`);
      const r = run(cwd);
      expect(r.code, `caso ${i}`).toBe(0);
    },
  );

  it.each(Array.from({ length: 10 }, (_, i) => i))(
    'doc canônico correto #%s deve passar',
    (i) => {
      const cwd = writeCase(`canon-${i}`, `Deploy em https://${CANON}.supabase.co conforme SSOT.`);
      const r = run(cwd);
      expect(r.code).toBe(0);
    },
  );

  it('ID legado dentro de bloco de código sem instrução operacional passa quando marcado', () => {
    const cwd = writeCase(
      'code-block',
      '⚠️ projeto legado — mostra apenas para referência:\n```\nSUPABASE_URL=https://' +
        LEGACY +
        '.supabase.co\n```',
    );
    expect(run(cwd).code).toBe(0);
  });

  it('menção sem contexto operacional sem marcador ainda bloqueia (unlabeled)', () => {
    const cwd = writeCase('unlabeled', `Referência solta: ${LEGACY}`);
    expect(run(cwd).code).toBe(1);
  });
});
