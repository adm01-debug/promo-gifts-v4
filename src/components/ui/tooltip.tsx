import * as React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = ({ children, delayDuration = 700, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props}>
    {children}
  </TooltipPrimitive.Provider>
);

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipPortal = TooltipPrimitive.Portal;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    variant?: 'default' | 'compact'
  }
>(({ className, sideOffset = 6, variant = 'compact', ...props }, ref) => {
  const { tooltipStyle } = useTheme();
  const isCompact = tooltipStyle === 'compact';

  return (
    <TooltipPortal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-[min(calc(100vw-2rem),240px)] break-words overflow-hidden rounded-md border border-white/10 bg-[#1a1a1a]/95 text-white shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          isCompact ? 'px-2 py-1' : 'px-3 py-1.5',
          variant === 'compact' ? 'text-tooltip' : 'text-xs',
          'focus:outline-none focus:ring-1 focus:ring-white/20',
          className,
        )}
        {...props}
      />
    </TooltipPortal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };