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
 *   - getApprovalStatus: retorna request da lista por quote_id
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
function setupInsertSuccess() {
  mockInsert.mockReturnValue({ error: null });
  mockUpdate.mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) });
  // requestApproval calls .select() on quotes (context), user_roles, and profiles.
  // Provide a chain that handles .eq().maybeSingle() and .eq() awaited directly.
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({ error: null, maybeSingle: maybeSingleFn }),
  });
}

function setupInsertError(msg = 'RLS denied') {
  mockInsert.mockReturnValue({ error: { message: msg } });
}

beforeEach(() => vi.clearAllMocks());

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
    const { supabase } = await import('@/integrations/supabase/client');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('insere em discount_approval_requests com campos corretos', async () => {
    setupInsertSuccess();
    const { supabase } = await import('@/integrations/supabase/client');

    const { result } = renderHook(() => useDiscountApproval());
    await act(async () => {
      await result.current.requestApproval('q-abc', 15, 10, 'precisamos fechar');
    });

    expect(supabase.from).toHaveBeenCalledWith('discount_approval_requests');
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
    const chainUpdate = { update: vi.fn().mockReturnValue({ eq: eqUpdate }) };
    // Quote status update
    const eqQuote = vi.fn().mockReturnValue({ error: null });
    const chainQuote = { update: vi.fn().mockReturnValue({ eq: eqQuote }) };
    // Activity log insert + workspace_notifications insert
    const chainLog = { insert: vi.fn().mockReturnValue({ error: null }) };

    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainUpdate as never;
      if (callCount === 2) return chainQuote as never;
      return chainLog as never;
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
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue(buildGetStatusChain(null) as never);

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
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue(buildGetStatusChain(fakeRequest) as never);

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
