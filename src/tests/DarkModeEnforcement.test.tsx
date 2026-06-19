import { describe, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { renderHook } from '@testing-library/react';

describe('Dark Mode Enforcement', () => {
  it('should always initialize with dark theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.actualTheme).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('should have forced dark class on document element', () => {
    // This is tested by the side effect in ThemeProvider
    renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
