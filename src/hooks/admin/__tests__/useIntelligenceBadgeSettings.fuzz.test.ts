/**
 * Fuzz da camada de sanitização do useIntelligenceBadgeSettings.
 *
 * O hook expõe `sanitize()` (interno) que normaliza valores vindos de
 * `admin_settings`. Como a função não é exportada, exercitamos via
 * comportamento observável: simulando `value` arbitrário no fetch e
 * verificando o snapshot resultante via `useIntelligenceBadgeSettingsValue`.
 *
 * Garante:
 *  - valores negativos / zero / NaN / null / strings caem no default (15)
 *  - flags ausentes assumem enabled=true
 *  - valores absurdos (> 9999) são aceitos como numéricos finitos
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ---- mocks de supabase + toast --------------------------------------------
let fetchValue: unknown = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          // eslint-disable-next-line @typescript-eslint/require-await
          maybeSingle: async () => ({ data: { value: fetchValue }, error: null }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/require-await
      upsert: async () => ({ error: null }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: () => undefined, error: () => undefined },
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (e: unknown) => String(e),
}));

// Reset do cache module-level entre cada teste (necessário porque o hook
// armazena settings em `cached` interno).
async function freshHook() {
  vi.resetModules();
  const mod = await import('@/hooks/admin/useIntelligenceBadgeSettings');
  return mod;
}

beforeEach(() => {
  fetchValue = null;
});

describe('useIntelligenceBadgeSettings — fuzz na sanitização', () => {
  const cases: Array<{
    name: string;
    value: unknown;
    expectMin: number;
    expectHot: boolean;
    expectBest: boolean;
  }> = [
    {
      name: 'valor null → defaults',
      value: null,
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'objeto vazio → defaults',
      value: {},
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'min negativo → fallback 15',
      value: { bestSeller: { minAvgDailyDepletion7d: -5 } },
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'min zero → fallback 15',
      value: { bestSeller: { minAvgDailyDepletion7d: 0 } },
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'min NaN (via string) → fallback 15',
      value: { bestSeller: { minAvgDailyDepletion7d: 'abc' } },
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'min Infinity → fallback 15 (não-finito)',
      value: { bestSeller: { minAvgDailyDepletion7d: Number.POSITIVE_INFINITY } },
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'min = 1 (mínimo positivo) → mantém',
      value: { bestSeller: { minAvgDailyDepletion7d: 1 } },
      expectMin: 1,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'min = 9999 (absurdo mas finito) → mantém',
      value: { bestSeller: { minAvgDailyDepletion7d: 9999 } },
      expectMin: 9999,
      expectHot: true,
      expectBest: true,
    },
    {
      name: 'hotItem desabilitado explicitamente',
      value: { hotItem: { enabled: false } },
      expectMin: 15,
      expectHot: false,
      expectBest: true,
    },
    {
      name: 'bestSeller desabilitado explicitamente',
      value: { bestSeller: { enabled: false, minAvgDailyDepletion7d: 20 } },
      expectMin: 20,
      expectHot: true,
      expectBest: false,
    },
    {
      name: 'string como root → defaults',
      value: 'not-an-object',
      expectMin: 15,
      expectHot: true,
      expectBest: true,
    },
  ];

  for (const c of cases) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    it(c.name, async () => {
      fetchValue = c.value;
      const { useIntelligenceBadgeSettingsValue } = await freshHook();
      const { result } = renderHook(() => useIntelligenceBadgeSettingsValue());
      // aguarda o fetch único disparado pelo useEffect
      await waitFor(() => {
        expect(result.current.bestSeller.minAvgDailyDepletion7d).toBe(c.expectMin);
      });
      expect(result.current.hotItem.enabled).toBe(c.expectHot);
      expect(result.current.bestSeller.enabled).toBe(c.expectBest);
    });
  }

  it('100 fuzz aleatórios — nunca produz min ≤ 0 nem não-finito', async () => {
    const seeds = Array.from({ length: 100 }, (_, i) => i + 1);
    for (const seed of seeds) {
      // payload deliberadamente caótico
      const v: Record<string, unknown> = {};
      const r = ((seed * 1103515245 + 12345) >>> 0) / 0xffffffff;
      if (r < 0.2) v.bestSeller = { minAvgDailyDepletion7d: -seed };
      else if (r < 0.4) v.bestSeller = { minAvgDailyDepletion7d: Number.NaN };
      else if (r < 0.6) v.bestSeller = { minAvgDailyDepletion7d: `lol-${seed}` };
      else if (r < 0.8) v.bestSeller = { minAvgDailyDepletion7d: seed * 0.01 };
      else v.bestSeller = { minAvgDailyDepletion7d: seed * 7 };

      fetchValue = v;
      const { useIntelligenceBadgeSettingsValue } = await freshHook();
      const { result } = renderHook(() => useIntelligenceBadgeSettingsValue());
      await waitFor(() => {
        expect(typeof result.current.bestSeller.minAvgDailyDepletion7d).toBe('number');
      });
      const min = result.current.bestSeller.minAvgDailyDepletion7d;
      expect(Number.isFinite(min)).toBe(true);
      expect(min).toBeGreaterThan(0);
    }
  });

  it('save() com payload inválido grava versão sanitizada (não-finito → default)', async () => {
    fetchValue = null;
    const { useIntelligenceBadgeSettings } = await freshHook();
    const { result } = renderHook(() => useIntelligenceBadgeSettings());
    await act(async () => {
      const ok = await result.current.save({
        hotItem: { enabled: true },
        // @ts-expect-error — testando entrada inválida proposital
        bestSeller: { enabled: true, minAvgDailyDepletion7d: 'xxx' },
      });
      expect(ok).toBe(true);
    });
    expect(result.current.settings.bestSeller.minAvgDailyDepletion7d).toBe(15);
  });
});
