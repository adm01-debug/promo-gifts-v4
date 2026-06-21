/**
 * KpiCard compartilhado — usado em SalesHistoryChart, StockHistoryChart, e outros.
 * Elimina duplicação de ~30 linhas entre módulos.
 * v2: suporta tooltip explicativo opcional (retrocompatível).
 */
import { cn } from '@/lib/utils';
import { type LucideIcon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { type ReactNode } from 'react';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  alert?: boolean;
  warning?: boolean;
  customValueColor?: string;
  ariaLabel?: string;
  /** Texto explicativo exibido em tooltip ao passar o mouse no ícone de info. */
  tooltip?: ReactNode | string;
  /** Delay opcional (ms) para animação fade-in escalonada. */
  animationDelay?: number;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  alert,
  warning,
  customValueColor,
  ariaLabel,
  tooltip,
  animationDelay,
}: KpiCardProps) {
  const content = (
    <div
      className={cn(
        'animate-fade-in rounded-md p-2 text-center',
        alert
          ? 'border border-destructive/20 bg-destructive/10'
          : warning
            ? 'border border-warning/20 bg-warning/10'
            : highlight
              ? 'border border-primary/20 bg-primary/10'
              : 'bg-muted/50',
      )}
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
      role="status"
      aria-label={ariaLabel ?? `${label}: ${value} ${sub}`}
    >
      <div className="mb-0.5 flex items-center justify-center gap-1">
        <Icon
          className={cn(
            'h-3 w-3',
            alert
              ? 'text-destructive'
              : warning
                ? 'text-warning'
                : highlight
                  ? 'text-primary'
                  : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
        <p className="flex items-center gap-0.5 text-[10px] leading-tight text-muted-foreground">
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/60 transition-colors hover:text-foreground"
                  aria-label={`Sobre ${label}`}
                >
                  <Info className="h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px]">
                {tooltip ? (
                  <div className="text-xs leading-relaxed">{tooltip}</div>
                ) : (
                  <div className="space-y-2 p-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </p>
      </div>
      <p
        className={cn(
          'text-sm font-bold',
          customValueColor
            ? customValueColor
            : alert
              ? 'text-destructive'
              : warning
                ? 'text-warning'
                : highlight
                  ? 'text-primary'
                  : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );

  if (tooltip) {
    return <TooltipProvider>{content}</TooltipProvider>;
  }
  return content;
}
