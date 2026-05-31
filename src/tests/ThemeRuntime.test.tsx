import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTheme } from '../contexts/ThemeContext';
import React from 'react';

// Mock component that uses useTheme
const ThemeConsumer = () => {
  const theme = useTheme();
  return <div data-testid="theme-value">{theme.actualTheme}</div>;
};

describe('Theme Runtime Safety', () => {
  it('should not crash when useTheme is used outside of ThemeProvider', () => {
    // We check that it doesn't throw, which is the primary fix
    expect(() => {
      render(<ThemeConsumer />);
    }).not.toThrow();

    expect(screen.getByTestId('theme-value')).toBeDefined();
    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
  });

  it('should show console warning only in development when context is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Test development environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(<ThemeConsumer />);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('useTheme must be used within a ThemeProvider'),
    );

    warnSpy.mockClear();

    // Test production environment
    process.env.NODE_ENV = 'production';
    render(<ThemeConsumer />);
    expect(warnSpy).not.toHaveBeenCalled();

    // Restore
    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();
  });

  it('should return isFallback: true when context is missing', () => {
    const FallbackChecker = () => {
      const { isFallback } = useTheme() as unknown as Record<string, unknown>;
      return <div data-testid="fallback-status">{isFallback ? 'true' : 'false'}</div>;
    };

    render(<FallbackChecker />);
    expect(screen.getByTestId('fallback-status').textContent).toBe('true');
  });
});
