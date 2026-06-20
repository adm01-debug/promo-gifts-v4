import { describe, it, expect } from 'vitest';
import { THEME_PRESETS, DEFAULT_FONT_SANS, DEFAULT_FONT_DISPLAY } from './theme-presets';

// Helper to convert HSL string to RGB and then calculate relative luminance
function hslToLuminance(hslStr: string): number {
  const parts = hslStr.replace(/%/g, '').split(/[\s/]+/);
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  let r, g, b;

  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function getContrastRatio(l1: number, l2: number): number {
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// =====================================================================
// T-FIX-4: cada preset vira UM caso isolado via it.each — falhas em
// presets distintos não se mascaram mais. Anteriormente um forEach()
// abortava na primeira asserção falha e escondia os bugs idênticos em
// gx-hackerman, gx-frutti-di-mare e gx-razer (só Rose Quartz aparecia
// no log do CI). Ver REDEPLOY-T-FIX-4 ou commit anterior para o caso.
// =====================================================================

const CLASSIC_PRESETS = THEME_PRESETS.filter((p) => p.category === 'classic');
const REQUIRED_TOKENS = ['primary', 'background', 'foreground', 'card', 'border'] as const;

describe('Theme Presets Consistency & Contrast', () => {
  it('should use default font constants as exported', () => {
    expect(DEFAULT_FONT_SANS).toBe("'Plus Jakarta Sans', system-ui, sans-serif");
    expect(DEFAULT_FONT_DISPLAY).toBe("'Outfit', system-ui, sans-serif");
  });

  describe('font defaults (classic presets, excluding diversity)', () => {
    // Diversity is an exception as it's a special classic preset.
    const classicNonDiversity = CLASSIC_PRESETS.filter((p) => p.id !== 'diversity');

    it.each(classicNonDiversity)(
      'preset $name ($id) should not override the default font stack',
      (preset) => {
        expect(preset.font).toBeUndefined();
      },
    );
  });

  describe('required color tokens (each preset × each token)', () => {
    // Cross product: cada combinação preset × token vira um caso isolado.
    // Se um token estiver faltando em gx-razer.dark, isso não esconde um
    // token faltando em rose.light.
    const cases = THEME_PRESETS.flatMap((preset) =>
      REQUIRED_TOKENS.flatMap((token) => [
        { preset, token, mode: 'light' as const },
        { preset, token, mode: 'dark' as const },
      ]),
    );

    it.each(cases)(
      'preset $preset.name should define "$token" in $mode mode',
      ({ preset, token, mode }) => {
        const value = preset[mode][token as keyof typeof preset.light];
        expect(value).toBeDefined();
      },
    );
  });

  describe('WCAG contrast ratios (each preset isolated, soft expects within)', () => {
    // Cada preset = 1 caso isolado. Dentro do caso, usamos expect.soft
    // para coletar TODAS as 6 dimensões de contraste falhas no mesmo run,
    // não só a primeira. Isso garante que bugs em primary-light E
    // primary-dark do MESMO preset apareçam juntos.
    it.each(THEME_PRESETS)('preset $name ($id) should pass all WCAG contrast checks', (preset) => {
      // Light Mode bg/fg
      const lightBgLum = hslToLuminance(preset.light.background);
      const lightFgLum = hslToLuminance(preset.light.foreground);
      const lightContrast = getContrastRatio(lightBgLum, lightFgLum);
      expect
        .soft(
          lightContrast,
          `Light background/foreground: ${lightContrast.toFixed(2)}:1 (need >= 4.5)`,
        )
        .toBeGreaterThanOrEqual(4.5);

      // Light Mode card
      const lightCardLum = hslToLuminance(preset.light.card);
      const lightCardFgLum = hslToLuminance(preset.light['card-foreground']);
      const lightCardContrast = getContrastRatio(lightCardLum, lightCardFgLum);
      expect
        .soft(
          lightCardContrast,
          `Light card contrast: ${lightCardContrast.toFixed(2)}:1 (need >= 4.5)`,
        )
        .toBeGreaterThanOrEqual(4.5);

      // Dark Mode bg/fg
      const darkBgLum = hslToLuminance(preset.dark.background);
      const darkFgLum = hslToLuminance(preset.dark.foreground);
      const darkContrast = getContrastRatio(darkBgLum, darkFgLum);
      expect
        .soft(
          darkContrast,
          `Dark background/foreground: ${darkContrast.toFixed(2)}:1 (need >= 4.5)`,
        )
        .toBeGreaterThanOrEqual(4.5);

      // Dark Mode card
      const darkCardLum = hslToLuminance(preset.dark.card);
      const darkCardFgLum = hslToLuminance(preset.dark['card-foreground']);
      const darkCardContrast = getContrastRatio(darkCardLum, darkCardFgLum);
      expect
        .soft(
          darkCardContrast,
          `Dark card contrast: ${darkCardContrast.toFixed(2)}:1 (need >= 4.5)`,
        )
        .toBeGreaterThanOrEqual(4.5);

      // Primary Button Contrast (Light)
      const primaryLum = hslToLuminance(preset.light.primary);
      const primaryFgLum = hslToLuminance(preset.light['primary-foreground']);
      const primaryContrast = getContrastRatio(primaryLum, primaryFgLum);
      expect
        .soft(
          primaryContrast,
          `Light primary button contrast: ${primaryContrast.toFixed(2)}:1 (need >= 3)`,
        )
        .toBeGreaterThanOrEqual(3);

      // Primary Button Contrast (Dark)
      const darkPrimaryLum = hslToLuminance(preset.dark.primary);
      const darkPrimaryFgLum = hslToLuminance(preset.dark['primary-foreground']);
      const darkPrimaryContrast = getContrastRatio(darkPrimaryLum, darkPrimaryFgLum);
      expect
        .soft(
          darkPrimaryContrast,
          `Dark primary button contrast: ${darkPrimaryContrast.toFixed(2)}:1 (need >= 3)`,
        )
        .toBeGreaterThanOrEqual(3);
    });
  });

  describe('category consistency', () => {
    it.each(THEME_PRESETS)('preset $name ($id) should have a valid category', (preset) => {
      expect(['classic', 'gx']).toContain(preset.category);
    });
  });
});
