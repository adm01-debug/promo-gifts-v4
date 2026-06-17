import React from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'ultrawide' | 'full';
  centered?: boolean;
}

const CONTAINER_SIZE_CLASSES: Record<NonNullable<ContainerProps['size']>, string> = {
  xs: 'max-w-lg',
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  '2xl': 'max-w-screen-2xl',
  '3xl': 'max-w-[1600px]',
  ultrawide: 'max-w-[1920px]',
  full: 'max-w-full',
};

/** Container responsivo. xs=512px sm=672px md=896px lg=1152px xl=1280px 2xl=1400px 3xl=1600px ultrawide=1920px */
export function Container({ children, className, size = 'lg', centered = true }: ContainerProps) {
  return (
    <div
      className={cn(
        'w-full px-4 sm:px-6 lg:px-8 xl:px-10',
        CONTAINER_SIZE_CLASSES[size],
        centered && 'mx-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function Section({ children, className, title, description, action }: SectionProps) {
  return (
    <section className={cn('py-6 sm:py-8', className)}>
      {(title || description || action) && (
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

interface GridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  responsive?: boolean;
}

const GRID_GAP_CLASSES = {
  none: 'gap-0',
  xs: 'gap-1.5 sm:gap-2',
  sm: 'gap-2 sm:gap-3',
  md: 'gap-3 sm:gap-4',
  lg: 'gap-4 sm:gap-5 lg:gap-6',
} as const;

const GRID_COL_CLASSES_RESPONSIVE = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 xs:grid-cols-2',
  3: 'grid-cols-1 xs:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 ultra-wide:grid-cols-5',
  6: 'grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ultra-wide:grid-cols-6',
} as const;

const GRID_COL_CLASSES_FIXED = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
} as const;

/** Grid mobile-first com suporte a ultra-wide (1920px+) */
export function Grid({ children, className, cols = 3, gap = 'md', responsive = true }: GridProps) {
  const colClasses = responsive ? GRID_COL_CLASSES_RESPONSIVE : GRID_COL_CLASSES_FIXED;
  return (
    <div className={cn('grid', colClasses[cols], GRID_GAP_CLASSES[gap], className)}>{children}</div>
  );
}

interface StackProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'vertical' | 'horizontal';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
}

const STACK_GAP_CLASSES = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
} as const;

const STACK_ALIGN_CLASSES = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;

const STACK_JUSTIFY_CLASSES = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
} as const;

export function Stack({
  children,
  className,
  direction = 'vertical',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        STACK_GAP_CLASSES[gap],
        STACK_ALIGN_CLASSES[align],
        STACK_JUSTIFY_CLASSES[justify],
        wrap && 'flex-wrap',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface DividerProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}

export function Divider({ className, orientation = 'horizontal', label }: DividerProps) {
  if (orientation === 'vertical')
    return (
      <div
        className={cn('h-full w-px bg-border', className)}
        role="separator"
        aria-orientation="vertical"
      />
    );
  if (label)
    return (
      <div className={cn('flex items-center gap-4', className)} role="separator">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  return (
    <div
      className={cn('h-px w-full bg-border', className)}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}

interface SpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

/** Spacer responsivo: menor em mobile, maior em desktop. */
export function Spacer({ size = 'md', className }: SpacerProps) {
  const s = {
    xs: 'h-1 sm:h-2',
    sm: 'h-2 sm:h-4',
    md: 'h-4 sm:h-6',
    lg: 'h-6 sm:h-8',
    xl: 'h-8 sm:h-12',
    '2xl': 'h-10 sm:h-16',
  };
  return <div className={cn(s[size], className)} aria-hidden="true" />;
}

interface AnimatedContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedContainer({ children, className, delay = 0 }: AnimatedContainerProps) {
  return (
    <div
      className={cn('animate-fade-in-up', className)}
      style={delay > 0 ? { animationDelay: delay + 's' } : undefined}
    >
      {children}
    </div>
  );
}
