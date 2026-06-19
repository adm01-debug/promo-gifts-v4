import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: number;
  border?: boolean;
  gradient?: boolean;
}

const blurLevels = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
};

export function GlassCard({
  children,
  className,
  blur = 'md',
  opacity = 80,
  border = true,
  gradient = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl',
        blurLevels[blur],
        border && 'border border-white/20 dark:border-white/10',
        gradient &&
          'bg-gradient-to-br from-white/10 to-white/5 dark:from-white/5 dark:to-white/[0.02]',
        !gradient && `bg-background/${opacity}`,
        'shadow-lg shadow-black/5',
        className,
      )}
      style={{
        backgroundColor: gradient ? undefined : `hsl(var(--background) / ${opacity / 100})`,
      }}
    >
      {children}
    </div>
  );
}

// Glass panel with more subtle effect
export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-background/60 backdrop-blur-sm',
        'rounded-lg border border-border/50',
        'shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Floating glass container (for modals, popovers)
export function GlassOverlay({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-background/80 backdrop-blur-xl',
        'rounded-2xl border border-border/30',
        'shadow-2xl shadow-black/20',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Glass button style
export function GlassButton({
  children,
  className,
  onClick,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg px-4 py-2',
        'bg-background/10 backdrop-blur-md',
        'border border-white/20 dark:border-white/10',
        'font-medium text-foreground',
        'hover:bg-background/20',
        'active:scale-[0.98]',
        'transition-all duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

// Glass header/navbar style
export function GlassHeader({
  children,
  className,
  sticky = true,
}: {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        sticky && 'sticky top-0 z-50',
        'bg-background/70 backdrop-blur-lg',
        'border-b border-border/50',
        'shadow-sm',
        className,
      )}
    >
      {children}
    </header>
  );
}

// Glass sidebar style
export function GlassSidebar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      className={cn('bg-background/80 backdrop-blur-xl', 'border-r border-border/50', className)}
    >
      {children}
    </aside>
  );
}

// Frosted glass input
export function GlassInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg px-4 py-2',
        'bg-background/10 backdrop-blur-sm',
        'border border-white/20 dark:border-white/10',
        'text-foreground placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'transition-all duration-200',
        className,
      )}
      {...props}
    />
  );
}

// Glass tooltip/popover background
export function GlassTooltip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-popover/90 backdrop-blur-xl',
        'rounded-lg border border-border/50',
        'shadow-lg',
        'p-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
