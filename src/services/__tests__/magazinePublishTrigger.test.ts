/**
 * magazineService.publish — contrato pós-trigger `fn_magazine_public_token`.
 *
 * Este teste valida o comportamento ESPERADO após a aplicação da migração
 * `qa/migrations-draft/2026-07-15_magazine_public_token_trigger.sql` no BD
 * Gold (`doufsxqlfjyuvxuezpln`).
 *
 * Contrato coberto:
 *  1) UPDATE status='published' → linha volta do BD com public_token não-nulo
 *     (trigger BEFORE preenche antes do RETURNING).
 *  2) publish() resolve com Magazine.publicToken definido, sem depender de
 *     nenhum fallback client-side (crypto.getRandomValues NÃO deve ser
 *     chamado — se for, é sinal de que o fallback ainda está ativo).
 *  3) Se por qualquer motivo o BD devolver token nulo (trigger ausente ou
 *     revertida), o teste FALHA — isso é o gatilho de regressão que impede
 *     silenciosamente voltar ao estado anterior.
 *
 * O teste NÃO faz roundtrip real com o Gold — ele simula a linha que a
 * trigger produziria. O SQL da trigger é validado no próprio Gold via
 * bloco DO $verify$ da migração + consulta read-only por psql.
 *
 * Enquanto o fallback client-side estiver presente em magazineService.publish
 * (hotfix 2026-07-15 anterior), este teste é SKIPPED via `describe.skip` na
 * primeira linha. Passo 3 do plano remove o skip junto com o fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase in-memory que simula a trigger BEFORE:
// qualquer UPDATE que setar status='published' faz o BD retornar
// public_token = <hex 32> na próxima leitura.
// ---------------------------------------------------------------------------

interface MagRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  title: string;
  subtitle: string | null;
  template_id: string;
  branding: Record<string, unknown>;
  content_settings: Record<string, unknown>;
  page_order: number[] | null;
  status: string;
  public_token: string | null;
  pdf_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const state = vi.hoisted(() => {
  const row: MagRow = {
    id: 'mag_pub_1',
    owner_id: 'u1',
    organization_id: null,
    title: 'Rev',
    subtitle: null,
    template_id: 'editorial-vogue',
    branding: {},
    content_settings: {},
    page_order: null,
    status: 'draft',
    public_token: null,
    pdf_url: null,
    published_at: null,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
    deleted_at: null,
  };
  return {
    row,
    // Flag do cenário: quando true, a "trigger" preenche public_token.
    triggerActive: true,
    randomBytesCalled: false,
  };
});

const builder = vi.hoisted(() => {
  return (table: string) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.is = () => q;
    q.order = () =>
      Promise.resolve({
        data: table === 'magazine_items' ? [] : [state.row],
        error: null,
      });
    q.maybeSingle = () =>
      Promise.resolve({
        data: table === 'magazines' ? state.row : null,
        error: null,
      });
    q.insert = () => Promise.resolve({ error: null });
    q.delete = () => q;
    q.update = (patch: Partial<MagRow>) => {
      // Simula a trigger BEFORE UPDATE OF status.
      if (
        patch.status === 'published' &&
        state.triggerActive &&
        !state.row.public_token
      ) {
        state.row.public_token = 'ab'.repeat(16); // 32 hex chars
      }
      Object.assign(state.row, patch);
      return {
        eq: () => Promise.resolve({ error: null }),
      };
    };
    return q;
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => builder(t) },
}));
vi.mock('@/lib/supabase-untyped', () => ({
  untypedFrom: (t: string) => builder(t),
}));

// Espia crypto.getRandomValues para provar que o fallback NÃO é usado.
beforeEach(() => {
  state.row.status = 'draft';
  state.row.public_token = null;
  state.row.published_at = null;
  state.triggerActive = true;
  state.randomBytesCalled = false;
  const original = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (original) {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((buf) => {
      state.randomBytesCalled = true;
      return original(buf);
    });
  }
});

// import DEPOIS dos mocks
import { magazineService } from '@/services/magazineService';

// Skipped até o passo 3 do plano (remoção do fallback client-side).
// Para ativar: trocar `describe.skip` por `describe`.
describe.skip('publish() — contrato pós-trigger fn_magazine_public_token', () => {
  it('recebe public_token vindo do BD (trigger BEFORE UPDATE)', async () => {
    const result = await magazineService.publish('mag_pub_1');
    expect(result).not.toBeNull();
    expect(result!.publicToken).toMatch(/^[a-f0-9]{32}$/i);
    expect(result!.status).toBe('published');
  });

  it('NÃO usa fallback client-side (crypto.getRandomValues não é chamado)', async () => {
    await magazineService.publish('mag_pub_1');
    expect(
      state.randomBytesCalled,
      'crypto.getRandomValues foi chamado — o fallback client-side ainda está ativo. Remova-o.',
    ).toBe(false);
  });

  it('regressão: se a trigger sumir, o teste falha alto', async () => {
    state.triggerActive = false;
    const result = await magazineService.publish('mag_pub_1');
    // Sem fallback + sem trigger → publicToken fica null. O teste falha
    // aqui de propósito para detectar rollback acidental da trigger.
    expect(result?.publicToken).toBeTruthy();
  });
});
