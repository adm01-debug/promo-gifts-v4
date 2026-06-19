/**
 * Testes — useQuoteTemplates
 *
 * Gerencia templates de orçamento: listagem, criação, atualização, remoção.
 * 408 linhas de lógica com guards de autenticação e permissão de admin.
 *
 * Invariantes:
 *   - Estado inicial: templates=[], loading=true, error=null
 *   - user=null: fetchTemplates define templates=[], loading=false (sem DB call)
 *   - isAdmin=false: fetchAllTemplates define allTemplates=[], sem DB call
 *   - fetchTemplates: chama supabase com order/limit corretos
 *   - Erro de DB: seta error='Erro ao carregar templates'
 *   - Expõe as funções esperadas
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { useQuoteTemplates } from '../useQuoteTemplates';
import { useAuth } from '@/contexts/AuthContext';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const _mockOrder = vi.fn();
const _mockLimit = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: vi
        .fn()
        .mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })),
  },
}));

const mockUser = { id: 'user-001', email: 'seller@test.com' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser, isAdmin: false })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Restaura useAuth: clearAllMocks preserva mockReturnValue entre testes
  vi.mocked(useAuth).mockReturnValue({ user: mockUser, isAdmin: false } as never);
  // Default: DB retorna lista vazia
  const orderFn = vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
  mockSelect.mockReturnValue({ order: orderFn });
  // Restore default user — vi.clearAllMocks() preserves mockReturnValue overrides
  vi.mocked(useAuth).mockReturnValue({ user: mockUser, isAdmin: false } as never);
});

// ── Estado inicial ─────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('expoe as funcoes esperadas', async () => {
    const { result } = renderHook(() => useQuoteTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.fetchTemplates).toBe('function');
    expect(typeof result.current.createTemplate).toBe('function');
    expect(typeof result.current.updateTemplate).toBe('function');
    expect(typeof result.current.deleteTemplate).toBe('function');
    expect(Array.isArray(result.current.templates)).toBe(true);
  });

  it('error = null inicialmente', async () => {
    const { result } = renderHook(() => useQuoteTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});

// ── user=null guard ────────────────────────────────────────────────────────
describe('user=null guard', () => {
  it('fetchTemplates: define templates=[] e loading=false sem chamar DB', async () => {
    const { useAuth: mockedUseAuth } = await import('@/contexts/AuthContext');
    vi.mocked(mockedUseAuth).mockReturnValue({ user: null, isAdmin: false } as never);
    const { supabase: _supabase } = await import('@/integrations/supabase/client');

    const { result } = renderHook(() => useQuoteTemplates());
    await act(async () => {
      await result.current.fetchTemplates();
    });

    expect(result.current.templates).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(_supabase.from).not.toHaveBeenCalled();
  });
});

// ── fetchTemplates ─────────────────────────────────────────────────────────
describe('fetchTemplates', () => {
  beforeEach(async () => {
    const { useAuth: mockedUseAuth } = await import('@/contexts/AuthContext');
    vi.mocked(mockedUseAuth).mockReturnValue({ user: mockUser, isAdmin: false } as never);
  });

  it('carrega templates do DB com order updated_at DESC e limit 200', async () => {
    const mockLimitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
    mockSelect.mockReturnValue({ order: mockOrderFn });
    const { result } = renderHook(() => useQuoteTemplates());
    await act(async () => {
      await result.current.fetchTemplates();
    });

    expect(supabase.from).toHaveBeenCalledWith('quote_templates');
    expect(mockOrderFn).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(mockLimitFn).toHaveBeenCalledWith(200);
  });

  it('seta error quando DB falha', async () => {
    const mockLimitFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB offline' } });
    const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
    mockSelect.mockReturnValue({ order: mockOrderFn });

    const { result } = renderHook(() => useQuoteTemplates());
    await act(async () => {
      await result.current.fetchTemplates();
    });

    expect(result.current.error).toBe('Erro ao carregar templates');
    expect(result.current.loading).toBe(false);
  });

  it('loading: true durante fetch, false ao completar', async () => {
    let resolveQuery!: (val: unknown) => void;
    const pending = new Promise((r) => {
      resolveQuery = r;
    });
    const mockLimitFn = vi.fn().mockReturnValue(pending);
    const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
    mockSelect.mockReturnValue({ order: mockOrderFn });

    const { result } = renderHook(() => useQuoteTemplates());

    // Iniciar fetch sem resolver
    let fetchPromise: Promise<void>;
    act(() => {
      fetchPromise = result.current.fetchTemplates();
    });
    expect(result.current.loading).toBe(true);

    // Resolver
    await act(async () => {
      resolveQuery({ data: [], error: null });
      await fetchPromise;
    });
    expect(result.current.loading).toBe(false);
  });
});

// ── isAdmin guard em fetchAllTemplates ───────────────────────────────────
describe('fetchAllTemplates — isAdmin guard', () => {
  it('nao chama DB quando user nao e admin', async () => {
    const { useAuth: mockedUseAuth } = await import('@/contexts/AuthContext');
    vi.mocked(mockedUseAuth).mockReturnValue({ user: mockUser, isAdmin: false } as never);

    const { result } = renderHook(() => useQuoteTemplates());
    const callsBefore = vi.mocked((await import('@/integrations/supabase/client')).supabase.from)
      .mock.calls.length;
    await act(async () => {
      await result.current.fetchAllTemplates?.();
    });

    // allTemplates permanece vazio (isAdmin=false → guard bloqueia)
    expect(result.current.allTemplates ?? []).toEqual([]);
    // fetchAllTemplates não deve ter adicionado chamadas extras ao DB
    const callsAfter = vi.mocked((await import('@/integrations/supabase/client')).supabase.from)
      .mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });
});
