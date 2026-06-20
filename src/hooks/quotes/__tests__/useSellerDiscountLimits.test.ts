/**
 * Testes — useSellerDiscountLimits
 *
 * Gerencia limites de desconto por vendedor.
 * Conecta com useDiscountApproval: o limite define quando aprovação é necessária.
 *
 * Invariantes:
 *   - myLimit: null quando user=null (sem DB call)
 *   - myLimit: carregado do DB via maybeSingle() no mount
 *   - setLimit: upsert com user_id, max_discount_percent, set_by, notes
 *   - setLimit: retorna false quando user=null
 *   - setLimit: toast.success quando OK, toast.error quando falha
 *   - deleteLimit: deleta por id, toast.success/error
 *   - fetchAllLimits: carrega lista completa
 *   - estado inicial: limits=[], myLimit=null, isLoading=false
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSellerDiscountLimits } from '../useSellerDiscountLimits';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
      delete: mockDelete,
      eq: mockEq,
      order: mockOrder,
      maybeSingle: mockMaybeSingle,
    })),
  },
}));

const mockUser = { id: 'admin-001', email: 'admin@test.com' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: fetchMyLimit retorna null (sem limite cadastrado)
  mockSelect.mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) });
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockUpsert.mockReturnValue({ error: null });
  mockEq.mockReturnValue({ error: null });
  mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
});

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('limits=[], myLimit=null, isLoading=false', () => {
    const { result } = renderHook(() => useSellerDiscountLimits());
    expect(result.current.limits).toEqual([]);
    expect(result.current.myLimit).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('expõe as 5 funções esperadas', () => {
    const { result } = renderHook(() => useSellerDiscountLimits());
    expect(typeof result.current.fetchAllLimits).toBe('function');
    expect(typeof result.current.fetchMyLimit).toBe('function');
    expect(typeof result.current.setLimit).toBe('function');
    expect(typeof result.current.deleteLimit).toBe('function');
  });
});

// ── fetchMyLimit (auto no mount) ──────────────────────────────────────────────
describe('fetchMyLimit', () => {
  it('carrega myLimit do DB no mount', async () => {
    const eqFn = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: { max_discount_percent: 15 } }),
    });
    mockSelect.mockReturnValue({ eq: eqFn });

    const { result } = renderHook(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBe(15));
  });

  it('myLimit = null quando user nao tem limite cadastrado', async () => {
    const eqFn = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });
    mockSelect.mockReturnValue({ eq: eqFn });

    const { result } = renderHook(() => useSellerDiscountLimits());
    await waitFor(() => expect(mockSelect).toHaveBeenCalled());
    expect(result.current.myLimit).toBeNull();
  });

  it('nao chama DB quando user = null', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as never);
    const { supabase } = await import('@/integrations/supabase/client');

    renderHook(() => useSellerDiscountLimits());
    await new Promise(r => setTimeout(r, 50));
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ── setLimit ──────────────────────────────────────────────────────────────────
describe('setLimit', () => {
  it('chama upsert com campos corretos', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    mockUpsert.mockReturnValue({ error: null });

    const { result } = renderHook(() => useSellerDiscountLimits());
    await act(async () => {
      await result.current.setLimit('seller-abc', 20, 'aprovado pela diretoria');
    });

    expect(supabase.from).toHaveBeenCalledWith('seller_discount_limits');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'seller-abc',
        max_discount_percent: 20,
        set_by: mockUser.id,
        notes: 'aprovado pela diretoria',
      }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });

  it('retorna true e chama toast.success quando OK', async () => {
    mockUpsert.mockReturnValue({ error: null });
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useSellerDiscountLimits());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.setLimit('s1', 15);
    });

    expect(outcome).toBe(true);
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });

  it('retorna false e toast.error quando Supabase falha', async () => {
    mockUpsert.mockReturnValue({ error: { message: 'RLS denied' } });
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useSellerDiscountLimits());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.setLimit('s1', 99);
    });

    expect(outcome).toBe(false);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  it('retorna false quando user = null', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValue({ user: null } as never);

    const { result } = renderHook(() => useSellerDiscountLimits());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.setLimit('s1', 15);
    });

    expect(outcome).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// ── deleteLimit ───────────────────────────────────────────────────────────────
describe('deleteLimit', () => {
  it('retorna true e toast.success quando OK', async () => {
    const mockEqDel = vi.fn().mockResolvedValue({ error: null });
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: mockEqDel }),
      select: mockSelect,
    } as never);
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useSellerDiscountLimits());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.deleteLimit('limit-123');
    });

    expect(outcome).toBe(true);
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });

  it('retorna false e toast.error quando Supabase falha', async () => {
    const mockEqDel = vi.fn().mockResolvedValue({ error: { message: 'forbidden' } });
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: mockEqDel }),
      select: mockSelect,
    } as never);
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useSellerDiscountLimits());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.deleteLimit('limit-999');
    });

    expect(outcome).toBe(false);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });
});
