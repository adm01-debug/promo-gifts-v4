import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import React from 'react';

// Mock storage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Tooltip Style Logic', () => {
  it('should toggle between standard and compact', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    // Default should be standard
    expect(result.current.tooltipStyle).toBe('standard');

    // Toggle to compact
    act(() => {
      result.current.setTooltipStyle('compact');
    });
    expect(result.current.tooltipStyle).toBe('compact');
    expect(document.documentElement.classList.contains('tooltip-compact')).toBe(true);
    expect(document.documentElement.classList.contains('tooltip-standard')).toBe(false);

    // Toggle back to standard
    act(() => {
      result.current.setTooltipStyle('standard');
    });
    expect(result.current.tooltipStyle).toBe('standard');
    expect(document.documentElement.classList.contains('tooltip-standard')).toBe(true);
    expect(document.documentElement.classList.contains('tooltip-compact')).toBe(false);
  });
});
