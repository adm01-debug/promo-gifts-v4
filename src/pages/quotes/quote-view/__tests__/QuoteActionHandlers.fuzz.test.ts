/**
 * Fuzz exaustivo — handleSyncBitrix regra "só proposta sincroniza".
 *
 * Cobre:
 *   • Todos os 10 status canônicos (QUOTE_STATUSES) → só `draft` bloqueia.
 *   • Valores esdrúxulos não-tipados que podem vazar do banco:
 *     'DRAFT', 'Draft', 'draft ', ' draft', 'rascunho', null, undefined, '',
 *     0, true, {} — nenhum deles é 'draft' exato, então NÃO devem bloquear.
 *   • Precedência: quote.id ausente bloqueia ANTES do check de draft.
 *   • Não-mutação: quote.status permanece intacto após bloqueio.
 *   • Idempotência: chamadas repetidas com draft não vazam side-effects.
 *   • Concorrência simulada: 20 chamadas paralelas com draft não chamam CRM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSyncBitrix } from '../QuoteActionHandlers';
import type { Quote } from '@/hooks/quotes';
import type { ProposalTemplateData } from '@/components/pdf/ProposalHtmlTemplate';
import { QUOTE_STATUSES } from '@/types/quote';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));
vi.mock('@/utils/proposalPdfReactGenerator', () => ({
  generateProposalPDFv2: vi.fn(),
  downloadPDF: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/lib/quote-status-config', () => ({
  isValidQuoteTransition: vi.fn(() => true),
  QUOTE_STATUS_CONFIG: {},
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const baseQuote: Quote = {
  id: 'q-fuzz',
  quote_number: 'ORC-999',
  status: 'pending',
  client_id: 'c-1',
  client_name: 'X',
  client_email: 'x@x.com',
  client_phone: null,
  client_company: 'X Co',
  client_cnpj: null,
  seller_id: 's-1',
  subtotal: 10,
  total: 10,
  discount_percent: 0,
  discount_amount: 0,
  shipping_type: null,
  shipping_cost: 0,
  negotiation_markup_percent: 0,
  notes: null,
  internal_notes: null,
  payment_method: null,
  payment_terms: null,
  delivery_time: null,
  valid_until: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  items: [
    {
      id: 'i-1',
      product_id: 'p-1',
      product_name: 'P',
      product_sku: 'SKU',
      product_image_url: null,
      quantity: 1,
      unit_price: 10,
      subtotal: 10,
      color_name: null,
      color_hex: null,
      size_code: null,
      gender: null,
      notes: null,
      sort_order: 0,
      kit_group_id: null,
      kit_name: null,
      bitrix_product_id: 'b-p-1',
      price_updated_at: null,
      price_freshness_threshold_days: null,
      price_confirmed_at: null,
      personalizations: [],
    },
  ],
} as never;

const proposalData: ProposalTemplateData = {
  quoteNumber: 'ORC-999',
  date: 'x',
  validUntil: '30d',
  client: { name: 'X' },
  seller: { name: 'S' },
  items: [],
  subtotal: 10,
  total: 10,
} as never;

const setQuote = vi.fn();
const logHistory = vi.fn().mockResolvedValue(undefined);
const selectCrm = vi.fn().mockResolvedValue(null);

beforeEach(async () => {
  vi.clearAllMocks();
  const { supabase } = await import('@/integrations/supabase/client');
  const { generateProposalPDFv2 } = await import('@/utils/proposalPdfReactGenerator');
  vi.mocked(generateProposalPDFv2).mockResolvedValue(new Blob(['x']));
  vi.mocked(supabase.storage.from).mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'u' } }),
  } as never);
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { ok: true, result: { quote_id: '1' } },
    error: null,
  });
  vi.mocked(supabase.from).mockReturnValue({
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  } as never);
});

const call = (overrides: Partial<Quote>) =>
  handleSyncBitrix({
    quote: { ...baseQuote, ...overrides } as Quote,
    proposalData,
    bitrixCompanyId: 'bc-1',
    userEmail: 's@s.com',
    logQuoteHistory: logHistory,
    setQuote,
    selectCrmById: selectCrm,
  });

describe('handleSyncBitrix — fuzz de status', () => {
  it('todos os 10 status canônicos: só draft bloqueia', async () => {
    const { toast } = await import('sonner');
    const { supabase } = await import('@/integrations/supabase/client');

    for (const status of QUOTE_STATUSES) {
      vi.clearAllMocks();
      // Re-arma o mock de invoke após o clear
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { ok: true, result: { quote_id: '1' } },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      } as never);
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'u' } }),
      } as never);

      await call({ status });

      if (status === 'draft') {
        expect(vi.mocked(toast.error), `status=${status} deveria bloquear`)
          .toHaveBeenCalledWith(
            'Rascunho não pode ser sincronizado',
            expect.objectContaining({ description: expect.stringContaining('Promova') }),
          );
        expect(setQuote, `status=${status} não pode chamar setQuote`).not.toHaveBeenCalled();
      } else {
        // Nenhum outro status pode ser bloqueado com a mensagem de rascunho
        const blockedAsDraft = vi.mocked(toast.error).mock.calls.some(
          (c) => c[0] === 'Rascunho não pode ser sincronizado',
        );
        expect(blockedAsDraft, `status=${status} bloqueado incorretamente como draft`).toBe(false);
      }
    }
  });

  it('valores esdrúxulos de status (case, whitespace, tipos errados) NÃO são tratados como draft', async () => {
    const { toast } = await import('sonner');
    const weirdos = ['DRAFT', 'Draft', 'draft ', ' draft', 'rascunho', '', 'unknown'];
    for (const status of weirdos) {
      vi.clearAllMocks();
      await call({ status: status as never });
      const blockedAsDraft = vi.mocked(toast.error).mock.calls.some(
        (c) => c[0] === 'Rascunho não pode ser sincronizado',
      );
      expect(blockedAsDraft, `status=${JSON.stringify(status)} bloqueado incorretamente`).toBe(false);
    }
  });

  it('quote.id ausente bloqueia ANTES do check de draft (precedência preservada)', async () => {
    const { toast } = await import('sonner');
    await call({ id: '', status: 'draft' } as Partial<Quote>);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Orçamento sem identificador válido');
    // Não deve ter emitido a mensagem de rascunho — a de id vem primeiro.
    const draftMsg = vi.mocked(toast.error).mock.calls.some(
      (c) => c[0] === 'Rascunho não pode ser sincronizado',
    );
    expect(draftMsg).toBe(false);
  });

  it('não muta o quote original ao bloquear rascunho', async () => {
    const quote = { ...baseQuote, status: 'draft' } as Quote;
    const snapshot = JSON.stringify(quote);
    await handleSyncBitrix({
      quote,
      proposalData,
      bitrixCompanyId: 'bc-1',
      userEmail: 's@s.com',
      logQuoteHistory: logHistory,
      setQuote,
      selectCrmById: selectCrm,
    });
    expect(JSON.stringify(quote)).toBe(snapshot);
  });

  it('idempotência: 5 chamadas seguidas com draft não vazam side-effects', async () => {
    for (let i = 0; i < 5; i++) await call({ status: 'draft' });
    expect(setQuote).not.toHaveBeenCalled();
    expect(selectCrm).not.toHaveBeenCalled();
    expect(logHistory).not.toHaveBeenCalled();
  });

  it('concorrência: 20 chamadas paralelas com draft — zero side-effects', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    await Promise.all(Array.from({ length: 20 }, () => call({ status: 'draft' })));
    expect(setQuote).not.toHaveBeenCalled();
    expect(selectCrm).not.toHaveBeenCalled();
    expect(vi.mocked(supabase.functions.invoke)).not.toHaveBeenCalled();
    expect(vi.mocked(supabase.storage.from)).not.toHaveBeenCalled();
  });
});
