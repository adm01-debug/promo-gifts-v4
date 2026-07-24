/**
 * Tratamento de falhas em `trackSubstituteApplied`.
 *
 * Valida que:
 * - Erros do mirror (rejeição da Promise) são capturados e registrados.
 * - Erros retornados no `{ error }` da edge function são registrados.
 * - Falhas nunca throwam para o caller (contrato fire-and-forget).
 * - O buffer `__e2eAnalyticsFailures__` e o CustomEvent
 *   `lovable:analytics_failure` recebem o registro estruturado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import {
  trackSubstituteApplied,
  type SubstituteAppliedFailure,
  type SubstituteAppliedPayload,
} from '@/lib/analytics/intelligenceAnalytics';

const FAILURE_KEY = '__e2eAnalyticsFailures__';
const EVENT_KEY = '__e2eAnalytics__';

function readFailures(): SubstituteAppliedFailure[] {
  return (window as unknown as Record<string, SubstituteAppliedFailure[]>)[FAILURE_KEY] ?? [];
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

const basePayload: SubstituteAppliedPayload = {
  axis: 'categoryId',
  substituteId: 'cat-1',
  substituteName: 'Canecas',
  days: 30,
  culpritBefore: 'supplierId',
};

describe('trackSubstituteApplied — tratamento de falhas', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>)[FAILURE_KEY] = [];
    (window as unknown as Record<string, unknown>)[EVENT_KEY] = [];
    invokeMock.mockReset();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[FAILURE_KEY];
    delete (window as unknown as Record<string, unknown>)[EVENT_KEY];
  });

  it('registra falha quando a Promise do mirror rejeita', async () => {
    invokeMock.mockRejectedValueOnce(new Error('network down'));

    expect(() => trackSubstituteApplied(basePayload)).not.toThrow();
    await flush();

    const fails = readFailures();
    expect(fails).toHaveLength(1);
    expect(fails[0].stage).toBe('mirror_invoke');
    expect(fails[0].message).toBe('network down');
    expect(fails[0].payload).toEqual(basePayload);
    expect(new Date(fails[0].ts).toISOString()).toBe(fails[0].ts);
  });

  it('registra falha quando a edge retorna { error }', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('403 forbidden') });

    trackSubstituteApplied(basePayload);
    await flush();

    const fails = readFailures();
    expect(fails).toHaveLength(1);
    expect(fails[0].stage).toBe('mirror_response');
    expect(fails[0].message).toBe('403 forbidden');
    expect(fails[0].payload.axis).toBe('categoryId');
  });

  it('registra falha quando invoke lança síncrono (mock inesperado)', () => {
    invokeMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    expect(() => trackSubstituteApplied(basePayload)).not.toThrow();

    const fails = readFailures();
    expect(fails).toHaveLength(1);
    expect(fails[0].stage).toBe('mirror_invoke');
    expect(fails[0].message).toBe('boom');
  });

  it('não registra falha no caminho feliz (mirror resolvido sem error)', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    trackSubstituteApplied(basePayload);
    await flush();

    expect(readFailures()).toHaveLength(0);
  });

  it('emite CustomEvent `lovable:analytics_failure` com o registro', async () => {
    const listener = vi.fn();
    window.addEventListener('lovable:analytics_failure', listener as EventListener);
    invokeMock.mockRejectedValueOnce(new Error('timeout'));

    trackSubstituteApplied(basePayload);
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent<SubstituteAppliedFailure>).detail;
    expect(detail.stage).toBe('mirror_invoke');
    expect(detail.message).toBe('timeout');
    expect(detail.payload).toEqual(basePayload);

    window.removeEventListener('lovable:analytics_failure', listener as EventListener);
  });

  it('serializa erros não-Error (string) mantendo mensagem legível', async () => {
    invokeMock.mockRejectedValueOnce('supabase offline');

    trackSubstituteApplied(basePayload);
    await flush();

    const fails = readFailures();
    expect(fails).toHaveLength(1);
    expect(fails[0].message).toBe('supabase offline');
  });

  it('respeita o limite do buffer de falhas (não cresce sem bound)', async () => {
    invokeMock.mockRejectedValue(new Error('always fails'));

    for (let i = 0; i < 120; i++) {
      trackSubstituteApplied({ ...basePayload, substituteId: `cat-${i}` });
    }
    await flush();

    const fails = readFailures();
    expect(fails.length).toBeLessThanOrEqual(100);
    // Deve manter os mais recentes.
    expect(fails[fails.length - 1].payload.substituteId).toBe('cat-119');
  });
});
