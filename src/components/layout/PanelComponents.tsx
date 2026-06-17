import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidePanelProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  overlay?: boolean;
  footer?: React.ReactNode;
}

const SIDE_PANEL_SIZE_CLASSES = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[28rem]',
  xl: 'w-[32rem]',
} as const;

export function SidePanel({
  children,
  isOpen,
  onClose,
  title,
  description,
  side = 'right',
  size = 'md',
  overlay = true,
  footer,
}: SidePanelProps) {
  return (
    <>
      {overlay && (
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200',
            isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'fixed top-0 z-50 h-full bg-background shadow-2xl transition-transform duration-200',
          SIDE_PANEL_SIZE_CLASSES[size],
          side === 'left' ? 'left-0' : 'right-0',
          isOpen ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full',
          !isOpen && 'pointer-events-none',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b p-4">
            <div>
              {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
          {footer && <div className="border-t p-4">{footer}</div>}
        </div>
      </div>
    </>
  );
}

interface CollapsibleSidebarProps {
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  collapsedContent?: React.ReactNode;
  className?: string;
  side?: 'left' | 'right';
}

export function CollapsibleSidebar({
  children,
  isCollapsed,
  onToggle,
  collapsedContent,
  className,
  side = 'left',
}: CollapsibleSidebarProps) {
  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r bg-background transition-[width] duration-200',
        side === 'right' && 'border-l border-r-0',
        isCollapsed ? 'w-16' : 'w-[280px]',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Avançar"
        onClick={onToggle}
        className={cn(
          'absolute top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-sm',
          side === 'left' ? '-right-3' : '-left-3',
        )}
      >
        {isCollapsed ? (
          side === 'left' ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )
        ) : side === 'left' ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {isCollapsed ? (
        <div className="flex-1 animate-fade-in overflow-hidden">{collapsedContent}</div>
      ) : (
        <div className="flex-1 animate-fade-in overflow-auto">{children}</div>
      )}
    </aside>
  );
}

interface ResizablePanelGroupProps {
  children: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function ResizablePanelGroup({
  children,
  direction = 'horizontal',
  className,
}: ResizablePanelGroupProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full',
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ExpandablePanelProps {
  children: React.ReactNode;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function ExpandablePanel({
  children,
  title,
  isExpanded,
  onToggle,
  className,
}: ExpandablePanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isExpanded) {
      el.style.height = `${el.scrollHeight}px`;
      el.style.opacity = '1';
      const onEnd = () => {
        el.style.height = 'auto';
      };
      el.addEventListener('transitionend', onEnd, { once: true });
      return () => el.removeEventListener('transitionend', onEnd);
    }

    el.style.height = `${el.scrollHeight}px`;
    requestAnimationFrame(() => {
      el.style.height = '0';
      el.style.opacity = '0';
    });
  }, [isExpanded]);

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="font-medium">{title}</span>
        {isExpanded ? (
          <Minimize2 className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div
        ref={contentRef}
        className="overflow-hidden transition-[height,opacity] duration-200"
        style={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
      >
        <div className="border-t p-4">{children}</div>
      </div>
    </div>
  );
}
