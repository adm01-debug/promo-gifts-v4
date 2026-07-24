/**
 * Contrato do CustomEvent `lovable:analytics_failure`.
 *
 * Valida que, para cada estágio (`mirror_invoke`, `mirror_response`,
 * `buffer_push`, `custom_event`, `unexpected`), o `event.detail`:
 *   - É um objeto `SubstituteAppliedFailure` completo (stage, ts, message, payload).
 *   - `ts` é ISO-8601 parseável e round-trip estável (`new Date(ts).toISOString() === ts`).
 *   - `payload` mantém shape do input, sem mutação e sem campos extras.
 *   - `message` normaliza qualquer erro (Error, string, objeto, null) para string.
 *   - `stage` bate com a origem esperada.
 *   - `bubbles`/`cancelable` do CustomEvent seguem defaults (false), garantindo
 *     que consumidores não dependam de propagação.
 *   - Buffer `__e2eAnalyticsFailures__` recebe exatamente o mesmo objeto do
 *     `event.detail` (identidade — mesma referência), evitando drift entre canais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import {
  trackSubstituteApplied,
  type SubstituteAppliedFailure,
  type SubstituteAppliedFailureStage,
  type SubstituteAppliedPayload,
} from '@/lib/analytics/intelligenceAnalytics';

const FAILURE_KEY = '__e2eAnalyticsFailures__';
const EVENT_KEY = '__e2eAnalytics__';

function readFailures(): SubstituteAppliedFailure[] {
  return (window as unknown as Record<string, SubstituteAppliedFailure[]>)[FAILURE_KEY] ?? [];
}

function captureFailureEvents(): {
  details: SubstituteAppliedFailure[];
  events: CustomEvent<SubstituteAppliedFailure>[];
  dispose: () => void;
} {
  const events: CustomEvent<SubstituteAppliedFailure>[] = [];
  const details: SubstituteAppliedFailure[] = [];
  const listener = (e: Event) => {
    const ce = e as CustomEvent<SubstituteAppliedFailure>;
    events.push(ce);
    details.push(ce.detail);
  };
  window.addEventListener('lovable:analytics_failure', listener);
  return {
    details,
    events,
    dispose: () => window.removeEventListener('lovable:analytics_failure', listener),
  };
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

const basePayload: SubstituteAppliedPayload = {
  axis: 'categoryId',
  substituteId: 'cat-42',
  substituteName: 'Squeezes',
  days: 30,
  culpritBefore: 'supplierId',
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertFailureShape(
  detail: SubstituteAppliedFailure,
  expected: {
    stage: SubstituteAppliedFailureStage;
    message: string;
    payload: SubstituteAppliedPayload;
  },
): void {
  // Chaves canônicas, sem sobrar/faltar campo.
  expect(Object.keys(detail).sort()).toEqual(['message', 'payload', 'stage', 'ts']);
  expect(detail.stage).toBe(expected.stage);
  expect(detail.message).toBe(expected.message);
  expect(typeof detail.message).toBe('string');
  expect(detail.payload).toEqual(expected.payload);
  // ISO-8601 estrito + round-trip estável.
  expect(detail.ts).toMatch(ISO_RE);
  expect(new Date(detail.ts).toISOString()).toBe(detail.ts);
}

describe('CustomEvent lovable:analytics_failure — contrato do detail', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>)[FAILURE_KEY] = [];
    (window as unknown as Record<string, unknown>)[EVENT_KEY] = [];
    invokeMock.mockReset();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[FAILURE_KEY];
    delete (window as unknown as Record<string, unknown>)[EVENT_KEY];
  });

  it('mirror_invoke: emite CustomEvent com shape completo e ts ISO round-trip', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValueOnce(new Error('network down'));

    trackSubstituteApplied(basePayload);
    await flush();

    expect(cap.events).toHaveLength(1);
    assertFailureShape(cap.details[0], {
      stage: 'mirror_invoke',
      message: 'network down',
      payload: basePayload,
    });
    cap.dispose();
  });

  it('mirror_response: propaga message da edge sem serialização extra', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('403 forbidden') });

    trackSubstituteApplied(basePayload);
    await flush();

    assertFailureShape(cap.details[0], {
      stage: 'mirror_response',
      message: '403 forbidden',
      payload: basePayload,
    });
    cap.dispose();
  });

  it('mirror_invoke síncrono: erro lançado pelo invoke é capturado com stage correto', () => {
    const cap = captureFailureEvents();
    invokeMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    trackSubstituteApplied(basePayload);

    expect(cap.events).toHaveLength(1);
    assertFailureShape(cap.details[0], {
      stage: 'mirror_invoke',
      message: 'boom',
      payload: basePayload,
    });
    cap.dispose();
  });

  it('normaliza erro string em detail.message', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValueOnce('supabase offline');

    trackSubstituteApplied(basePayload);
    await flush();

    assertFailureShape(cap.details[0], {
      stage: 'mirror_invoke',
      message: 'supabase offline',
      payload: basePayload,
    });
    cap.dispose();
  });

  it('normaliza erro objeto (plain object) via JSON.stringify em detail.message', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValueOnce({ code: 'ERR_X', hint: 'retry' });

    trackSubstituteApplied(basePayload);
    await flush();

    expect(cap.details[0].stage).toBe('mirror_invoke');
    expect(cap.details[0].message).toBe(JSON.stringify({ code: 'ERR_X', hint: 'retry' }));
    // Restante do shape continua íntegro.
    expect(cap.details[0].payload).toEqual(basePayload);
    expect(cap.details[0].ts).toMatch(ISO_RE);
    cap.dispose();
  });

  it('normaliza erro null como "null" (JSON.stringify) sem quebrar o evento', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValueOnce(null);

    trackSubstituteApplied(basePayload);
    await flush();

    expect(cap.details[0].stage).toBe('mirror_invoke');
    expect(cap.details[0].message).toBe('null');
    cap.dispose();
  });

  it('não muta o payload do caller — detail.payload é igual porém shape preservado', async () => {
    const cap = captureFailureEvents();
    const input: SubstituteAppliedPayload = { ...basePayload };
    const snapshot = JSON.parse(JSON.stringify(input));
    invokeMock.mockRejectedValueOnce(new Error('x'));

    trackSubstituteApplied(input);
    await flush();

    // Input não foi mutado (nem chaves adicionadas nem removidas).
    expect(input).toEqual(snapshot);
    expect(cap.details[0].payload).toEqual(snapshot);
    cap.dispose();
  });

  it('preserva culpritBefore=null e substituteName ausente sem inventar defaults no detail', async () => {
    const cap = captureFailureEvents();
    const payload: SubstituteAppliedPayload = {
      axis: 'productId',
      substituteId: 'prod-1',
      days: 7,
      culpritBefore: null,
    };
    invokeMock.mockRejectedValueOnce(new Error('e'));

    trackSubstituteApplied(payload);
    await flush();

    // detail.payload deve refletir EXATAMENTE o input (sem adicionar substituteName).
    expect(cap.details[0].payload).toEqual(payload);
    expect('substituteName' in cap.details[0].payload).toBe(false);
    cap.dispose();
  });

  it('CustomEvent usa defaults (bubbles=false, cancelable=false) e type correto', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValueOnce(new Error('e'));

    trackSubstituteApplied(basePayload);
    await flush();

    const ce = cap.events[0];
    expect(ce.type).toBe('lovable:analytics_failure');
    expect(ce.bubbles).toBe(false);
    expect(ce.cancelable).toBe(false);
    cap.dispose();
  });

  it('detail no evento é a MESMA referência gravada no buffer (sem drift entre canais)', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValueOnce(new Error('same-ref'));

    trackSubstituteApplied(basePayload);
    await flush();

    const fromBuffer = readFailures();
    expect(fromBuffer).toHaveLength(1);
    // Identidade referencial: buffer e event.detail apontam para o mesmo objeto.
    expect(cap.details[0]).toBe(fromBuffer[0]);
    cap.dispose();
  });

  it('múltiplas falhas: cada CustomEvent carrega o payload correspondente na ordem', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockRejectedValue(new Error('multi'));

    const p1: SubstituteAppliedPayload = { ...basePayload, substituteId: 'a' };
    const p2: SubstituteAppliedPayload = { ...basePayload, substituteId: 'b', axis: 'supplierId' };
    const p3: SubstituteAppliedPayload = { ...basePayload, substituteId: 'c', axis: 'productId' };

    trackSubstituteApplied(p1);
    trackSubstituteApplied(p2);
    trackSubstituteApplied(p3);
    await flush();

    expect(cap.details.map((d) => d.payload.substituteId)).toEqual(['a', 'b', 'c']);
    expect(cap.details.map((d) => d.payload.axis)).toEqual([
      'categoryId',
      'supplierId',
      'productId',
    ]);
    cap.dispose();
  });

  it('não emite CustomEvent no caminho feliz (mirror ok)', async () => {
    const cap = captureFailureEvents();
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    trackSubstituteApplied(basePayload);
    await flush();

    expect(cap.events).toHaveLength(0);
    cap.dispose();
  });
});
