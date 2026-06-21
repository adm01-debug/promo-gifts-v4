/* eslint-disable @typescript-eslint/require-await */
/**
 * Garante o controle do estado do tour de onboarding:
 * - Nenhuma API pública além de `restartTour` permite reabrir o tour
 *   após ele ter sido concluído (`hasCompletedTour=true`).
 * - `restartTour` zera o progresso anterior (currentStep=0, completed_steps=[],
 *   has_completed_tour=false, completed_at=null) tanto em memória quanto na
 *   tabela `user_onboarding` (persistência por usuário).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnboarding } from '../useOnboarding';

const updateEq = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: updateEq }));

const stableUser = { id: 'user-1' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'onb-1',
              user_id: 'user-1',
              has_completed_tour: true,
              current_step: 7,
            },
            error: null,
          }),
        }),
      }),
      update: updateMock,
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

describe('useOnboarding — controle de estado do tour', () => {
  beforeEach(() => {
    updateMock.mockClear();
    updateEq.mockClear();
  });

  it('não mostra o tour quando já foi completado (apenas restartTour reabre)', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasCompletedTour).toBe(true);
    expect(result.current.showTour).toBe(false);
    expect(result.current.currentStep).toBe(7);
  });

  it('restartTour zera o progresso em memória e persiste reset no banco', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.restartTour();
    });

    await waitFor(() => {
      expect(result.current.showTour).toBe(true);
      expect(result.current.hasCompletedTour).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    expect(updateMock).toHaveBeenCalledWith({
      has_completed_tour: false,
      current_step: 0,
      completed_steps: [],
      completed_at: null,
    });
    expect(updateEq).toHaveBeenCalledWith('id', 'onb-1');
  });

  it('expõe apenas restartTour como gatilho público de reabertura', () => {
    const { result } = renderHook(() => useOnboarding());
    const api = result.current;
    expect(typeof api.restartTour).toBe('function');
    // Não deve existir nenhum outro método semântico de "iniciar/abrir" tour
    expect((api as Record<string, unknown>).startTour).toBeUndefined();
    expect((api as Record<string, unknown>).openTour).toBeUndefined();
  });
});
