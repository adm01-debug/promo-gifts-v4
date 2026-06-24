/**
 * Testes — QuoteActionHandlers
 *
 * Invariantes testadas:
 *   - formatCurrency: formata valor em BRL
 *   - calcPersTotal: retorna total_cost diretamente (sem recalcular por qty)
 *   - formatCNPJ: formata 14 dígitos corretamente
 *   - handleSyncBitrix: lança quando Bitrix invoke falha
 *   - handleSyncBitrix: chama setQuote após sync bem-sucedido
 *   - BUG-SYNC-STATUS-SILENT-FAIL: loga warning e não lança quando CRM status update falha
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSyncBitrix, formatCurrency, calcPersTotal, formatCNPJ } from '../QuoteActionHandlers';
import type { Quote } from '@/hooks/quotes';
import type { ProposalTemplateData } from '@/components/pdf/ProposalHtmlTemplate';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// NOTE: vi.mock() factories are hoisted to the top of the file by Vitest.
// We define all vi.fn() stubs inside the factory so they are always available.
// Per-test return values are set in beforeEach via vi.mocked() after dynamic import.

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
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

// Quote with one item that HAS a bitrix_product_id (required for itensSincronizaveis check)
const mockQuote: Quote = {
  id: 'q-001',
  quote_number: 'ORC-001',
  status: 'draft',
  client_id: 'c-001',
  client_name: 'Test Client',
  client_email: 'client@test.com',
  client_phone: null,
  client_company: 'Test Co',
  client_cnpj: null,
  seller_id: 'seller-001',
  subtotal: 100,
  total: 100,
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
      id: 'item-001',
      product_id: 'prod-001',
      product_name: 'Produto Teste',
      product_sku: 'SKU-001',
      product_image_url: null,
      quantity: 10,
      unit_price: 10,
      subtotal: 100,
      color_name: null,
      color_hex: null,
      size_code: null,
      gender: null,
      notes: null,
      sort_order: 0,
      kit_group_id: null,
      kit_name: null,
      bitrix_product_id: 'b-prod-001', // HAS bitrix ID → included in sync
      price_updated_at: null,
      price_freshness_threshold_days: null,
      price_confirmed_at: null,
      personalizations: [],
    },
  ],
} as never;

const mockProposalData: ProposalTemplateData = {
  quoteNumber: 'ORC-001',
  date: '01 de janeiro de 2026',
  validUntil: '30 dias',
  client: { name: 'Test Co' },
  seller: { name: 'Vendedor' },
  items: [],
  subtotal: 100,
  total: 100,
} as never;

const mockSetQuote = vi.fn();
const mockLogQuoteHistory = vi.fn();
const mockSelectCrmById = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();

  const { supabase } = await import('@/integrations/supabase/client');
  const { generateProposalPDFv2 } = await import('@/utils/proposalPdfReactGenerator');

  // Default PDF mock
  vi.mocked(generateProposalPDFv2).mockResolvedValue(
    new Blob(['pdf'], { type: 'application/pdf' }),
  );

  // Default storage mock
  vi.mocked(supabase.storage.from).mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/pdf.pdf' } }),
  } as never);

  // Default Bitrix invoke mock (success)
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { ok: true, result: { quote_id: '999' } },
    error: null,
  });

  // Default DB update mock (success)
  vi.mocked(supabase.from).mockReturnValue({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as never);

  // Supporting mocks
  mockLogQuoteHistory.mockResolvedValue(undefined);
  mockSelectCrmById.mockResolvedValue(null);
});

// ── Utilitários puros ─────────────────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formata valor em BRL', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1.500');
    expect(result).toContain('R$');
  });
});

describe('calcPersTotal', () => {
  it('retorna total_cost diretamente sem recalcular por qty', () => {
    expect(calcPersTotal(300, 10)).toBe(300);
    expect(calcPersTotal(50)).toBe(50);
  });
});

describe('formatCNPJ', () => {
  it('formata 14 dígitos no padrão CNPJ', () => {
    expect(formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('retorna o valor original quando nao tem 14 digitos', () => {
    expect(formatCNPJ('123')).toBe('123');
  });
});

// ── handleSyncBitrix ──────────────────────────────────────────────────────────
describe('handleSyncBitrix', () => {
  it('lanca quando Bitrix invoke retorna error', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Function error' },
    });

    await expect(
      handleSyncBitrix({
        quote: mockQuote,
        proposalData: mockProposalData,
        bitrixCompanyId: 'b-123',
        userEmail: 'seller@test.com',
        logQuoteHistory: mockLogQuoteHistory,
        setQuote: mockSetQuote,
        selectCrmById: mockSelectCrmById,
      }),
    ).rejects.toThrow();
  });

  it('chama setQuote apos sync bem-sucedido', async () => {
    await handleSyncBitrix({
      quote: mockQuote,
      proposalData: mockProposalData,
      bitrixCompanyId: 'b-123',
      userEmail: 'seller@test.com',
      logQuoteHistory: mockLogQuoteHistory,
      setQuote: mockSetQuote,
      selectCrmById: mockSelectCrmById,
    });

    expect(mockSetQuote).toHaveBeenCalled();
  });

  // BUG-SYNC-STATUS-SILENT-FAIL regression:
  // Previously the post-sync DB update used try-catch which never fires on Supabase errors
  // (they resolve with { error }, not throw). The failure was invisible and the optimistic
  // UI update (setQuote) reversed on next page load since the DB was never persisted.
  it('BUG-SYNC-STATUS-SILENT-FAIL: loga warning e nao lanca quando CRM status update falha pos-sync', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    // DB status update fails (RLS denial / network issue)
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'RLS denied' } }),
      }),
    } as never);

    const { logger } = await import('@/lib/logger');

    // Should NOT throw — the Bitrix sync succeeded; the DB write-back is non-fatal
    await expect(
      handleSyncBitrix({
        quote: mockQuote,
        proposalData: mockProposalData,
        bitrixCompanyId: 'b-123',
        userEmail: 'seller@test.com',
        logQuoteHistory: mockLogQuoteHistory,
        setQuote: mockSetQuote,
        selectCrmById: mockSelectCrmById,
      }),
    ).resolves.not.toThrow();

    // Warning must be logged so the failure is diagnosable
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('Non-fatal: CRM status/bitrix_id update failed'),
      expect.anything(),
    );

    // setQuote still called — optimistic update is correct (Bitrix side committed)
    expect(mockSetQuote).toHaveBeenCalled();
  });
});
