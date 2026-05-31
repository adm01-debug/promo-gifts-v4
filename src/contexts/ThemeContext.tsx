import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { performanceTracker } from '@/utils/performance';

type Theme = 'dark';
type TooltipStyle = 'compact' | 'standard';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'dark';
  tooltipStyle: TooltipStyle;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setTooltipStyle: (style: TooltipStyle) => void;
  isFallback?: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  tooltipStorageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'gifts-store-theme',
  tooltipStorageKey = 'gifts-store-tooltip-style',
}: ThemeProviderProps) {
  // Force dark theme regardless of what's in localStorage
  const [theme] = useState<Theme>('dark');

  const [tooltipStyle, setTooltipStyleState] = useState<TooltipStyle>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(tooltipStorageKey) as TooltipStyle) || 'standard';
    }
    return 'standard';
  });

  const [actualTheme] = useState<'dark'>('dark');

  // Force dark theme class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
  }, []);

  // Atualizar classe do tooltip style
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('tooltip-compact', 'tooltip-standard');
    root.classList.add(`tooltip-${tooltipStyle}`);
  }, [tooltipStyle]);

  // Listener for changes from other tabs - simplified as theme is fixed
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue && e.newValue !== 'dark') {
        localStorage.setItem(storageKey, 'dark');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  const setTheme = (newTheme: Theme) => {
    // Theme is fixed to dark, but we keep the storage sync just in case
    localStorage.setItem(storageKey, 'dark');
  };

    const docWithViewTransition = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (typeof document !== 'undefined' && docWithViewTransition.startViewTransition) {
      docWithViewTransition.startViewTransition(apply);
    } else {
      apply();
    }
  };

  const toggleTheme = () => {
    // No-op as theme is fixed to dark
  };

  const setTooltipStyle = (style: TooltipStyle) => {
    localStorage.setItem(tooltipStorageKey, style);
    setTooltipStyleState(style);
  };

  const value: ThemeContextType = {
    theme,
    actualTheme,
    tooltipStyle,
    setTheme,
    toggleTheme,
    setTooltipStyle,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'useTheme must be used within a ThemeProvider. Returning a fallback theme to avoid crash.',
      );
    }
    // Return a safe fallback instead of throwing
    return {
      theme: 'dark',
      actualTheme: 'dark',
      tooltipStyle: 'standard',
      setTheme: () => {},
      toggleTheme: () => {},
      setTooltipStyle: () => {},
      isFallback: true,
    } as ThemeContextType;
  }

  return { ...context, isFallback: false };
}
