/**
 * SSOT do Supabase — valida que:
 *  1. .env.example referencia o projeto canônico (doufsxqlfjyuvxuezpln)
 *  2. client.ts mantém a guarda CURRENT_PROJECT_ID + fallback canônico
 *  3. Em runtime, mesmo com env apontando para projeto externo, o client
 *     resolve para a URL canônica (fallback ativado por config_inconsistency).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const ENV_EXAMPLE = readFileSync(resolve(ROOT, '.env.example'), 'utf-8');
const CLIENT_SRC = readFileSync(
  resolve(ROOT, 'src/integrations/supabase/client.ts'),
  'utf-8',
);

const CANONICAL = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN = 'pqpdolkaeqlyzpdpbizo';

describe('SSOT Supabase — .env.example', () => {
  it('VITE_SUPABASE_URL aponta para o projeto canônico', () => {
    expect(ENV_EXAMPLE).toMatch(
      new RegExp(
        `^VITE_SUPABASE_URL=https://${CANONICAL}\\.supabase\\.co`,
        'm',
      ),
    );
  });

  it('VITE_SUPABASE_PROJECT_ID === canônico', () => {
    expect(ENV_EXAMPLE).toMatch(
      new RegExp(`^VITE_SUPABASE_PROJECT_ID=${CANONICAL}`, 'm'),
    );
  });

  it('não referencia o projeto Lovable (pqp) em VITE_SUPABASE_*', () => {
    const lines = ENV_EXAMPLE.split('\n').filter((l) =>
      l.startsWith('VITE_SUPABASE_'),
    );
    for (const line of lines) {
      expect(line).not.toContain(FORBIDDEN);
    }
  });
});

describe('SSOT Supabase — client.ts (guarda imutável)', () => {
  it('mantém CURRENT_PROJECT_ID = canônico', () => {
    expect(CLIENT_SRC).toMatch(
      new RegExp(`CURRENT_PROJECT_ID\\s*=\\s*"${CANONICAL}"`),
    );
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
  it('client real resolve para URL canônica mesmo com env apontando para pqp', async () => {
    // O setup de teste tipicamente carrega .env.test apontando para pqp.
    // O client.ts deve detectar e usar fallback canônico.
    const mod = await import('../client');
    const url = (mod as { SUPABASE_URL?: string }).SUPABASE_URL;
    if (typeof url === 'string') {
      expect(url).toContain(CANONICAL);
      expect(url).not.toContain(FORBIDDEN);
    } else {
      // Fallback: valida via supabase client interno
      const client = (mod as unknown as { supabase?: { supabaseUrl?: string } }).supabase;
      expect(client?.supabaseUrl ?? '').toContain(CANONICAL);
    }
  });
});
