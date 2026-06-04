import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ThemeInitializer } from './ThemeInitializer';
import { ThemeContext } from '@/contexts/ThemeContext';
import * as themePresets from '@/lib/theme-presets';

vi.mock('@/lib/theme-presets', () => ({
  loadThemeConfig: vi.fn(),
  applyThemePreset: vi.fn(),
  applyRadius: vi.fn(),
  THEME_PRESETS: [{ id: 'corporate', dark: {} }],
  DEFAULT_FONT_SANS: '',
  DEFAULT_FONT_DISPLAY: '',
  CSS_VARS_TO_APPLY: []
}));

describe('ThemeInitializer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('waits for ThemeContext to be available', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <ThemeContext.Provider value={undefined as any}>
        <ThemeInitializer />
      </ThemeContext.Provider>
    );
    expect(themePresets.loadThemeConfig).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('applies theme configuration when context is available', async () => {
    const mockConfig = { presetId: 'corporate', radius: 14, mode: 'dark' };
    vi.mocked(themePresets.loadThemeConfig).mockReturnValue(mockConfig as any);

    render(
      <ThemeContext.Provider value={{ actualTheme: 'dark' } as any}>
        <ThemeInitializer />
      </ThemeContext.Provider>
    );

    await waitFor(() => {
      expect(themePresets.loadThemeConfig).toHaveBeenCalled();
      expect(themePresets.applyThemePreset).toHaveBeenCalledWith('corporate', 'dark');
      expect(themePresets.applyRadius).toHaveBeenCalledWith(14);
    });
  });
});
