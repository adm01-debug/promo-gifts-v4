import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, TOOLTIP_DELAY } from './tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTooltipProps {
  children: string;
  className?: string;
  tooltipClassName?: string;
  delayDuration?: number;
  side?: 'bottom' | 'left' | 'right' | 'top';
}

/**
 * TruncatedTooltip
 * Automatically shows a tooltip with the full text when the children text is truncated with ellipsis.
 */
export function TruncatedTooltip({
  children,
  className,
  tooltipClassName,
  delayDuration = TOOLTIP_DELAY,
  side = 'top',
}: TruncatedTooltipProps) {
  const [isTruncated, setIsTruncated] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const checkTruncation = React.useCallback(() => {
    if (textRef.current) {
      const { scrollWidth, clientWidth } = textRef.current;
      setIsTruncated(scrollWidth > clientWidth);
    }
  }, []);

  React.useLayoutEffect(() => {
    checkTruncation();

    // Add resize listener
    const resizeObserver = new ResizeObserver(() => {
      checkTruncation();
    });

    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [checkTruncation, children]);

  const content = (
    <span ref={textRef} className={cn('block truncate', className)}>
      {children}
    </span>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side={side} className={tooltipClassName} variant="compact">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
