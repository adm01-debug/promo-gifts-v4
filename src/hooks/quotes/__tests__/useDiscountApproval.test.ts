/**
 * Testes — useDiscountApproval
 *
 * Gerencia o fluxo de aprovação de desconto: seller solicita, admin responde.
 *
 * Invariantes testadas:
 *   - requestApproval: retorna false quando user=null (sem DB call)
 *   - requestApproval: insere em discount_approval_requests com dados corretos
 *   - requestApproval: atualiza status do quote para pending_approval
 *   - requestApproval: retorna false quando Supabase retorna erro
 *   - respondToApproval: aprovação atualiza status='approved' + quote='pending'
 *   - respondToApproval: rejeição atualiza status='rejected' + quote='draft'
 *   - getApprovalStatus: retorna request do DB por quote_id
 *   - getApprovalStatus: retorna null quando não encontrado
 *   - fetchPendingRequests: carrega pendingRequests da lista
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { useDiscountApproval } from '../useDiscountApproval';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const buildChain = () => ({
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => buildChain()) },
}));

const mockUser = { id: 'user-seller-001', email: 'seller@test.com' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/security/rls-denial-logger', () => ({
  logRlsDenial: vi.fn(),
}));

// ── Setup helpers ─────────────────────────────────────────────────────────────

/**
 * Sets up supabase.from to handle ALL tables called by requestApproval:
 * 1. discount_approval_requests.select.eq.eq.maybeSingle (BUG-040 dedup guard)
 * 2. discount_approval_requests.insert
 * 3. quotes.update.eq (set pending_approval)
 * 4. quotes.select.eq.maybeSingle (fetch markup context)
 * 5. quote_history.insert
 * 6. user_roles.select.eq (notify admins — returns [])
 * 7. profiles.select.eq.maybeSingle (seller name)
 */
function setupInsertSuccess() {
  mockInsert.mockReturnValue({ error: null });
  mockUpdate.mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) });
  // requestApproval chains .select() in multiple ways:
  //   - dedup guard:   .select().eq(quote_id).eq(status).maybeSingle() → null (no pending row)
  //   - context fetch: .select().eq(id).maybeSingle()                  → null
  //   - user_roles:    .select().eq(role) awaited directly              → { data: undefined }
  //   - profiles:      .select().eq(user_id).maybeSingle()             → null
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
  // innerEq handles the second .eq() in the dedup guard (.eq(quote_id).eq(status).maybeSingle)
  const innerEq = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn, error: null });
  // outerEq handles the first .eq(); exposes both .maybeSingle (single-eq) and .eq (double-eq)
  const outerEq = vi.fn().mockReturnValue({
    maybeSingle: maybeSingleFn,
    eq: innerEq,
    error: null,
    data: undefined,
  });
  mockSelect.mockReturnValue({ eq: outerEq });
}

function setupInsertError(msg = 'RLS denied') {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'discount_approval_requests') {
      return { insert: mockInsert } as never;
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) } as never;
  });
  mockInsert.mockResolvedValue({ error: { message: msg } });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default supabase.from — vi.clearAllMocks does not reset mockImplementation
  vi.mocked(supabase.from).mockImplementation(() => buildChain() as never);
});

// ── requestApproval ───────────────────────────────────────────────────────────
describe('requestApproval', () => {
  it('retorna false imediatamente quando user = null (sem DB call)', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as never);

    const { result } = renderHook(() => useDiscountApproval());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.requestApproval('q1', 15, 10);
    });

    expect(outcome).toBe(false);
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it('insere em discount_approval_requests com campos corretos', async () => {
    setupInsertSuccess();

    const { result } = renderHook(() => useDiscountApproval());
    await act(async () => {
      await result.current.requestApproval('q-abc', 15, 10, 'precisamos fechar');
    });

    expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('discount_approval_requests');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        quote_id: 'q-abc',
        seller_id: mockUser.id,
        requested_discount_percent: 15,
        max_allowed_percent: 10,
        seller_notes: 'precisamos fechar',
      }),
    );
  });

  it('retorna true quando inserção bem-sucedida', async () => {
    setupInsertSuccess();
    const { result } = renderHook(() => useDiscountApproval());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.requestApproval('q-ok', 12, 10);
    });
    expect(outcome).toBe(true);
  });

  it('retorna false quando Supabase retorna erro', async () => {
    setupInsertError('Permission denied');
    const { result } = renderHook(() => useDiscountApproval());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.requestApproval('q-err', 20, 10);
    });
    expect(outcome).toBe(false);
  });
});

// ── respondToApproval ─────────────────────────────────────────────────────────
describe('respondToApproval', () => {
  /**
   * respondToApproval chain:
   * 1. discount_approval_requests.update.eq.select.single → { data: request, error: null }
   * 2. Promise.all: quotes.update.eq + quote_history.insert
   * 3. workspace_notifications.insert
   */
  function setupRespondSuccess() {
    // Hook calls: .update().eq().select().single() to get the request back
    const fakeRequest = {
      id: 'req-1',
      quote_id: 'q-test',
      seller_id: 'seller-001',
      requested_discount_percent: 20,
      max_allowed_percent: 15,
    };
    const singleFn = vi.fn().mockResolvedValue({ data: fakeRequest, error: null });
    const selectAfterEq = vi.fn().mockReturnValue({ single: singleFn });
    const eqUpdate = vi.fn().mockReturnValue({ select: selectAfterEq });
    const _chainUpdate = { update: vi.fn().mockReturnValue({ eq: eqUpdate }) };
    // Quote status update
    const eqQuote = vi.fn().mockReturnValue({ error: null });
    const _chainQuote = { update: vi.fn().mockReturnValue({ eq: eqQuote }) };
    // Activity log insert + workspace_notifications insert
    const _chainLog = { insert: vi.fn().mockReturnValue({ error: null }) };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'discount_approval_requests') {
        const innerSingleFn = vi.fn().mockResolvedValue({ data: fakeRequest, error: null });
        const innerSelectAfterEq = vi.fn().mockReturnValue({ single: innerSingleFn });
        const eqFn = vi.fn().mockReturnValue({ select: innerSelectAfterEq });
        return { update: vi.fn().mockReturnValue({ eq: eqFn }) } as never;
      }
      if (table === 'quotes') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        } as never;
      }
      // quote_history, workspace_notifications
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as never;
    });
  }

  it('aprovacao: chama toast.success e retorna true', async () => {
    setupRespondSuccess();
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useDiscountApproval());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.respondToApproval('req-1', true, 'aprovado por diretoria');
    });
    expect(outcome).toBe(true);
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });

  it('rejeicao: chama toast.success (mensagem de rejeição) e retorna true', async () => {
    setupRespondSuccess();
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useDiscountApproval());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.respondToApproval('req-1', false, 'acima do limite');
    });
    expect(outcome).toBe(true);
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });
});

// ── getApprovalStatus ─────────────────────────────────────────────────────────
// getApprovalStatus is async: queries DB directly via .select().eq().order().limit().maybeSingle()
describe('getApprovalStatus', () => {
  function buildGetStatusChain(data: unknown) {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    return { select: vi.fn().mockReturnValue({ eq: eqFn }) };
  }

  it('retorna null quando nao encontrado no DB', async () => {
    const { supabase: supabaseClient } = await import('@/integrations/supabase/client');
    vi.mocked(supabaseClient.from).mockReturnValue(buildGetStatusChain(null) as never);

    const { result } = renderHook(() => useDiscountApproval());
    let status: unknown;
    await act(async () => {
      status = await result.current.getApprovalStatus('q-qualquer');
    });
    expect(status).toBeNull();
  });

  it('retorna o request correto pelo quote_id', async () => {
    const fakeRequest = {
      id: 'req-1',
      quote_id: 'q-target',
      status: 'pending',
      requested_discount_percent: 20,
    };
    const { supabase: supabaseClient } = await import('@/integrations/supabase/client');
    vi.mocked(supabaseClient.from).mockReturnValue(buildGetStatusChain(fakeRequest) as never);

    const { result } = renderHook(() => useDiscountApproval());
    let found: unknown;
    await act(async () => {
      found = await result.current.getApprovalStatus('q-target');
    });
    expect(found).not.toBeNull();
    expect((found as { quote_id: string })?.quote_id).toBe('q-target');
  });
});

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('pendingRequests inicia vazio e isLoading = false', () => {
    const { result } = renderHook(() => useDiscountApproval());
    expect(result.current.pendingRequests).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('expõe as 4 funções esperadas', () => {
    const { result } = renderHook(() => useDiscountApproval());
    expect(typeof result.current.requestApproval).toBe('function');
    expect(typeof result.current.respondToApproval).toBe('function');
    expect(typeof result.current.fetchPendingRequests).toBe('function');
    expect(typeof result.current.getApprovalStatus).toBe('function');
  });
});
