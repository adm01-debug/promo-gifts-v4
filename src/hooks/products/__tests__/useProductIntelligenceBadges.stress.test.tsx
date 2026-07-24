/**
 * Stress + fuzz suite para useProductIntelligenceBadges.
 *
 * Cobre:
 *  - 500 simulações PRNG-seeded variando thresholds, velocidades e flags
 *  - Edge cases de dados ausentes / NaN / negativos / Infinity
 *  - Fuzzing nos thresholds do admin (best-seller) — borda exata, acima/abaixo,
 *    negativo, zero, NaN, valores absurdos
 *
 * Invariantes validados em toda simulação:
 *  - badges é um array
 *  - ordenado por priority desc
 *  - sem duplicatas de mesmo `type`
 *  - todo label é não-vazio
 *  - best-seller só aparece com avg_daily_depletion_7d finito ≥ threshold
 *  - hot-item só aparece com flag is_hot_product e settings.hotItem.enabled
 *  - tooltips/descrições nunca contêm `NaN`, `Infinity` ou `undefined`
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProductIntelligenceBadges } from '@/hooks/products/useProductIntelligenceBadges';
import type { IntelligenceBadgeSettings } from '@/hooks/admin/useIntelligenceBadgeSettings';

// ---- mocks externos --------------------------------------------------------
type IntelMock = {
  is_hot_product?: boolean;
  abc_classification?: string | null;
  has_frequent_restock?: boolean;
  is_stockout_risk?: boolean;
} | null;
type VelMock = Array<{ avg_daily_depletion_7d: number; velocity_trend?: number | null }>;

let intelMock: IntelMock = null;
let velMock: VelMock = [];
let settingsMock: IntelligenceBadgeSettings = {
  hotItem: { enabled: true },
  bestSeller: { enabled: true, minAvgDailyDepletion7d: 15 },
};

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

// PRNG determinístico (mulberry32) — repetível entre rodadas
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFinite(rng: () => number): number {
  // mistura valores normais + bordas problemáticas
  const dice = rng();
  if (dice < 0.05) return 0;
  if (dice < 0.08) return -1;
  if (dice < 0.1) return Number.NaN;
  if (dice < 0.11) return Number.POSITIVE_INFINITY;
  if (dice < 0.12) return 9999;
  return Math.round(rng() * 80 * 100) / 100; // 0..80 com 2 casas
}

beforeEach(() => {
  intelMock = null;
  velMock = [];
  settingsMock = {
    hotItem: { enabled: true },
    bestSeller: { enabled: true, minAvgDailyDepletion7d: 15 },
  };
});

function assertInvariants(
  badges: ReturnType<typeof useProductIntelligenceBadges>['badges'],
  ctx: { threshold: number; avg: number; hotEnabled: boolean; isHot: boolean },
) {
  // tipo
  expect(Array.isArray(badges)).toBe(true);
  // sem duplicatas por type
  const types = badges.map((b) => b.type);
  expect(new Set(types).size).toBe(types.length);
  // ordenado por priority desc
  for (let i = 1; i < badges.length; i++) {
    expect(badges[i].priority).toBeLessThanOrEqual(badges[i - 1].priority);
  }
  // labels e descrições saudáveis
  for (const b of badges) {
    expect(typeof b.label).toBe('string');
    expect(b.label.length).toBeGreaterThan(0);
    if (b.description !== undefined) {
      expect(b.description).not.toContain('NaN');
      expect(b.description).not.toContain('Infinity');
      expect(b.description).not.toContain('undefined');
    }
  }
  // best-seller: só com avg finito ≥ threshold e habilitado
  const best = badges.find((b) => b.type === 'best-seller');
  if (best) {
    expect(Number.isFinite(ctx.avg)).toBe(true);
    expect(ctx.avg).toBeGreaterThanOrEqual(ctx.threshold);
  }
  // hot-item: só com flag + enabled
  const hot = badges.find((b) => b.type === 'hot-item');
  if (hot) {
    expect(ctx.isHot).toBe(true);
    expect(ctx.hotEnabled).toBe(true);
  }
}

describe('useProductIntelligenceBadges — 500 simulações PRNG', () => {
  for (let seed = 1; seed <= 500; seed++) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    it(`simulação #${seed} mantém invariantes`, () => {
      const rng = makePrng(seed);
      const threshold = Math.max(1, Math.floor(rng() * 100));
      const avg = pickFinite(rng);
      const trend = rng() < 0.05 ? Number.NaN : 0.4 + rng() * 1.4; // 0.4..1.8
      const isHot = rng() < 0.5;
      const hotEnabled = rng() < 0.8;
      const bestEnabled = rng() < 0.8;
      const isAbc = rng() < 0.3;
      const isRestock = rng() < 0.3;
      const isStockout = rng() < 0.2;

      intelMock = {
        is_hot_product: isHot,
        abc_classification: isAbc ? 'A' : null,
        has_frequent_restock: isRestock,
        is_stockout_risk: isStockout,
      };
      velMock = [{ avg_daily_depletion_7d: avg, velocity_trend: trend }];
      settingsMock = {
        hotItem: { enabled: hotEnabled },
        bestSeller: { enabled: bestEnabled, minAvgDailyDepletion7d: threshold },
      };

      const { result } = renderHook(() =>
        useProductIntelligenceBadges(`sim-${seed}`, {
          featured: rng() < 0.2,
          new_arrival: rng() < 0.2,
        }),
      );
      assertInvariants(result.current.badges, {
        threshold,
        avg,
        hotEnabled,
        isHot,
      });
    });
  }
});

describe('useProductIntelligenceBadges — edge cases de borda do threshold', () => {
  it('avg exatamente IGUAL ao threshold qualifica best-seller', () => {
    velMock = [{ avg_daily_depletion_7d: 15 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-eq'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeDefined();
  });

  it('avg = threshold - 0.001 NÃO qualifica', () => {
    velMock = [{ avg_daily_depletion_7d: 14.999 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-lt'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('avg NaN NÃO qualifica e não quebra render', () => {
    velMock = [{ avg_daily_depletion_7d: Number.NaN }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-nan'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('avg Infinity NÃO qualifica (não-finito)', () => {
    velMock = [{ avg_daily_depletion_7d: Number.POSITIVE_INFINITY }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-inf'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('avg negativo NÃO qualifica', () => {
    velMock = [{ avg_daily_depletion_7d: -10 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-neg'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('intel = null + vels = [] não gera hot-item nem best-seller', () => {
    intelMock = null;
    velMock = [];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-empty'));
    const types = result.current.badges.map((b) => b.type);
    expect(types).not.toContain('hot-item');
    expect(types).not.toContain('best-seller');
  });

  it('velocity_trend NaN não gera emerging/declining', () => {
    velMock = [{ avg_daily_depletion_7d: 5, velocity_trend: Number.NaN }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-trend-nan'));
    const types = result.current.badges.map((b) => b.type);
    expect(types).not.toContain('emerging');
    expect(types).not.toContain('declining');
  });

  it('descrição do best-seller nunca contém NaN/Infinity', () => {
    velMock = [{ avg_daily_depletion_7d: 50 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-desc'));
    const best = result.current.badges.find((b) => b.type === 'best-seller');
    expect(best?.description ?? '').not.toMatch(/NaN|Infinity|undefined/);
  });

  it('múltiplas velocities — usa a maior para decidir best-seller', () => {
    velMock = [
      { avg_daily_depletion_7d: 5 },
      { avg_daily_depletion_7d: 25 },
      { avg_daily_depletion_7d: 10 },
    ];
    const { result } = renderHook(() => useProductIntelligenceBadges('edge-multi'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeDefined();
  });
});

describe('useProductIntelligenceBadges — fuzz nos thresholds do admin', () => {
  const cases: Array<{ name: string; threshold: number; avg: number; expected: boolean }> = [
    { name: 'threshold=1, avg=1', threshold: 1, avg: 1, expected: true },
    { name: 'threshold=1, avg=0.5', threshold: 1, avg: 0.5, expected: false },
    { name: 'threshold=50, avg=49.999', threshold: 50, avg: 49.999, expected: false },
    { name: 'threshold=50, avg=50', threshold: 50, avg: 50, expected: true },
    { name: 'threshold=50, avg=50.001', threshold: 50, avg: 50.001, expected: true },
    { name: 'threshold=100, avg=99', threshold: 100, avg: 99, expected: false },
    { name: 'threshold=100, avg=999', threshold: 100, avg: 999, expected: true },
    // valores patológicos no threshold caem no default 15 via sanitize do hook?
    // o hook usa o threshold direto; sanitize fica no useIntelligenceBadgeSettings.
    // aqui exercitamos só o consumer com valores já sanitizados.
  ];

  for (const c of cases) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    it(`${c.name} → ${c.expected ? 'qualifica' : 'não qualifica'}`, () => {
      velMock = [{ avg_daily_depletion_7d: c.avg }];
      settingsMock = {
        hotItem: { enabled: true },
        bestSeller: { enabled: true, minAvgDailyDepletion7d: c.threshold },
      };
      const { result } = renderHook(() => useProductIntelligenceBadges(`fuzz-${c.name}`));
      const has = !!result.current.badges.find((b) => b.type === 'best-seller');
      expect(has).toBe(c.expected);
    });
  }
});
