import React from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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

/**
 * Side Panel deslizante
 */
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
  const sizeClasses = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[28rem]',
    xl: 'w-[32rem]',
  };

  const slideAnimation = {
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {overlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={onClose}
            />
          )}
          <motion.div
            {...slideAnimation[side]}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed top-0 z-50 h-full bg-background shadow-2xl',
              sizeClasses[size],
              side === 'left' ? 'left-0' : 'right-0',
            )}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
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

              {/* Content */}
              <ScrollArea className="flex-1 p-4">{children}</ScrollArea>

              {/* Footer */}
              {footer && <div className="border-t p-4">{footer}</div>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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

/**
 * Sidebar colapsável
 */
export function CollapsibleSidebar({
  children,
  isCollapsed,
  onToggle,
  collapsedContent,
  className,
  side = 'left',
}: CollapsibleSidebarProps) {
  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 280 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative flex h-full flex-col border-r bg-background',
        side === 'right' && 'border-l border-r-0',
        className,
      )}
    >
      {/* Toggle Button */}
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

      {/* Content */}
      <AnimatePresence mode="wait">
        {isCollapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden"
          >
            {collapsedContent}
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-auto"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

interface ResizablePanelGroupProps {
  children: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Wrapper simples para layouts de painéis
 */
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

/**
 * Painel expansível com animação
 */
export function ExpandablePanel({
  children,
  title,
  isExpanded,
  onToggle,
  className,
}: ExpandablePanelProps) {
  return (
    <motion.div layout className={cn('rounded-lg border bg-card', className)}>
      <button onClick={onToggle} className="flex w-full items-center justify-between p-4 text-left">
        <span className="font-medium">{title}</span>
        {isExpanded ? (
          <Minimize2 className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
