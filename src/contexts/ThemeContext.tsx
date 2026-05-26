import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { performanceTracker } from '@/utils/performance';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isFallback?: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'auto',
  storageKey = 'gifts-store-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  });

  // Atualizar tema quando mudar
  useEffect(() => {
    const root = window.document.documentElement;

    // Remover temas anteriores
    root.classList.remove('light', 'dark');

    let resolved: 'light' | 'dark';
    if (theme === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = theme;
    }

    root.classList.add(resolved);
    setActualTheme(resolved);
  }, [theme]);

  // Listener para mudanças no tema do sistema
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setActualTheme(resolved);
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Listener for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        setThemeState(e.newValue as Theme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  const setTheme = (newTheme: Theme) => {
    performanceTracker.startThemeChange(newTheme);
    const apply = () => {
      localStorage.setItem(storageKey, newTheme);
      setThemeState(newTheme);
      // We assume the transition ends after state update and class application in the next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          performanceTracker.endThemeChange(newTheme);
        });
      });
    };

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(apply);
    } else {
      apply();
    }
  };

  const toggleTheme = () => {
    const nextTheme = actualTheme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
    toggleTheme,
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
      theme: 'light',
      actualTheme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
      isFallback: true,
    } as ThemeContextType;
  }

  return { ...context, isFallback: false };
}
