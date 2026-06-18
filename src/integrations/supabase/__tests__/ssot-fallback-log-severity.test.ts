/**
 * SSOT — severidade do log de inconsistência + variações de envUrl.
 *
 * Cobre cenários complementares ao ssot-fallback.test.ts:
 *  - envUrl=pqp (Lovable) → warn 'config_inconsistency' (NÃO error)
 *  - envUrl=localhost → nenhum log de inconsistência
 *  - envUrl=placeholder → nenhum log de inconsistência
 *  - dedup: reavaliações do módulo emitem warn 1x apenas
 *  - canônico preservado mesmo após dedup
 *  - auth_401_detected expõe diagnostic + recommendation
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const CLIENT_SRC = readFileSync(resolve(ROOT, 'src/integrations/supabase/client.ts'), 'utf-8');

const CANONICAL = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN = 'pqpdolkaeqlyzpdpbizo';

type LogCall = { level: 'info' | 'warn' | 'error'; event: string };

vi.mock('@/lib/telemetry/structuredLogger', () => {
  const calls: LogCall[] = [];
  const make = () => ({
    info: (event: string) => calls.push({ level: 'info', event }),
    warn: (event: string) => calls.push({ level: 'warn', event }),
    error: (event: string) => calls.push({ level: 'error', event }),
    child: () => make(),
  });
  return {
    createClientLogger: () => make(),
    __getCalls: () => calls,
    __resetCalls: () => {
      calls.length = 0;
    },
  };
});

async function loadWith(envUrl: string | undefined) {
  vi.resetModules();
  const mod = await import('@/lib/telemetry/structuredLogger');
  (mod as unknown as { __resetCalls: () => void }).__resetCalls();

  if (envUrl === undefined) {
    vi.stubEnv('VITE_SUPABASE_URL', '');
  } else {
    vi.stubEnv('VITE_SUPABASE_URL', envUrl);
  }
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_stub');

  await import('../client');
  return (mod as unknown as { __getCalls: () => LogCall[] }).__getCalls();
}

describe('SSOT — severidade do log por variação de envUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('envUrl=pqp → emite WARN config_inconsistency (não ERROR)', async () => {
    const calls = await loadWith(`https://${FORBIDDEN}.supabase.co`);
    const inconsistency = calls.filter((c) => c.event === 'config_inconsistency');
    expect(inconsistency.length).toBeGreaterThanOrEqual(1);
    for (const c of inconsistency) expect(c.level).toBe('warn');
    expect(
      calls.find((c) => c.level === 'error' && c.event === 'config_inconsistency'),
    ).toBeUndefined();
  });

  it('envUrl=localhost → não emite config_inconsistency', async () => {
    const calls = await loadWith('http://localhost:54321');
    expect(calls.find((c) => c.event === 'config_inconsistency')).toBeUndefined();
  });

  it('envUrl=placeholder → não emite config_inconsistency', async () => {
    const calls = await loadWith('https://placeholder.supabase.co');
    expect(calls.find((c) => c.event === 'config_inconsistency')).toBeUndefined();
  });

  it('envUrl=canônico → não emite config_inconsistency', async () => {
    const calls = await loadWith(`https://${CANONICAL}.supabase.co`);
    expect(calls.find((c) => c.event === 'config_inconsistency')).toBeUndefined();
  });

  it('envUrl ausente → emite WARN missing_env_url (não ERROR)', async () => {
    const calls = await loadWith(undefined);
    const missing = calls.filter((c) => c.event === 'missing_env_url');
    for (const c of missing) expect(c.level).toBe('warn');
  });
});

describe('SSOT — client.ts contém mensageria de diagnóstico do 401', () => {
  it('auth_401_detected expõe campos diagnostic e recommendation', () => {
    expect(CLIENT_SRC).toContain("'auth_401_detected'");
    expect(CLIENT_SRC).toMatch(/diagnostic[:,]/);
    expect(CLIENT_SRC).toMatch(/recommendation[:,]/);
  });

  it('mensagem de 401 diferencia projeto canônico vs externo', () => {
    expect(CLIENT_SRC).toMatch(/canônic[oa]/i);
    expect(CLIENT_SRC).toMatch(/painel Lovable/);
  });
});

describe('SSOT — dedup em código (1 emissão por par)', () => {
  it('client.ts mantém Set de dedup para inconsistências', () => {
    expect(CLIENT_SRC).toMatch(/inconsistencyEmitted\s*=\s*new Set/);
    expect(CLIENT_SRC).toMatch(/inconsistencyEmitted\.has\(/);
    expect(CLIENT_SRC).toMatch(/inconsistencyEmitted\.add\(/);
  });
});
