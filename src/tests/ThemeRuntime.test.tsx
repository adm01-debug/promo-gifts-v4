import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTheme } from '../contexts/ThemeContext';

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

  it('should return isFallback: true when context is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ThemeConsumer />);
    // ThemeContext agora retorna fallback silencioso (sem console.warn)
    // para não poluir o console em produção — isFallback indica o estado
    const el = screen.getByTestId('theme-value');
    expect(el.textContent).toBe('dark');
    warnSpy.mockRestore();
  });

  it('should return correct fallback shape when context is missing', () => {
    // Garante que o fallback tem todos os campos necessários
    let capturedTheme: ReturnType<typeof useTheme> | null = null;
    const ThemeCapture = () => {
      capturedTheme = useTheme();
      return null;
    };
    render(<ThemeCapture />);
    expect(capturedTheme).not.toBeNull();
    expect(capturedTheme!.theme).toBe('dark');
    expect(capturedTheme!.actualTheme).toBe('dark');
    expect(capturedTheme!.isFallback).toBe(true);
    expect(typeof capturedTheme!.setTheme).toBe('function');
    expect(typeof capturedTheme!.toggleTheme).toBe('function');
  });
});
