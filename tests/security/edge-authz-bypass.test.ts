/**
 * Edge Authorization Bypass Tests
 * --------------------------------------------------------------
 * Para cada edge sensível (categoria supervisor/dev no manifest),
 * tenta invocar:
 *   1. SEM Authorization header  → espera 401
 *   2. COM Bearer inválido       → espera 401
 *
 * Não exercita o caso "user authenticated sem role" porque criar
 * users descartáveis no CI é fluxo separado (ver tests/rls/personas).
 *
 * Habilita-se quando VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 * estão presentes; do contrário roda como skip silencioso.
 */
import { describe, it, expect } from 'vitest';
import {
  EDGE_AUTHZ_MANIFEST,
} from '../../supabase/functions/_shared/edge-authz-manifest';

const URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const ANON = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Habilitar apenas com URL Supabase REAL.
// Em CI sem secrets, tests/setup.ts stuba URL com http://localhost:54321 (fake),
// o que fazia 36 testes tentarem fetch e falharem com fetch failed/ENOTFOUND.
// Em dev local, .env.local pode ter placeholder https://x.supabase.co/ (4 chars key).
// Skip silencioso em todos esses casos.
const isPlaceholderUrl = !URL
  || URL.includes("localhost")
  || URL.includes("127.0.0.1")
  || URL.includes("//x.supabase.co"); // placeholder comum em .env.example
const isPlaceholderKey = !ANON
  || ANON.length < 100
  || ANON.includes(".test.signature");
const enabled = !isPlaceholderUrl && !isPlaceholderKey;
const d = enabled ? describe : describe.skip;

const SENSITIVE = Object.entries(EDGE_AUTHZ_MANIFEST).filter(
  ([, e]) => (e.category === 'supervisor' || e.category === 'dev') && !e.skipAnonBypassTest,
);

d('Edge authz bypass — supervisor/dev sem auth retorna 401', () => {
  for (const [name] of SENSITIVE) {
    it(`${name}: anon sem Authorization → 401`, async () => {
      const res = await fetch(`${URL}/functions/v1/${name}`, {
        method: 'POST',
        headers: { apikey: ANON!, 'Content-Type': 'application/json' },
        body: '{}',
      });
      await res.text(); // drena o corpo
      // Edge runtime do Supabase aplica verify_jwt=true por padrão →
      // sem header Authorization retorna 401. Aceitamos também 403
      // para edges que validem por has_role inline antes do parse.
      expect([401, 403]).toContain(res.status);
    });

    it(`${name}: Bearer inválido → 401`, async () => {
      const res = await fetch(`${URL}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          apikey: ANON!,
          Authorization: 'Bearer invalid.jwt.token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      await res.text();
      expect([401, 403]).toContain(res.status);
    });
  }
});

// Static manifest-integrity assertion (sempre roda — não depende de rede/secrets).
describe('Manifest integrity — generate-mockup', () => {
  it('é "authenticated" (usa authenticateRequest/JWT, não "token público assinado")', () => {
    const e = EDGE_AUTHZ_MANIFEST['generate-mockup'];
    expect(e?.category).toBe('authenticated');
    // skipAnonBypassTest era falso-positivo herdado da categoria "public" incorreta:
    // a função SEMPRE exige JWT, então não deve dispensar o teste de bypass anônimo.
    expect(e?.skipAnonBypassTest).not.toBe(true);
  });
});
