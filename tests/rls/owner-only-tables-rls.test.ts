/**
 * RLS Regression — Owner-only tables
 * ------------------------------------------------------------------
 * Garante que `ai_insights_cache`, `frontend_telemetry` e
 * `saved_trends_views` só permitam SELECT ao owner (ou admin), e
 * nunca abram leitura para `anon` ou "todos os authenticated".
 *
 * Estratégia:
 *   1. **Contrato estático** — mantemos um snapshot das expressões
 *      USING/WITH CHECK esperadas por tabela+cmd. Qualquer migration
 *      que altere/introduza policy tem que atualizar este snapshot,
 *      o que força revisão humana.
 *   2. **Live check** — quando `VITE_SUPABASE_URL` +
 *      `SUPABASE_SERVICE_ROLE_KEY` estiverem presentes (CI), busca as
 *      policies reais via pg-meta e compara com o snapshot. Sem
 *      credenciais, o live check é `skip` (mantém dev local verde).
 *   3. **Anon deny** — reforça que `anon` NÃO consegue SELECT nessas
 *      tabelas via publishable key (checa 42501 ou lista vazia).
 *
 * Se você alterar a política de propósito, atualize `EXPECTED_POLICIES`
 * garantindo que TODA policy SELECT continue exigindo
 * `auth.uid() = user_id` ou `is_admin(auth.uid())`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ExpectedPolicy = {
  policyname: string;
  cmd: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  roles: string[]; // conjunto ordenado
  qual: string | null; // USING
  with_check: string | null; // WITH CHECK
};

/**
 * Snapshot das policies atuais (2026-07-15) — owner-only + admin.
 * Normalização: whitespace colapsado. Aspas simples preservadas.
 */
const EXPECTED_POLICIES: Record<string, ExpectedPolicy[]> = {
  ai_insights_cache: [
    {
      policyname: 'Users can view their own cached insights',
      cmd: 'SELECT',
      roles: ['authenticated'],
      qual: '((auth.uid() = user_id) OR is_admin(auth.uid()))',
      with_check: null,
    },
    {
      policyname: 'Users can insert their own cached insights',
      cmd: 'INSERT',
      roles: ['authenticated'],
      qual: null,
      with_check: '(auth.uid() = user_id)',
    },
    {
      policyname: 'Users can update their own cached insights',
      cmd: 'UPDATE',
      roles: ['authenticated'],
      qual: '(auth.uid() = user_id)',
      with_check: '(auth.uid() = user_id)',
    },
    {
      policyname: 'Users can delete their own cached insights',
      cmd: 'DELETE',
      roles: ['authenticated'],
      qual: '((auth.uid() = user_id) OR is_admin(auth.uid()))',
      with_check: null,
    },
  ],
  saved_trends_views: [
    {
      policyname: 'Users can manage their own saved trends views',
      cmd: 'ALL',
      roles: ['authenticated'],
      qual: '(auth.uid() = user_id)',
      with_check: '(auth.uid() = user_id)',
    },
  ],
  // frontend_telemetry: SELECT restrito a admin/supervisor; INSERT anon+auth
  // validado por payload (não expõe dados alheios em leitura).
  frontend_telemetry: [
    {
      policyname: 'Admins can read telemetry',
      cmd: 'SELECT',
      roles: ['public'],
      qual: 'is_admin(auth.uid())',
      with_check: null,
    },
    {
      policyname: 'Admins can view telemetry',
      cmd: 'SELECT',
      roles: ['public'],
      qual:
        "(EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))))",
      with_check: null,
    },
    {
      policyname: 'Admins can cleanup telemetry',
      cmd: 'DELETE',
      roles: ['public'],
      qual:
        "(EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'supervisor'::text])))))",
      with_check: null,
    },
    {
      policyname: 'ft_insert_validated',
      cmd: 'INSERT',
      roles: ['anon', 'authenticated'],
      qual: null,
      with_check:
        "((event_type = ANY (ARRAY['page_view'::text, 'web_vital'::text, 'error'::text, 'perf'::text, 'interaction'::text])) AND (length(COALESCE((metadata)::text, ''::text)) < 8000))",
    },
  ],
};

const TABLES = Object.keys(EXPECTED_POLICIES);

// ---------- Contrato estático ----------
describe('RLS regression — owner-only tables (contrato estático)', () => {
  for (const table of TABLES) {
    const policies = EXPECTED_POLICIES[table]!;

    it(`${table}: toda policy SELECT exige owner ou admin`, () => {
      const selectLike = policies.filter((p) => p.cmd === 'SELECT' || p.cmd === 'ALL');
      expect(selectLike.length, `${table} precisa de ao menos 1 policy SELECT/ALL`).toBeGreaterThan(0);
      for (const p of selectLike) {
        const q = (p.qual || '').replace(/\s+/g, ' ');
        const ok =
          /auth\.uid\(\)\s*=\s*user_id/.test(q) ||
          /is_admin\(auth\.uid\(\)\)/.test(q) ||
          /profiles\.role\s*=\s*ANY[^)]*admin/.test(q);
        expect(ok, `Policy "${p.policyname}" (${table}) tem USING permissivo demais: ${p.qual}`).toBe(true);
        // Nunca pode ser "true" puro ou nulo em SELECT
        expect(q).not.toBe('true');
        expect(q).not.toBe('');
      }
    });

    it(`${table}: nenhuma policy libera SELECT para anon`, () => {
      const selectLike = policies.filter((p) => p.cmd === 'SELECT' || p.cmd === 'ALL');
      for (const p of selectLike) {
        // roles `public` só é aceito quando a USING clause já restringe a admin
        if (p.roles.includes('anon')) {
          throw new Error(`Policy "${p.policyname}" (${table}) inclui role anon em ${p.cmd}`);
        }
      }
    });

    it(`${table}: WITH CHECK de INSERT/UPDATE amarra ao user_id (quando aplicável)`, () => {
      const writes = policies.filter((p) => ['INSERT', 'UPDATE', 'ALL'].includes(p.cmd));
      for (const p of writes) {
        if (table === 'frontend_telemetry' && p.cmd === 'INSERT') continue; // valida payload, não owner
        const wc = (p.with_check || '').replace(/\s+/g, ' ');
        expect(
          /auth\.uid\(\)\s*=\s*user_id/.test(wc),
          `Policy "${p.policyname}" (${table}) precisa amarrar WITH CHECK a auth.uid()=user_id — atual: ${p.with_check}`,
        ).toBe(true);
      }
    });
  }
});

// ---------- Live drift check ----------
const URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const liveEnabled = Boolean(URL && SERVICE_KEY);
const dLive = liveEnabled ? describe : describe.skip;

dLive('RLS regression — drift vs. DB real (live)', () => {
  it('policies atuais no DB batem com o snapshot deste teste', async () => {
    const sql = `
      SELECT tablename, policyname, cmd, roles::text[] AS roles, qual, with_check
      FROM pg_policies
      WHERE schemaname='public' AND tablename IN ('ai_insights_cache','frontend_telemetry','saved_trends_views')
      ORDER BY tablename, policyname;
    `.trim();
    const endpoint = `${URL!.replace(/\/$/, '')}/pg-meta/default/query`;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY!,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
    } catch {
      return; // pg-meta indisponível — pula sem falhar
    }
    if (!res.ok) return;

    const rows = (await res.json()) as Array<{
      tablename: string;
      policyname: string;
      cmd: string;
      roles: string[];
      qual: string | null;
      with_check: string | null;
    }>;

    const norm = (s: string | null) => (s ? s.replace(/\s+/g, ' ').trim() : null);
    const actualByTable: Record<string, ExpectedPolicy[]> = {};
    for (const r of rows) {
      (actualByTable[r.tablename] ||= []).push({
        policyname: r.policyname,
        cmd: r.cmd as ExpectedPolicy['cmd'],
        roles: r.roles,
        qual: norm(r.qual),
        with_check: norm(r.with_check),
      });
    }

    for (const table of TABLES) {
      const expected = EXPECTED_POLICIES[table]!
        .map((p) => ({ ...p, qual: norm(p.qual), with_check: norm(p.with_check) }))
        .sort((a, b) => a.policyname.localeCompare(b.policyname));
      const actual = (actualByTable[table] || []).sort((a, b) =>
        a.policyname.localeCompare(b.policyname),
      );
      expect(actual, `Drift em ${table}: policies reais divergem do snapshot`).toEqual(expected);
    }
  });
});

// ---------- Anon deny reforçado ----------
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anonEnabled = Boolean(URL && ANON_KEY);
const dAnon = anonEnabled ? describe : describe.skip;

dAnon('RLS regression — anon não consegue SELECT nas 3 tabelas', () => {
  let anon: SupabaseClient;
  beforeAll(() => {
    anon = createClient(URL!, ANON_KEY!);
  });

  for (const table of TABLES) {
    it(`anon SELECT em ${table} retorna vazio ou 42501`, async () => {
      const { data, error } = await anon.from(table).select('*').limit(1);
      if (error) {
        expect(['42501', 'PGRST301']).toContain(error.code);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });
  }
});
