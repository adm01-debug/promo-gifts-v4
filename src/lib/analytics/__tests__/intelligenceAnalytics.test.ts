/**
 * Contrato de payload de `trackSubstituteApplied`.
 *
 * Garante que axis, substituteId, days e culpritBefore sejam preservados
 * exatamente no buffer E2E (`window.__e2eAnalytics__`) e no CustomEvent
 * `lovable:analytics`. O mirror para `ai_usage_events` é mockado para não
 * disparar rede em ambiente unitário.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import {
  trackSubstituteApplied,
  type IntelligenceAnalyticsEvent,
  type SubstituteAppliedPayload,
} from '@/lib/analytics/intelligenceAnalytics';

const BUFFER_KEY = '__e2eAnalytics__';

function readBuffer(): IntelligenceAnalyticsEvent[] {
  return (window as unknown as Record<string, IntelligenceAnalyticsEvent[]>)[BUFFER_KEY] ?? [];
}

describe('trackSubstituteApplied — contrato de payload', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>)[BUFFER_KEY] = [];
    vi.mocked(supabase.functions.invoke).mockClear();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[BUFFER_KEY];
  });

  it.each<SubstituteAppliedPayload>([
    { axis: 'categoryId', substituteId: 'cat-42', substituteName: 'Canecas', days: 30, culpritBefore: 'supplierId' },
    { axis: 'supplierId', substituteId: 'sup-9', substituteName: null, days: 7, culpritBefore: 'window' },
    { axis: 'productId', substituteId: 'prod-abc', days: 90, culpritBefore: null },
    { axis: 'productId', substituteId: 'prod-xyz', substituteName: 'Mochila', days: 180, culpritBefore: 'intersection' },
  ])('preserva axis/substituteId/days/culpritBefore para %o', (payload) => {
    trackSubstituteApplied(payload);

    const buf = readBuffer();
    expect(buf).toHaveLength(1);
    const evt = buf[0];

    expect(evt.name).toBe('intelligence.substitute_applied');
    expect(() => new Date(evt.ts).toISOString()).not.toThrow();
    expect(new Date(evt.ts).toISOString()).toBe(evt.ts);

    expect(evt.payload.axis).toBe(payload.axis);
    expect(evt.payload.substituteId).toBe(payload.substituteId);
    expect(evt.payload.days).toBe(payload.days);
    expect(evt.payload.culpritBefore).toBe(payload.culpritBefore);
    expect(evt.payload).toEqual(payload);
  });

  it('não muta o payload original passado pelo caller', () => {
    const payload: SubstituteAppliedPayload = {
      axis: 'categoryId',
      substituteId: 'cat-1',
      days: 30,
      culpritBefore: 'supplierId',
    };
    const snapshot = JSON.parse(JSON.stringify(payload));
    trackSubstituteApplied(payload);
    expect(payload).toEqual(snapshot);
  });

  it('espelha o payload no CustomEvent lovable:analytics', () => {
    const listener = vi.fn();
    window.addEventListener('lovable:analytics', listener as EventListener);

    const payload: SubstituteAppliedPayload = {
      axis: 'supplierId',
      substituteId: 'sup-77',
      days: 14,
      culpritBefore: 'categoryId',
    };
    trackSubstituteApplied(payload);

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent<IntelligenceAnalyticsEvent>).detail;
    expect(detail.name).toBe('intelligence.substitute_applied');
    expect(detail.payload).toEqual(payload);

    window.removeEventListener('lovable:analytics', listener as EventListener);
  });

  it('preserva a ordem de inserção no buffer em chamadas consecutivas', () => {
    const payloads: SubstituteAppliedPayload[] = [
      { axis: 'categoryId', substituteId: 'a', days: 30 },
      { axis: 'supplierId', substituteId: 'b', days: 30 },
      { axis: 'productId', substituteId: 'c', days: 30 },
    ];
    payloads.forEach(trackSubstituteApplied);

    const buf = readBuffer();
    expect(buf.map((e) => e.payload.substituteId)).toEqual(['a', 'b', 'c']);
    expect(buf.map((e) => e.payload.axis)).toEqual(['categoryId', 'supplierId', 'productId']);
  });

  it('dispara mirror em ai_usage_events com axis/substituteId/days/culpritBefore', () => {
    const payload: SubstituteAppliedPayload = {
      axis: 'categoryId',
      substituteId: 'cat-42',
      substituteName: 'Canecas',
      days: 30,
      culpritBefore: 'supplierId',
    };
    trackSubstituteApplied(payload);

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    const [fnName, opts] = vi.mocked(supabase.functions.invoke).mock.calls[0];
    expect(fnName).toBe('intelligence-substitute-applied');
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      axis: payload.axis,
      substituteId: payload.substituteId,
      substituteName: payload.substituteName,
      days: payload.days,
      culpritBefore: payload.culpritBefore,
    });
    expect(typeof body.clientTs).toBe('string');
    expect(new Date(body.clientTs as string).toISOString()).toBe(body.clientTs);
  });

  it('normaliza substituteName ausente e culpritBefore ausente para null no mirror', () => {
    trackSubstituteApplied({ axis: 'productId', substituteId: 'p-1', days: 60 });

    const [, opts] = vi.mocked(supabase.functions.invoke).mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body.substituteName).toBeNull();
    expect(body.culpritBefore).toBeNull();
  });
});
