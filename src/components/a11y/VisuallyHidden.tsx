import React, { type ReactNode } from 'react';

interface VisuallyHiddenProps {
  children: ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Use for descriptive text that provides context for assistive technologies.
 */
export function VisuallyHidden({ children, as: component = 'span' }: VisuallyHiddenProps) {
  const Component = component;
  return <Component className="sr-only">{children}</Component>;
}

/**
 * Announces content to screen readers using ARIA live regions.
 * Use for dynamic content updates that should be announced.
 */
interface LiveRegionProps {
  children: ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
}

export function LiveRegion({ children, politeness = 'polite', atomic = true }: LiveRegionProps) {
  return (
    <div role="status" aria-live={politeness} aria-atomic={atomic} className="sr-only">
      {children}
    </div>
  );
}

/**
 * Provides accessible loading announcements.
 */
interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  loadedMessage?: string;
}

export function LoadingAnnouncer({
  isLoading,
  loadingMessage = 'Carregando...',
  loadedMessage = 'Conteúdo carregado',
}: LoadingAnnouncerProps) {
  return <LiveRegion politeness="polite">{isLoading ? loadingMessage : loadedMessage}</LiveRegion>;
}
