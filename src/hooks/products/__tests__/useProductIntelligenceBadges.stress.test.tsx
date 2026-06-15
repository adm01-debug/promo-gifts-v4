/**
 * Stress / fuzz suite for useProductIntelligenceBadges.
 *
 * Roda centenas de simulações (PRNG seeded — determinístico no CI) variando:
 *  - thresholds das badges (minAvgDailyDepletion7d)
 *  - velocidades de venda (incluindo bordas exatas, 0, NaN, negativos)
 *  - flags de inteligência (hot, abc, stockout, restock)
 *  - feature flags (enabled/disabled)
 *  - dados ausentes / nulos / arrays vazios
 *
 * Invariantes validadas em TODA simulação:
 *  1. Hook nunca lança.
 *  2. `badges` é array.
 *  3. Best-seller só aparece se enabled && avg >= threshold (numérico finito).
 *  4. Hot Item só aparece se enabled && is_hot_product === true.
 *  5. Badges retornadas estão ordenadas por priority desc.
 *  6. Nenhum badge duplicado por tipo.
 *  7. Toda badge tem label não-vazio.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProductIntelligenceBadges } from '@/hooks/products/useProductIntelligenceBadges';
import {
  DEFAULT_INTELLIGENCE_BADGE_SETTINGS,
  type IntelligenceBadgeSettings,
} from '@/hooks/admin/useIntelligenceBadgeSettings';

// ---- mocks (mesmo pattern do test base) -----------------------------------
type Intel = {
  is_hot_product?: boolean;
  abc_classification?: string | null;
  has_frequent_restock?: boolean;
  is_stockout_risk?: boolean;
} | null;
type Vel = { avg_daily_depletion_7d: number; velocity_trend?: number | null };

let intelMock: Intel = null;
let velMock: Vel[] = [];
let settingsMock: IntelligenceBadgeSettings = DEFAULT_INTELLIGENCE_BADGE_SETTINGS;

vi.mock('@/hooks/intelligence', () => ({
  useProductIntelligenceData: () => ({ data: intelMock, isLoading: false }),
  useStockVelocity: () => ({ data: velMock, isLoading: false }),
}));
vi.mock('@/lib/stock-chart-utils', () => ({
  generateMockVelocities: () => [],
  generateMockIntelligence: () => null,
}));
vi.mock('@/hooks/admin/useIntelligenceBadgeSettings', () => ({
  DEFAULT_INTELLIGENCE_BADGE_SETTINGS: {
    hotItem: { enabled: true },
    bestSeller: { enabled: true, minAvgDailyDepletion7d: 15 },
  },
  useIntelligenceBadgeSettingsValue: () => settingsMock,
}));

beforeEach(() => {
  intelMock = null;
  velMock = [];
  settingsMock = {
    hotItem: { enabled: true },
    bestSeller: { enabled: true, minAvgDailyDepletion7d: 15 },
  };
});

// ---- PRNG determinístico (mulberry32) -------------------------------------
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function assertInvariants(
  badges: ReturnType<typeof useProductIntelligenceBadges>['badges'],
  ctx: { settings: IntelligenceBadgeSettings; vels: Vel[]; intel: Intel },
) {
  expect(Array.isArray(badges)).toBe(true);

  // ordenação por priority desc
  for (let i = 1; i < badges.length; i++) {
    expect(badges[i - 1].priority).toBeGreaterThanOrEqual(badges[i].priority);
  }

  // sem duplicatas por tipo
  const types = badges.map((b) => b.type);
  expect(new Set(types).size).toBe(types.length);

  // labels não-vazios
  for (const b of badges) {
    expect(typeof b.label).toBe('string');
    expect(b.label.length).toBeGreaterThan(0);
  }

  // Hot Item
  const hot = badges.find((b) => b.type === 'hot-item');
  if (hot) {
    expect(ctx.settings.hotItem.enabled).toBe(true);
    expect(ctx.intel?.is_hot_product).toBe(true);
  }

  // Best-seller
  const best = badges.find((b) => b.type === 'best-seller');
  const maxVel = ctx.vels.reduce(
    (m, v) => (Number.isFinite(v.avg_daily_depletion_7d) && v.avg_daily_depletion_7d > m ? v.avg_daily_depletion_7d : m),
    0,
  );
  if (best) {
    expect(ctx.settings.bestSeller.enabled).toBe(true);
    expect(maxVel).toBeGreaterThanOrEqual(ctx.settings.bestSeller.minAvgDailyDepletion7d);
  }
}

describe('useProductIntelligenceBadges — stress (500 simulações)', () => {
  const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);

  it.each(SEEDS)('seed %i mantém invariantes', (seed) => {
    const rng = mulberry32(seed);

    // settings fuzzed
    settingsMock = {
      hotItem: { enabled: rng() > 0.2 },
      bestSeller: {
        enabled: rng() > 0.2,
        minAvgDailyDepletion7d: pick(rng, [1, 5, 10, 15, 20, 25, 50, 100]),
      },
    };

    // intel fuzzed (pode ser null)
    if (rng() > 0.15) {
      intelMock = {
        is_hot_product: rng() > 0.5,
        abc_classification: pick(rng, ['A', 'B', 'C', null]),
        has_frequent_restock: rng() > 0.6,
        is_stockout_risk: rng() > 0.7,
      };
    } else {
      intelMock = null;
    }

    // velocidades fuzzed — inclui bordas e valores inválidos
    const n = Math.floor(rng() * 6);
    velMock = Array.from({ length: n }, () => ({
      avg_daily_depletion_7d: pick(
        rng,
        [0, 1, 4.99, 5, 14.99, 15, 15.01, 50, 9999, -1, Number.NaN],
      ),
      velocity_trend: pick(rng, [null, 0.5, 0.7, 1, 1.3, 1.5, 3]),
    }));

    let badges;
    expect(() => {
      const { result } = renderHook(() => useProductIntelligenceBadges(`fuzz-${seed}`));
      badges = result.current.badges;
    }).not.toThrow();

    assertInvariants(badges!, { settings: settingsMock, vels: velMock, intel: intelMock });
  });
});

describe('useProductIntelligenceBadges — bordas exatas do threshold', () => {
  const cases: Array<[number, number, boolean]> = [
    // [threshold, avg, esperaBadge]
    [15, 14.999, false],
    [15, 15, true],
    [15, 15.0001, true],
    [1, 1, true],
    [1, 0.9999, false],
    [100, 99.999, false],
    [100, 100, true],
    [5, 0, false],
  ];

  it.each(cases)(
    'threshold=%s avg=%s → best-seller presente = %s',
    (threshold, avg, expected) => {
      settingsMock = {
        hotItem: { enabled: true },
        bestSeller: { enabled: true, minAvgDailyDepletion7d: threshold },
      };
      velMock = [{ avg_daily_depletion_7d: avg }];
      const { result } = renderHook(() => useProductIntelligenceBadges('edge'));
      const has = !!result.current.badges.find((b) => b.type === 'best-seller');
      expect(has).toBe(expected);
    },
  );

  it('dados ausentes (intel=null, vels=[]) → nenhuma badge de inteligência', () => {
    intelMock = null;
    velMock = [];
    const { result } = renderHook(() => useProductIntelligenceBadges('empty'));
    const types = result.current.badges.map((b) => b.type);
    expect(types).not.toContain('best-seller');
    expect(types).not.toContain('hot-item');
  });

  it('NaN em avg_daily_depletion_7d não dispara best-seller', () => {
    velMock = [{ avg_daily_depletion_7d: Number.NaN }];
    const { result } = renderHook(() => useProductIntelligenceBadges('nan'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('valor negativo nunca qualifica best-seller', () => {
    velMock = [{ avg_daily_depletion_7d: -10 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('neg'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });
});
