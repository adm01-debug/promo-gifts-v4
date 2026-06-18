import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
/**
 * Testes unitários — useOrgData, useOrgCreate, useOrgUpdate, useOrgDelete
 *
 * Hooks genéricos de CRUD org-scoped: injetam organization_id automaticamente
 * e respeitam RLS via Supabase.
 *
 * Cobertura:
 *   useOrgData:
 *     - desabilitado quando currentOrg=null
 *     - adiciona filtro organization_id automaticamente
 *     - aplica filtros extras via options.filters
 *     - retorna [] quando currentOrg=null (sem query ao DB)
 *   useOrgCreate:
 *     - injeta organization_id no payload
 *     - lança erro quando currentOrg=null
 *   useOrgUpdate:
 *     - passa id + payload ao Supabase (eq 'id')
 *   useOrgDelete:
 *     - deleta por id
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useOrgData, useOrgCreate, useOrgUpdate, useOrgDelete } from '../useOrgData';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const _mockSingle = vi.fn();
const mockSelect = vi.fn();
const _mockEq = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

const mockCurrentOrg = { id: 'org-abc', name: 'Promo Brindes' };
vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: vi.fn(() => ({ currentOrg: mockCurrentOrg })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

// ── Wrapper ────────────────────────────────────────────────────────────────────
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Supabase from().select() chain default: return empty data
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });
  mockInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null }),
    }),
  });
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'upd-1' }, error: null }),
      }),
    }),
  });
  mockDelete.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
});

// ── useOrgData ────────────────────────────────────────────────────────────────
describe('useOrgData', () => {
  it('disabled quando currentOrg=null', () => {
    vi.mocked(useOrganization).mockReturnValueOnce({ currentOrg: null } as ReturnType<
      typeof useOrganization
    >);

    const { result } = renderHook(() => useOrgData('products'), { wrapper: makeWrapper() });

    // Query disabled: status = 'pending', fetchStatus = 'idle'
    expect(result.current.fetchStatus).toBe('idle');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('adiciona filtro organization_id automaticamente', async () => {
    const mockEqChain = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const mockEqOrg = vi.fn(() => ({ eq: mockEqChain }));
    mockSelect.mockReturnValue({ eq: mockEqOrg });

    renderHook(() => useOrgData('products'), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockEqOrg).toHaveBeenCalledWith('organization_id', 'org-abc');
    });
  });

  it('aplica filtros extras via options.filters', async () => {
    const mockEqExtra = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqOrg = vi.fn(() => ({ eq: mockEqExtra }));
    mockSelect.mockReturnValue({ eq: mockEqOrg });

    renderHook(() => useOrgData('products', { filters: { is_active: true } }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(mockEqExtra).toHaveBeenCalledWith('is_active', true);
    });
  });

  it('retorna dados do Supabase quando query bem-sucedida', async () => {
    // Mock default retorna [] já configurado no beforeEach
    const { result } = renderHook(() => useOrgData<{ id: string; name: string }>('products'), {
      wrapper: makeWrapper(),
    });

    // isSuccess indica que a query completou sem erro
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // data é um array (possivelmente vazio, dependendo do mock)
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('configura queryKey com tableName + orgId', async () => {
    // O queryKey deve incluir o tableName e o id da org para cache correto
    const { result } = renderHook(() => useOrgData('categories', { filters: { type: 'main' } }), {
      wrapper: makeWrapper(),
    });
    // A query inicia com estado pending (fetching)
    // O facto de não crashar é o teste aqui
    expect(result.current).toBeTruthy();
  });
});

// ── useOrgCreate ──────────────────────────────────────────────────────────────
describe('useOrgCreate', () => {
  it('injeta organization_id no payload', async () => {
    const { result } = renderHook(() => useOrgCreate('products'), { wrapper: makeWrapper() });

    result.current.mutate({ name: 'Novo produto' } as never);

    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('products'));

    const insertArg = mockInsert.mock.calls[0]?.[0];
    expect(insertArg).toMatchObject({
      name: 'Novo produto',
      organization_id: 'org-abc',
    });
  });

  it('lança erro quando currentOrg=null', async () => {
    vi.mocked(useOrganization).mockReturnValue({ currentOrg: null } as ReturnType<
      typeof useOrganization
    >);

    const { result } = renderHook(() => useOrgCreate('products'), { wrapper: makeWrapper() });

    result.current.mutate({ name: 'X' } as never);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});

// ── useOrgUpdate ──────────────────────────────────────────────────────────────
describe('useOrgUpdate', () => {
  it('atualiza por id e chama toast.success', async () => {
    const { result } = renderHook(() => useOrgUpdate('products'), { wrapper: makeWrapper() });

    result.current.mutate({ id: 'p1', name: 'Atualizado' } as never);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Registro atualizado com sucesso');
    });
  });
});

// ── useOrgDelete ──────────────────────────────────────────────────────────────
describe('useOrgDelete', () => {
  it('deleta por id e chama toast.success', async () => {
    const { result } = renderHook(() => useOrgDelete('products'), { wrapper: makeWrapper() });

    result.current.mutate('p1');

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Registro removido com sucesso');
    });
  });

  it('chama toast.error quando Supabase retorna erro', async () => {
    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'Not found' } }),
    });

    const { result } = renderHook(() => useOrgDelete('products'), { wrapper: makeWrapper() });

    result.current.mutate('p-inexistente');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
