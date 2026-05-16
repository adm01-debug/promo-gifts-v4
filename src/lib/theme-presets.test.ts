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
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const f = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function getContrastRatio(l1: number, l2: number): number {
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}


describe('Theme Presets Consistency & Contrast', () => {
  it('should not override default fonts in classic presets', () => {
    THEME_PRESETS.filter(p => p.category === 'classic').forEach(preset => {
      // Diversity is an exception as it's a special classic preset
      if (preset.id === 'diversity') return;
      expect(preset.font, `Classic preset "${preset.name}" (${preset.id}) should not override the default font stack.`).toBeUndefined();
    });
  });

  it('should use default font constants as exported', () => {
    expect(DEFAULT_FONT_SANS).toBe("'Plus Jakarta Sans', system-ui, sans-serif");
    expect(DEFAULT_FONT_DISPLAY).toBe("'Outfit', system-ui, sans-serif");
  });

  it('should have basic color tokens defined in both light and dark modes', () => {
    const requiredTokens = ['primary', 'background', 'foreground', 'card', 'border'];
    THEME_PRESETS.forEach(preset => {
      requiredTokens.forEach(token => {
        expect(preset.light[token as keyof typeof preset.light], `Preset "${preset.name}" is missing "${token}" in light mode.`).toBeDefined();
        expect(preset.dark[token as keyof typeof preset.dark], `Preset "${preset.name}" is missing "${token}" in dark mode.`).toBeDefined();
      });
    });
  });

  it('should maintain WCAG contrast ratios for key text elements', () => {
    THEME_PRESETS.forEach(preset => {
      // Light Mode Contrast
      const lightBgLum = hslToLuminance(preset.light.background);
      const lightFgLum = hslToLuminance(preset.light.foreground);
      const lightContrast = getContrastRatio(lightBgLum, lightFgLum);
      expect(lightContrast, `Preset "${preset.name}" (Light) background/foreground contrast: ${lightContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

      const lightCardLum = hslToLuminance(preset.light.card);
      const lightCardFgLum = hslToLuminance(preset.light['card-foreground']);
      const lightCardContrast = getContrastRatio(lightCardLum, lightCardFgLum);
      expect(lightCardContrast, `Preset "${preset.name}" (Light) card contrast: ${lightCardContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

      // Dark Mode Contrast
      const darkBgLum = hslToLuminance(preset.dark.background);
      const darkFgLum = hslToLuminance(preset.dark.foreground);
      const darkContrast = getContrastRatio(darkBgLum, darkFgLum);
      expect(darkContrast, `Preset "${preset.name}" (Dark) background/foreground contrast: ${darkContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

      const darkCardLum = hslToLuminance(preset.dark.card);
      const darkCardFgLum = hslToLuminance(preset.dark['card-foreground']);
      const darkCardContrast = getContrastRatio(darkCardLum, darkCardFgLum);
      expect(darkCardContrast, `Preset "${preset.name}" (Dark) card contrast: ${darkCardContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

      // Primary Button Contrast (Light)
      const primaryLum = hslToLuminance(preset.light.primary);
      const primaryFgLum = hslToLuminance(preset.light['primary-foreground']);
      const primaryContrast = getContrastRatio(primaryLum, primaryFgLum);
      expect(primaryContrast, `Preset "${preset.name}" (Light) primary button contrast: ${primaryContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);

      // Primary Button Contrast (Dark)
      const darkPrimaryLum = hslToLuminance(preset.dark.primary);
      const darkPrimaryFgLum = hslToLuminance(preset.dark['primary-foreground']);
      const darkPrimaryContrast = getContrastRatio(darkPrimaryLum, darkPrimaryFgLum);
      expect(darkPrimaryContrast, `Preset "${preset.name}" (Dark) primary button contrast: ${darkPrimaryContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  });

  it('should maintain consistent category types', () => {
    THEME_PRESETS.forEach(preset => {
      expect(['classic', 'gx']).toContain(preset.category);
    });
  });
});
