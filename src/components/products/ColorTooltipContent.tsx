import { cn } from '@/lib/utils';

interface ColorTooltipContentProps {
  colorName: string;
  colorHex: string;
  className?: string;
}

export function ColorTooltipContent({ colorName, colorHex, className }: ColorTooltipContentProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
        data-testid="color-tooltip-swatch"
        style={{ backgroundColor: colorHex }}
      />
      {colorName}
    </div>
  );
}

export const colorTooltipClassName =
  'border border-border/40 bg-popover/95 px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md backdrop-blur-sm';
