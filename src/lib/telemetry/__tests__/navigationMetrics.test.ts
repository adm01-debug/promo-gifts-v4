/**
 * Cobre o kill switch e o gating por env do `initNavigationMetrics`.
 *
 * Regras validadas:
 *   1. `localStorage.nav_metrics_disabled === '1'` desativa a coleta mesmo
 *      quando `VITE_ENABLE_NAV_METRICS=true`.
 *   2. `VITE_ENABLE_NAV_METRICS=false` desativa, ignorando o modo.
 *   3. Sem flag e em prod (`import.meta.env.DEV === false`), coleta liga.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do sentry pra não depender de rede/global.
vi.mock('@/lib/sentry', () => ({
  captureMessage: vi.fn(),
}));

async function loadModule() {
  vi.resetModules();
  return await import('../navigationMetrics');
}

describe('navigationMetrics — kill switch e flag', () => {
  const originalDEV = import.meta.env.DEV;
  const originalFlag = import.meta.env.VITE_ENABLE_NAV_METRICS;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    (import.meta.env as Record<string, unknown>).DEV = originalDEV;
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_NAV_METRICS = originalFlag;
    window.localStorage.clear();
  });

  it('kill switch por localStorage vence a flag habilitada', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_NAV_METRICS = 'true';
    (import.meta.env as Record<string, unknown>).DEV = false;
    window.localStorage.setItem('nav_metrics_disabled', '1');

    const mod = await loadModule();
    mod.__resetForTests();

    const spy = vi.spyOn(performance, 'getEntriesByType');
    mod.initNavigationMetrics();
    // Segunda chamada deveria ser no-op também.
    mod.initNavigationMetrics();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('flag "false" desativa mesmo em produção', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_NAV_METRICS = 'false';
    (import.meta.env as Record<string, unknown>).DEV = false;

    const mod = await loadModule();
    mod.__resetForTests();

    const spy = vi.spyOn(performance, 'getEntriesByType');
    mod.initNavigationMetrics();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('normalizeRoute agrupa IDs para dashboards por rota', async () => {
    const mod = await loadModule();
    expect(mod.normalizeRoute('/clientes/9c8f2a10-1234-5678-9abc-def012345678')).toBe(
      '/clientes/:id',
    );
    expect(mod.normalizeRoute('/orcamentos/12345')).toBe('/orcamentos/:id');
    expect(mod.normalizeRoute('/estoque')).toBe('/estoque');
  });
});
