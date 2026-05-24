/**
 * Testes do kill-switch client (camada front-end).
 *
 * Cenários cobertos:
 *   1. Cache em memória entrega resposta sem hit em rede
 *   2. localStorage entrega quando memória estiver fria
 *   3. Network entrega + popula caches
 *   4. Fail-open quando consulta falha
 *   5. Fail-open quando switch não existe na tabela
 *   6. invalidateKillSwitchCache limpa ambos os caches
 *   7. KillSwitchActiveError tem switchName + message
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getKillSwitchState,
  invalidateKillSwitchCache,
  KillSwitchActiveError,
} from '../kill-switch-client';

// Mock do cliente Supabase
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const SWITCH = 'edge_external_db_bridge';

describe('kill-switch-client', () => {
  beforeEach(() => {
    invalidateKillSwitchCache(SWITCH);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    mockMaybeSingle.mockReset();
    mockEq.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  afterEach(() => {
    invalidateKillSwitchCache(SWITCH);
  });

  it('retorna network quando primeira consulta + popula memória', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { enabled: true, legacy_message: null },
      error: null,
    });

    const state = await getKillSwitchState(SWITCH);
    expect(state.enabled).toBe(true);
    expect(state.source).toBe('network');
    expect(mockFrom).toHaveBeenCalledWith('system_kill_switches');

    // Segunda chamada deve vir de memória
    const state2 = await getKillSwitchState(SWITCH);
    expect(state2.source).toBe('memory');
    expect(state2.enabled).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('retorna disabled com legacy_message quando switch OFF', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { enabled: false, legacy_message: 'Migrar para REST nativo' },
      error: null,
    });

    const state = await getKillSwitchState(SWITCH);
    expect(state.enabled).toBe(false);
    expect(state.message).toBe('Migrar para REST nativo');
    expect(state.source).toBe('network');
  });

  it('fail-open quando consulta retorna error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'network down', code: '500' },
    });

    const state = await getKillSwitchState(SWITCH);
    // Crítico: erro NÃO bloqueia (fail-open). Back-end ainda decide.
    expect(state.enabled).toBe(true);
    expect(state.source).toBe('fail-open');
  });

  it('fail-open quando switch não cadastrado (data null)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const state = await getKillSwitchState(SWITCH);
    expect(state.enabled).toBe(true);
    expect(state.source).toBe('fail-open');
  });

  it('fail-open quando supabase.from lança exceção', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('client crashed');
    });

    const state = await getKillSwitchState(SWITCH);
    expect(state.enabled).toBe(true);
    expect(state.source).toBe('fail-open');
  });

  it('invalidateKillSwitchCache força nova consulta de rede', async () => {
    // Primeira consulta: switch ON
    mockMaybeSingle.mockResolvedValueOnce({
      data: { enabled: true, legacy_message: null },
      error: null,
    });
    await getKillSwitchState(SWITCH);

    // Segunda consulta deveria ser cache
    const cached = await getKillSwitchState(SWITCH);
    expect(cached.source).toBe('memory');

    // Invalida
    invalidateKillSwitchCache(SWITCH);

    // Próxima deve ir à rede e ler novo estado (OFF)
    mockMaybeSingle.mockResolvedValueOnce({
      data: { enabled: false, legacy_message: 'gone' },
      error: null,
    });
    const refreshed = await getKillSwitchState(SWITCH);
    expect(refreshed.source).toBe('network');
    expect(refreshed.enabled).toBe(false);
    expect(refreshed.message).toBe('gone');
  });

  it('KillSwitchActiveError carrega switchName + message', () => {
    const err = new KillSwitchActiveError(SWITCH, 'descontinuada');
    expect(err.switchName).toBe(SWITCH);
    expect(err.message).toBe('descontinuada');
    expect(err.name).toBe('KillSwitchActiveError');
    expect(err instanceof Error).toBe(true);
  });

  it('respeita TTL de memória — após 60s+ refaz network', async () => {
    vi.useFakeTimers();
    try {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { enabled: true, legacy_message: null },
        error: null,
      });
      const first = await getKillSwitchState(SWITCH);
      expect(first.source).toBe('network');

      // Avança 30s — ainda em memória
      vi.advanceTimersByTime(30_000);
      const mid = await getKillSwitchState(SWITCH);
      expect(mid.source).toBe('memory');

      // Avança +35s (total 65s) — memória expirou, mas localStorage ainda válido (5min)
      vi.advanceTimersByTime(35_000);
      const afterMemTTL = await getKillSwitchState(SWITCH);
      expect(afterMemTTL.source).toBe('storage');
    } finally {
      vi.useRealTimers();
    }
  });
});
