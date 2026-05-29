import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeInitializer } from '../components/ThemeInitializer';
import { ThemeContext } from '../contexts/ThemeContext';
import * as themePresets from '../lib/theme-presets';
import React from 'react';

// Mock the theme-presets module
vi.mock('../lib/theme-presets', () => ({
  loadThemeConfig: vi.fn(),
  applyThemePreset: vi.fn(),
  applyRadius: vi.fn(),
}));

describe('ThemeInitializer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(themePresets.loadThemeConfig).mockReturnValue({
      presetId: 'default',
      radius: 4,
      mode: 'light' as const,
    });
  });

  it('should not call apply functions if ThemeContext is not available', () => {
    // Render without provider (ctx will be undefined in ThemeInitializer)
    render(<ThemeInitializer />);

    expect(themePresets.applyThemePreset).not.toHaveBeenCalled();
    expect(themePresets.applyRadius).not.toHaveBeenCalled();
  });

  it('should call apply functions when ThemeContext is available', () => {
    const mockContext = {
      theme: 'light' as const,
      actualTheme: 'light' as const,
      tooltipStyle: 'standard' as const,
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
      setTooltipStyle: vi.fn(),
    };

    render(
      <ThemeContext.Provider value={mockContext}>
        <ThemeInitializer />
      </ThemeContext.Provider>,
    );

    expect(themePresets.applyThemePreset).toHaveBeenCalledWith('default', 'light');
    expect(themePresets.applyRadius).toHaveBeenCalledWith(4);
  });

  it('should re-apply theme when actualTheme changes (HMR/Re-render simulation)', () => {
    const { rerender } = render(
      <ThemeContext.Provider
        value={{
          theme: 'light',
          actualTheme: 'light',
          tooltipStyle: 'standard',
          setTheme: vi.fn(),
          toggleTheme: vi.fn(),
          setTooltipStyle: vi.fn(),
        }}
      >
        <ThemeInitializer />
      </ThemeContext.Provider>,
    );

    expect(themePresets.applyThemePreset).toHaveBeenCalledWith('default', 'light');

    // Simulate theme change/re-render
    rerender(
      <ThemeContext.Provider
        value={{
          theme: 'dark',
          actualTheme: 'dark',
          tooltipStyle: 'standard',
          setTheme: vi.fn(),
          toggleTheme: vi.fn(),
          setTooltipStyle: vi.fn(),
        }}
      >
        <ThemeInitializer />
      </ThemeContext.Provider>,
    );

    expect(themePresets.applyThemePreset).toHaveBeenCalledWith('default', 'dark');
  });
});
