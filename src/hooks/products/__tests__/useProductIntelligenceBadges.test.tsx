/**
 * Cobertura: badges 🔥 Hot Item e 🏅 Best-seller no useProductIntelligenceBadges.
 *
 * Validamos a *fonte* das badges — o hook que ProductCard consome — em vez
 * do render completo do card (que arrasta dezenas de dependências externas).
 * Isto cobre o contrato real: dados de Inteligência Comercial → badges.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProductIntelligenceBadges } from '@/hooks/products/useProductIntelligenceBadges';
import {
  DEFAULT_INTELLIGENCE_BADGE_SETTINGS,
  type IntelligenceBadgeSettings,
} from '@/hooks/admin/useIntelligenceBadgeSettings';

// ---- mocks -----------------------------------------------------------------
let intelMock: { is_hot_product?: boolean; abc_classification?: string | null } | null = null;
let velMock: Array<{ avg_daily_depletion_7d: number; velocity_trend?: number | null }> = [];
let settingsMock: IntelligenceBadgeSettings = DEFAULT_INTELLIGENCE_BADGE_SETTINGS;

vi.mock('@/hooks/intelligence', () => ({
  useProductIntelligenceData: () => ({ data: intelMock, isLoading: false }),
  useStockVelocity: () => ({ data: velMock, isLoading: false }),
}));

vi.mock('@/lib/stock-chart-utils', () => ({
  // mocks "vazios" para evitar o fallback de demo influenciar
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

describe('useProductIntelligenceBadges — Hot Item / Best-seller', () => {
  it('renderiza 🔥 Hot Item quando is_hot_product = true', () => {
    intelMock = { is_hot_product: true };
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-1'));
    const types = result.current.badges.map((b) => b.type);
    expect(types).toContain('hot-item');
  });

  it('NÃO renderiza 🔥 Hot Item quando desabilitado nas settings', () => {
    intelMock = { is_hot_product: true };
    settingsMock = { ...settingsMock, hotItem: { enabled: false } };
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-1'));
    expect(result.current.badges.find((b) => b.type === 'hot-item')).toBeUndefined();
  });

  it('renderiza 🏅 Best-seller quando avg_daily_depletion_7d >= threshold padrão (15)', () => {
    velMock = [{ avg_daily_depletion_7d: 20 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-2'));
    const best = result.current.badges.find((b) => b.type === 'best-seller');
    expect(best).toBeDefined();
    expect(best?.description).toMatch(/20\.0 un\/dia/);
    expect(best?.description).toMatch(/limite ≥ 15/);
  });

  it('NÃO renderiza 🏅 Best-seller quando avg_daily_depletion_7d < threshold', () => {
    velMock = [{ avg_daily_depletion_7d: 10 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-3'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('respeita threshold custom da admin (ex.: 25) — 20 un/dia não qualifica', () => {
    velMock = [{ avg_daily_depletion_7d: 20 }];
    settingsMock = {
      ...settingsMock,
      bestSeller: { enabled: true, minAvgDailyDepletion7d: 25 },
    };
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-4'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('threshold custom mais baixo (ex.: 5) qualifica produto com 8 un/dia', () => {
    velMock = [{ avg_daily_depletion_7d: 8 }];
    settingsMock = {
      ...settingsMock,
      bestSeller: { enabled: true, minAvgDailyDepletion7d: 5 },
    };
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-5'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeDefined();
  });

  it('NÃO renderiza 🏅 Best-seller quando desabilitado, mesmo com vendas altas', () => {
    velMock = [{ avg_daily_depletion_7d: 100 }];
    settingsMock = {
      ...settingsMock,
      bestSeller: { enabled: false, minAvgDailyDepletion7d: 15 },
    };
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-6'));
    expect(result.current.badges.find((b) => b.type === 'best-seller')).toBeUndefined();
  });

  it('expõe description com critério explicativo nas badges (tooltip)', () => {
    intelMock = { is_hot_product: true };
    velMock = [{ avg_daily_depletion_7d: 50 }];
    const { result } = renderHook(() => useProductIntelligenceBadges('prod-7'));
    const hot = result.current.badges.find((b) => b.type === 'hot-item');
    const best = result.current.badges.find((b) => b.type === 'best-seller');
    expect(hot?.description).toBeTruthy();
    expect(best?.description).toBeTruthy();
  });
});
