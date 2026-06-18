/**
 * Focus Trap Component
 * Traps keyboard focus within a container for accessibility
 */

import React, { useEffect, useRef, type ReactNode, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
  autoFocus?: boolean;
  returnFocus?: boolean;
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

const SENTINEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  opacity: 0,
};

export function FocusTrap({
  children,
  active = true,
  autoFocus = true,
  returnFocus = true,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return [...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (el) => el.offsetParent !== null,
    );
  }, []);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements.at(-1)?.focus();
    }
  }, [getFocusableElements]);

  // Handle Tab key navigation
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, getFocusableElements]);

  // Store previous focus and auto-focus first element
  useEffect(() => {
    if (active && autoFocus) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      focusFirst();
    }

    return () => {
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, autoFocus, returnFocus, focusFirst]);

  // Ensure focus stays within container
  useEffect(() => {
    if (!active) return;

    const handleFocusIn = (e: FocusEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        e.stopImmediatePropagation();
        focusFirst();
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [active, focusFirst]);

  return (
    <div ref={containerRef} className={className}>
      {/* Start sentinel */}
      <div
        tabIndex={active ? 0 : -1}
        onFocus={focusLast}
        style={SENTINEL_STYLE}
        aria-hidden="true"
      />

      {children}

      {/* End sentinel */}
      <div
        tabIndex={active ? 0 : -1}
        onFocus={focusFirst}
        style={SENTINEL_STYLE}
        aria-hidden="true"
      />
    </div>
  );
}

// Hook for managing focus trap
export function useFocusTrap(active: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return [...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (el) => el.offsetParent !== null,
    );
  }, []);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements.at(-1)?.focus();
    }
  }, [getFocusableElements]);

  useEffect(() => {
    if (!active) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    focusFirst();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, getFocusableElements, focusFirst]);

  return { containerRef, focusFirst, focusLast };
}

// Accessible Modal wrapper with focus trap
interface AccessibleModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
}

export function AccessibleModal({
  children,
  isOpen,
  onClose,
  ariaLabel,
  ariaDescribedBy,
  className,
}: AccessibleModalProps) {
  const { containerRef } = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={containerRef}
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'max-h-[85vh] w-full max-w-lg overflow-auto',
          'rounded-lg border bg-background shadow-lg',
          'p-6',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
