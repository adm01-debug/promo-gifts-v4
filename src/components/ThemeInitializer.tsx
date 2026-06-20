import { useContext, useEffect } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';
import { loadThemeConfig, applyThemePreset, applyRadius } from '@/lib/theme-presets';

import { logger } from '@/lib/logger';
/**
 * ThemeInitializer — mounted globally in App.tsx, OUTSIDE routes.
 * Restores the saved skin on every page load and when light/dark mode changes.
 * Per-preset font / radius (Opera GX) são aplicados dentro de applyThemePreset.
 *
 * Usa `useContext` direto (não `useTheme`) para não quebrar durante HMR
 * caso o contexto temporariamente venha undefined.
 */
export function ThemeInitializer() {
  const ctx = useContext(ThemeContext);

  useEffect(() => {
    // Only run when context is actually available
    if (!ctx) {
      if (import.meta.env.DEV) {
        logger.warn('[ThemeInitializer] Waiting for ThemeContext to be mounted...');
      }
      return;
    }

    const cfg = loadThemeConfig();
    // Dark mode is locked app-wide; never resolve 'auto' here to avoid
    // applying light tokens when the OS is in light mode.
    applyThemePreset(cfg.presetId, 'dark');
    applyRadius(cfg.radius);
  }, [ctx, ctx?.actualTheme]);

  return null;
}
