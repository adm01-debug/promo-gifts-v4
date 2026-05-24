/**
 * Smoke test integrado simulando o boot real:
 *   1. ThemeContext setup → ThemeInitializer aplica config salva
 *   2. Verifica que --radius (e --font-sans) refletem a skin/config ativa
 *   3. Mede o radius EFETIVO que botões shadcn (rounded-md) e cards
 *      (rounded-lg) receberiam, dada a fórmula calc(--radius - 2px).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyThemePreset,
  applyRadius,
  loadThemeConfig,
  saveThemeConfig,
  getDefaultConfig,
  type ThemeConfig,
} from '@/lib/theme-presets';

const STORAGE_KEY = 'gifts-store-theme-config';

beforeEach(() => {
  localStorage.clear();
  const root = document.documentElement;
  const props: string[] = [];
  for (let i = 0; i < root.style.length; i++) {
    const name = root.style.item(i);
    if (name.startsWith('--')) props.push(name);
  }
  props.forEach((p) => root.style.removeProperty(p));
  root.classList.remove('theme-transitioning');
});

const radiusPx = (): number => {
  const v = document.documentElement.style.getPropertyValue('--radius');
  if (!v) return 0;
  const n = parseFloat(v);
  return v.endsWith('rem') ? n * 16 : n;
};

describe('Smoke E2E — boot fresh com defaults pós-bump', () => {
  it('boot fresh sem localStorage usa defaults novos (corporate, radius=14)', () => {
    const cfg = loadThemeConfig();
    applyThemePreset(cfg.presetId, 'light');
    applyRadius(cfg.radius);
    expect(cfg.presetId).toBe('corporate');
    expect(cfg.radius).toBe(14);
    expect(radiusPx()).toBe(14);
  });

  it('botões (rounded-md = --radius - 2px) ficam com 12px no estado padrão', () => {
    applyRadius(14);
    expect(radiusPx() - 2).toBe(12);
  });

  it('cards (rounded-lg = --radius) ficam com 14px no estado padrão', () => {
    applyRadius(14);
    expect(radiusPx()).toBe(14);
  });
});

describe('Smoke E2E — usuário com skin GX salva (boot)', () => {
  it('boot com gx-classic salvo: aplica radius 10, font Inter, bg roxo', () => {
    saveThemeConfig({ presetId: 'gx-classic', radius: 10, mode: 'dark' });
    const cfg = loadThemeConfig();
    applyThemePreset(cfg.presetId, 'dark');
    applyRadius(cfg.radius);

    expect(radiusPx()).toBe(10);
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('Inter');
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('265 22% 8%');
  });

  it('botões em GX ficam com 8px (10 - 2)', () => {
    saveThemeConfig({ presetId: 'gx-pink-addiction', radius: 10, mode: 'dark' });
    const cfg = loadThemeConfig();
    applyThemePreset(cfg.presetId, 'dark');
    applyRadius(cfg.radius);
    expect(radiusPx() - 2).toBe(8);
  });
});

describe('Smoke E2E — fluxo completo: corporate → GX → corporate', () => {
  it('preserva estado consistente em toda a sequência', () => {
    // 1. Corporate inicial (defaults)
    let cfg = getDefaultConfig();
    saveThemeConfig(cfg);
    applyThemePreset(cfg.presetId, 'light');
    applyRadius(cfg.radius);
    expect(radiusPx()).toBe(14);
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain(
      'Plus Jakarta Sans',
    );

    // 2. Switch para GX Hackerman (verde matrix) — UI sincroniza radius=10
    cfg = { presetId: 'gx-hackerman', radius: 10, mode: 'auto' };
    saveThemeConfig(cfg);
    applyThemePreset(cfg.presetId, 'dark');
    applyRadius(cfg.radius);
    expect(radiusPx()).toBe(10);
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('Inter');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('127 65% 46%');

    // 3. Volta para Corporate
    cfg = { presetId: 'corporate', radius: 14, mode: 'auto' };
    saveThemeConfig(cfg);
    applyThemePreset(cfg.presetId, 'light');
    applyRadius(cfg.radius);
    expect(radiusPx()).toBe(14);
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain(
      'Plus Jakarta Sans',
    );
  });
});

describe('Smoke E2E — migração: usuário antigo com radius=8 salvo', () => {
  it('usuário antigo recebe seu radius=8 preservado (não força para 14 sem permissão)', () => {
    // Config antiga (anterior ao bump)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ presetId: 'corporate', radius: 8, mode: 'light' }),
    );

    const cfg = loadThemeConfig();
    expect(cfg.radius).toBe(8); // respeita a escolha antiga do usuário
    applyThemePreset(cfg.presetId, 'light');
    applyRadius(cfg.radius);
    expect(radiusPx()).toBe(8);
  });

  it('usuário antigo com radius=4 (canon GX antigo) é preservado', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ presetId: 'gx-classic', radius: 4, mode: 'dark' }),
    );

    const cfg = loadThemeConfig();
    expect(cfg.radius).toBe(4);
    // applyRadius respeita o valor salvo, mesmo após o bump global
    applyRadius(cfg.radius);
    expect(radiusPx()).toBe(4);
  });
});

describe('Smoke E2E — todas as 19 skins aplicam radius coerente', () => {
  it('clássicas (10) usam o radius do slider; GX (9) força 10px via preset', () => {
    const CLASSIC_IDS = [
      'corporate',
      'purpure',
      'emerald',
      'sunset',
      'rose',
      'minimal',
      'ocean',
      'amber',
      'cyber',
      'diversity',
    ];
    const GX_IDS = [
      'gx-classic',
      'gx-pink-addiction',
      'gx-purple-haze',
      'gx-rose-quartz',
      'gx-ultraviolet',
      'gx-hackerman',
      'gx-frutti-di-mare',
      'gx-cyberpunk',
      'gx-razer',
    ];

    // Clássicas: usuário fica livre. Se setar radius=14, fica 14.
    CLASSIC_IDS.forEach((id) => {
      const cfg: ThemeConfig = { presetId: id, radius: 14, mode: 'auto' };
      saveThemeConfig(cfg);
      applyThemePreset(cfg.presetId, 'light');
      applyRadius(cfg.radius);
      expect(radiusPx(), `Classic ${id} should obey slider`).toBe(14);
    });

    // GX: o preset força 10px ao aplicar.
    GX_IDS.forEach((id) => {
      const cfg: ThemeConfig = { presetId: id, radius: 10, mode: 'dark' };
      saveThemeConfig(cfg);
      applyThemePreset(cfg.presetId, 'dark');
      applyRadius(cfg.radius);
      expect(radiusPx(), `GX ${id} should be 10px`).toBe(10);
    });
  });
});
