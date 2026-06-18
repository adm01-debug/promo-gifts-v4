/**
 * Testes unitários — useMockupDraft
 *
 * Cobre:
 *   - saveDraft: persiste no localStorage imediatamente
 *   - saveDraft: dispara saveToBackend via debounce após 2s
 *   - loadDraft: prefere backend quando mais recente que localStorage
 *   - loadDraft: prefere localStorage quando mais recente que backend
 *   - loadDraft: cai para localStorage se backend falhar
 *   - saveToBackend: fallback para null IDs em erro FK (23503/409)
 *   - clearDraft: remove de localStorage e chama delete no backend
 *   - retorna estado inicial (isSaving=false, isLoading=true, lastSaved=null)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockupDraftData } from '../useMockupDraft';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// AuthContext — usuário autenticado por padrão
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test-001' } }),
}));

const { mockUpsert, mockUpdate, mockSelect, mockDelete, mockMaybeSingle, mockFrom } = vi.hoisted(
  () => {
    const mockMaybeSingle = vi.fn();
    const mockSelect = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    }));
    const mockUpsert = vi.fn();
    const mockUpdate = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
    }));
    const mockDelete = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
    }));
    const mockFrom = vi.fn((table: string) => {
      if (table === 'mockup_drafts') {
        return { select: mockSelect, upsert: mockUpsert, update: mockUpdate, delete: mockDelete };
      }
      return {};
    });
    return { mockUpsert, mockUpdate, mockSelect, mockDelete, mockMaybeSingle, mockFrom };
  },
);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const T_OLD = '2026-06-01T10:00:00.000Z';
const T_NEW = '2026-06-01T11:00:00.000Z';

function makeDraft(updatedAt = T_OLD): MockupDraftData {
  return {
    productId: 'prod-1',
    productName: 'Caneca',
    techniqueId: 'tec-1',
    techniqueName: 'Serigrafia',
    clientId: 'cli-1',
    clientName: 'João',
    personalizationAreas: [
      {
        id: 'area-1',
        name: 'Frente',
        positionX: 50,
        positionY: 50,
        logoWidth: 10,
        logoHeight: 5,
        logoPreview: null,
      },
    ],
    updatedAt,
  };
}

function localKey(userId = 'user-test-001', draftKey = 'default') {
  return `mockup_draft_v1_${userId}_${draftKey}`;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mockFrom.mockClear();
  mockUpsert.mockClear();
  mockUpdate.mockClear();
  mockMaybeSingle.mockClear();
  mockDelete.mockClear();
  mockSelect.mockClear();

  // Default backend: nenhum draft
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

// ── Estado inicial ────────────────────────────────────────────────────────────
describe('estado inicial', () => {
  it('retorna isSaving=false, isLoading=true, lastSaved=null, error=null', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    const { result } = renderHook(() => useMockupDraft());

    expect(result.current.isSaving).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.lastSaved).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('expõe saveDraft, loadDraft, clearDraft como funções', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    const { result } = renderHook(() => useMockupDraft());

    expect(result.current.saveDraft).toBeTypeOf('function');
    expect(result.current.loadDraft).toBeTypeOf('function');
    expect(result.current.clearDraft).toBeTypeOf('function');
  });
});

// ── saveDraft: localStorage imediato ─────────────────────────────────────────
describe('saveDraft — localStorage', () => {
  it('persiste imediatamente no localStorage', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    const { result } = renderHook(() => useMockupDraft());
    const draft = makeDraft();

    act(() => {
      result.current.saveDraft(draft);
    });

    const stored = JSON.parse(localStorage.getItem(localKey()) || '{}') as MockupDraftData;
    expect(stored.productId).toBe('prod-1');
    expect(stored.productName).toBe('Caneca');
  });

  it('não chama o backend antes do debounce de 2s', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    const { result } = renderHook(() => useMockupDraft());

    act(() => {
      result.current.saveDraft(makeDraft());
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('chama o backend após 2s de debounce', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    const { result } = renderHook(() => useMockupDraft());

    act(() => {
      result.current.saveDraft(makeDraft());
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('debounce: múltiplas chamadas rápidas resultam em um único upsert', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    const { result } = renderHook(() => useMockupDraft());

    act(() => {
      result.current.saveDraft(makeDraft());
      result.current.saveDraft(makeDraft());
      result.current.saveDraft(makeDraft());
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

// ── saveToBackend: fallback FK ────────────────────────────────────────────────
describe('saveToBackend — fallback FK (23503)', () => {
  it('tenta upsert normal primeiro', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    mockUpsert.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useMockupDraft());

    act(() => {
      result.current.saveDraft(makeDraft());
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('ao receber erro 23503 (FK violation), chama update com IDs nulos', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    mockUpsert.mockResolvedValueOnce({ error: { code: '23503', message: 'fk violation' } });

    // update retorna sem erro
    const mockUpdateChain = { eq: vi.fn().mockReturnThis() };
    mockUpdateChain.eq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue(mockUpdateChain);

    const { result } = renderHook(() => useMockupDraft());
    act(() => {
      result.current.saveDraft(makeDraft());
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateCall.product_id).toBeNull();
    expect(updateCall.technique_id).toBeNull();
    expect(updateCall.client_id).toBeNull();
    // Dados de texto ainda são preservados
    expect(updateCall.product_name).toBe('Caneca');
  });

  it('ao receber erro 409, também faz fallback', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    mockUpsert.mockResolvedValueOnce({ error: { code: '409', message: 'conflict' } });

    const mockUpdateChain = { eq: vi.fn().mockReturnThis() };
    mockUpdateChain.eq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue(mockUpdateChain);

    const { result } = renderHook(() => useMockupDraft());
    act(() => {
      result.current.saveDraft(makeDraft());
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

// ── loadDraft: prioridade backend vs localStorage ─────────────────────────────
describe('loadDraft — prioridade de dados', () => {
  it('retorna dados do backend quando mais recente', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');

    // localStorage com timestamp antigo
    localStorage.setItem(localKey(), JSON.stringify(makeDraft(T_OLD)));

    // backend com timestamp novo
    mockMaybeSingle.mockResolvedValue({
      data: {
        product_id: 'prod-backend',
        product_name: 'Copo Backend',
        technique_id: 'tec-b',
        technique_name: 'Digital',
        client_id: 'cli-b',
        client_name: 'Maria',
        personalization_areas: [],
        logo_data: null,
        updated_at: T_NEW,
      },
      error: null,
    });

    const { result } = renderHook(() => useMockupDraft());
    let draft: MockupDraftData | null = null;

    await act(async () => {
      draft = await result.current.loadDraft();
    });

    expect(draft?.productId).toBe('prod-backend');
    expect(draft?.productName).toBe('Copo Backend');
  });

  it('retorna dados do localStorage quando mais recente', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');

    // localStorage com timestamp novo
    localStorage.setItem(localKey(), JSON.stringify(makeDraft(T_NEW)));

    // backend com timestamp antigo
    mockMaybeSingle.mockResolvedValue({
      data: {
        product_id: 'prod-old',
        product_name: 'Produto Antigo',
        technique_id: null,
        technique_name: null,
        client_id: null,
        client_name: null,
        personalization_areas: [],
        logo_data: null,
        updated_at: T_OLD,
      },
      error: null,
    });

    const { result } = renderHook(() => useMockupDraft());
    let draft: MockupDraftData | null = null;

    await act(async () => {
      draft = await result.current.loadDraft();
    });

    expect(draft?.productId).toBe('prod-1');
  });

  it('retorna dados do localStorage se backend retornar erro', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');

    localStorage.setItem(localKey(), JSON.stringify(makeDraft(T_OLD)));
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const { result } = renderHook(() => useMockupDraft());
    let draft: MockupDraftData | null = null;

    await act(async () => {
      draft = await result.current.loadDraft();
    });

    expect(draft?.productName).toBe('Caneca');
  });

  it('retorna null quando não há dados em nenhum lugar', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useMockupDraft());
    let draft: MockupDraftData | null | undefined;

    await act(async () => {
      draft = await result.current.loadDraft();
    });

    expect(draft).toBeNull();
  });

  it('seta isLoading=false após loadDraft completar', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useMockupDraft());

    await act(async () => {
      await result.current.loadDraft();
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// ── clearDraft ────────────────────────────────────────────────────────────────
describe('clearDraft', () => {
  it('remove do localStorage', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');
    localStorage.setItem(localKey(), JSON.stringify(makeDraft()));

    const { result } = renderHook(() => useMockupDraft());

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(localStorage.getItem(localKey())).toBeNull();
  });

  it('chama delete no Supabase para o user_id e draft_key corretos', async () => {
    const { useMockupDraft } = await import('../useMockupDraft');

    const eqMock = vi.fn().mockReturnThis();
    mockDelete.mockReturnValue({ eq: eqMock });

    const { result } = renderHook(() => useMockupDraft());

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-test-001');
    expect(eqMock).toHaveBeenCalledWith('draft_key', 'default');
  });
});
