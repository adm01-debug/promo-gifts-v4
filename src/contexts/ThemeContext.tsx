import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

type TooltipStyle = 'compact' | 'standard';

interface ThemeContextType {
  theme: 'dark';
  actualTheme: 'dark';
  tooltipStyle: TooltipStyle;
  setTheme: (theme: 'dark') => void;
  toggleTheme: () => void;
  setTooltipStyle: (style: TooltipStyle) => void;
  isFallback?: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  storageKey?: string;
  tooltipStorageKey?: string;
}

export function ThemeProvider({
  children,
  storageKey = 'gifts-store-theme',
  tooltipStorageKey = 'gifts-store-tooltip-style',
}: ThemeProviderProps) {
  // Theme is strictly fixed to dark
  const theme = 'dark';
  const actualTheme = 'dark';

  const [tooltipStyle, setTooltipStyleState] = useState<TooltipStyle>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(tooltipStorageKey) as TooltipStyle) || 'standard';
    }
    return 'standard';
  });

  // Force dark theme class and remove any light-mode traces
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');

    // Cleanup any old theme preference
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored !== 'dark') {
        localStorage.setItem(storageKey, 'dark');
      }
    }
  }, [storageKey]);

  // Update tooltip style class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('tooltip-compact', 'tooltip-standard');
    root.classList.add(`tooltip-${tooltipStyle}`);
  }, [tooltipStyle]);

  // Listener for storage changes from other tabs to enforce dark mode
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue && e.newValue !== 'dark') {
        localStorage.setItem(storageKey, 'dark');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  const setTheme = useCallback(() => {
    localStorage.setItem(storageKey, 'dark');
  }, [storageKey]);

  const toggleTheme = useCallback(() => {
    // Theme is fixed to dark — no-op
  }, []);

  const setTooltipStyle = useCallback(
    (style: TooltipStyle) => {
      localStorage.setItem(tooltipStorageKey, style);
      setTooltipStyleState(style);
    },
    [tooltipStorageKey],
  );

  const value = useMemo<ThemeContextType>(
    () => ({ theme, actualTheme, tooltipStyle, setTheme, toggleTheme, setTooltipStyle }),
    [theme, actualTheme, tooltipStyle, setTheme, toggleTheme, setTooltipStyle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
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
