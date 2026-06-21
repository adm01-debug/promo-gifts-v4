import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface A11yContextType {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'large' | 'larger' | 'normal';
  keyboardMode: boolean;
  announceMessage: (message: string, priority?: 'assertive' | 'polite') => void;
  setFontSize: (size: 'large' | 'larger' | 'normal') => void;
  setHighContrast: (enabled: boolean) => void;
}

const A11yContext = createContext<A11yContextType | null>(null);

const FONT_SIZE_PX: Record<'large' | 'larger' | 'normal', string> = {
  normal: '16px',
  large: '18px',
  larger: '20px',
} as const;

export function useA11y() {
  const context = useContext(A11yContext);
  if (!context) {
    throw new Error('useA11y must be used within an AccessibilityProvider');
  }
  return context;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<'large' | 'larger' | 'normal'>('normal');
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [announcement, setAnnouncement] = useState<{
    message: string;
    priority: 'assertive' | 'polite';
  } | null>(null);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Detect high contrast preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    setHighContrast(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setHighContrast(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Detect keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setKeyboardMode(true);
      }
    };

    const handleMouseDown = () => {
      setKeyboardMode(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Apply font size to document
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = FONT_SIZE_PX[fontSize];
  }, [fontSize]);

  // Apply high contrast class
  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [highContrast]);

  // Apply keyboard mode class
  useEffect(() => {
    if (keyboardMode) {
      document.documentElement.classList.add('keyboard-mode');
    } else {
      document.documentElement.classList.remove('keyboard-mode');
    }
  }, [keyboardMode]);

  const announceMessage = (message: string, priority: 'assertive' | 'polite' = 'polite') => {
    setAnnouncement({ message, priority });
    // Clear after announcement
    setTimeout(() => setAnnouncement(null), 1000);
  };

  return (
    <A11yContext.Provider
      value={{
        reducedMotion,
        highContrast,
        fontSize,
        keyboardMode,
        announceMessage,
        setFontSize,
        setHighContrast,
      }}
    >
      {children}

      {/* Screen Reader Announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement?.priority === 'polite' && announcement.message}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcement?.priority === 'assertive' && announcement.message}
      </div>
    </A11yContext.Provider>
  );
}

// Skip to Main Content Link
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="fixed left-0 top-0 z-[9999] m-3 -translate-y-full transform rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Pular para o conteúdo principal
    </a>
  );
}

// Focus Trap Hook
export function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    firstFocusable?.focus();

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, isActive]);
}

// Keyboard Shortcut Hook
export function useKeyboardShortcut(
  shortcut: string,
  callback: () => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {},
) {
  const { enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const keys = shortcut.toLowerCase().split('+');
    const targetKey = keys[keys.length - 1];
    const modifiers = {
      ctrl: keys.includes('ctrl'),
      shift: keys.includes('shift'),
      alt: keys.includes('alt'),
      meta: keys.includes('meta') || keys.includes('cmd'),
    };

    const handler = (e: KeyboardEvent) => {
      const isMatch =
        e.key.toLowerCase() === targetKey &&
        e.ctrlKey === modifiers.ctrl &&
        e.shiftKey === modifiers.shift &&
        e.altKey === modifiers.alt &&
        e.metaKey === modifiers.meta;

      if (isMatch) {
        if (preventDefault) {
          e.preventDefault();
        }
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcut, callback, enabled, preventDefault]);
}
