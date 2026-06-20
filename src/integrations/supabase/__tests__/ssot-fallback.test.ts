/**
 * SSOT do Supabase — valida que:
 *  1. .env.example referencia o projeto canônico (doufsxqlfjyuvxuezpln)
 *  2. client.ts mantém a guarda CURRENT_PROJECT_ID + fallback canônico
 *  3. Em runtime, mesmo com env apontando para projeto externo, o client
 *     resolve para a URL canônica (fallback ativado por config_inconsistency).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const ENV_EXAMPLE = readFileSync(resolve(ROOT, '.env.example'), 'utf-8');
const CLIENT_SRC = readFileSync(resolve(ROOT, 'src/integrations/supabase/client.ts'), 'utf-8');

const CANONICAL = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN = 'pqpdolkaeqlyzpdpbizo';

describe('SSOT Supabase — .env.example', () => {
  it('VITE_SUPABASE_URL aponta para o projeto canônico', () => {
    expect(ENV_EXAMPLE).toMatch(
      new RegExp(`^VITE_SUPABASE_URL=https://${CANONICAL}\\.supabase\\.co`, 'm'),
    );
  });

  it('VITE_SUPABASE_PROJECT_ID === canônico', () => {
    expect(ENV_EXAMPLE).toMatch(new RegExp(`^VITE_SUPABASE_PROJECT_ID=${CANONICAL}`, 'm'));
  });

  it('não referencia o projeto Lovable (pqp) em VITE_SUPABASE_*', () => {
    const lines = ENV_EXAMPLE.split('\n').filter((l) => l.startsWith('VITE_SUPABASE_'));
    for (const line of lines) {
      expect(line).not.toContain(FORBIDDEN);
    }
  });
});

describe('SSOT Supabase — client.ts (guarda imutável)', () => {
  it('mantém CURRENT_PROJECT_ID = canônico', () => {
    expect(CLIENT_SRC).toMatch(new RegExp(`CURRENT_PROJECT_ID\\s*=\\s*"${CANONICAL}"`));
  });

  it('possui CANONICAL_URL derivada de CURRENT_PROJECT_ID', () => {
    expect(CLIENT_SRC).toMatch(/CANONICAL_URL\s*=\s*`https:\/\/\$\{CURRENT_PROJECT_ID\}/);
  });

  it('emite config_inconsistency quando envUrl difere do canônico', () => {
    expect(CLIENT_SRC).toContain("'config_inconsistency'");
    expect(CLIENT_SRC).toMatch(/!envUrl\.includes\(CURRENT_PROJECT_ID\)/);
  });

  it('expõe is_canonical baseado em SUPABASE_URL.includes(CURRENT_PROJECT_ID)', () => {
    expect(CLIENT_SRC).toMatch(/SUPABASE_URL\.includes\(CURRENT_PROJECT_ID\)/);
  });
});

describe('SSOT Supabase — fallback em runtime', () => {
  // Cada caso reavalia o módulo client.ts do zero (resetModules) com um env
  // diferente, exercitando de fato a lógica validateEnv()→SUPABASE_URL.
  // Sem resetModules o client é cacheado e o env stub não tem efeito.
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadClientUrl(envUrl: string, envKey = 'sb_publishable_externo') {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', envUrl);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', envKey);
    const mod = await import('../client');
    return mod.SUPABASE_URL;
  }

  it('client real (env ambiente) NUNCA resolve para o projeto proibido (pqp); usa canônico fora de dev local', async () => {
    // INVARIANTE SSOT (não negociável): a URL resolvida sob o env ambiente do
    // runner jamais pode apontar para o projeto Lovable (pqp). Em dev local
    // (localhost/127.0.0.1/placeholder) o client mantém a URL local legitimamente
    // — por isso a asserção canônica só vale quando NÃO é dev local.
    const mod = await import('../client');
    const url =
      (mod as { SUPABASE_URL?: string }).SUPABASE_URL ??
      (mod as unknown as { supabase?: { supabaseUrl?: string } }).supabase?.supabaseUrl ??
      '';
    expect(url).not.toContain(FORBIDDEN);
    const isLocalDev =
      url.includes('localhost') || url.includes('127.0.0.1') || url.includes('placeholder');
    if (!isLocalDev) {
      expect(url).toContain(CANONICAL);
      expect(url).not.toContain(FORBIDDEN);
    } else {
      // Fallback: valida via supabase client interno
      const client = (mod as unknown as { supabase?: { supabaseUrl?: string } }).supabase;
      expect(client?.supabaseUrl ?? '').toContain(CANONICAL);

    }
  });

  it('faz fallback para a URL canônica quando env aponta para o projeto Lovable (pqp)', async () => {
    const url = await loadClientUrl(`https://${FORBIDDEN}.supabase.co`);
    expect(url).toContain(CANONICAL);
    expect(url).not.toContain(FORBIDDEN);
  });

  it('faz fallback para a URL canônica quando env aponta para self-hosted externo', async () => {
    const url = await loadClientUrl('https://supabase.atomicabr.com.br');
    expect(url).toContain(CANONICAL);
    expect(url).not.toContain('atomicabr');
  });

  it('mantém a URL canônica quando o env já aponta para o projeto canônico', async () => {
    const url = await loadClientUrl(`https://${CANONICAL}.supabase.co`, CANONICAL);
    expect(url).toContain(CANONICAL);
    expect(url).not.toContain(FORBIDDEN);
  });

  it('aceita localhost como dev legítimo sem vazar o projeto proibido', async () => {
    const url = await loadClientUrl('http://localhost:54321');
    // localhost é dev válido (não força fallback), mas jamais o projeto proibido.
    expect(url).not.toContain(FORBIDDEN);
    expect(url).toContain('localhost');
  });
});