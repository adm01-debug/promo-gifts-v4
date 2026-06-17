/**
 * Componentes visuais reutilizados pela tabela "Estoque por Cor/Variação".
 *
 * Princípios:
 *  - Imagem da variação como identidade primária (vendedor reconhece o brinde).
 *  - Cor é destaque, não decoração — swatch grande com hex real e nome.
 *  - Status consolidado em 1 chip (substitui sequência redundante
 *    "0 / 1 mín · 0% · Esgotado · 1 esgotado").
 */
import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Package,
  TrendingDown,
  Truck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { StockStatus } from '@/types/stock';

// ============================================
// VariantThumb — imagem 44/56/72px com fallback elegante
// ============================================

interface VariantThumbProps {
  imageUrl?: string;
  productName: string;
  colorName?: string;
  colorHex?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Quando true, mostra um ring colorido com o hex da variação. */
  showColorRing?: boolean;
}

const SIZE_MAP = {
  sm: 'h-[2.875rem] w-[2.875rem] rounded-md',
  md: 'h-16 w-16 rounded-lg',
  lg: 'h-[5.75rem] w-[5.75rem] rounded-xl',
} as const;

export function VariantThumb({
  imageUrl,
  productName,
  colorName,
  colorHex,
  size = 'md',
  showColorRing = true,
}: VariantThumbProps) {
  const initials = productName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();

  const ringStyle =
    showColorRing && colorHex
      ? { boxShadow: `0 0 0 2px ${colorHex}33, inset 0 0 0 1px hsl(var(--border)))` }
      : undefined;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden border border-border/60 bg-muted/40',
        SIZE_MAP[size],
      )}
      style={ringStyle}
      aria-label={`Imagem de ${productName}${colorName ? ` na cor ${colorName}` : ''}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`${productName}${colorName ? ` — ${colorName}` : ''}`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={(e) => {
            // Fallback graceful para placeholder se o CDN falhar
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-0.5 text-muted-foreground">
          {initials ? (
            <span className="font-display text-[10px] font-bold tabular-nums">{initials}</span>
          ) : (
            <Package className="h-4 w-4 opacity-60" />
          )}
          <ImageOff className="h-2.5 w-2.5 opacity-40" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

// ============================================
// RichColorSwatch — swatch grande + nome + estado
// ============================================

interface RichColorSwatchProps {
  hex?: string;
  name?: string;
  isOutOfStock?: boolean;
  isActive?: boolean;
}

export function RichColorSwatch({
  hex,
  name,
  isOutOfStock = false,
  isActive = false,
}: RichColorSwatchProps) {
  const label = name?.trim() || 'Sem cor';
  // "Colorido"/"Sortido" — usa gradiente conic; "Padrao" — neutro.
  const isMixed = /color(ido)?|sortido|multi/i.test(label);
  const bg = hex
    ? hex
    : isMixed
      ? 'conic-gradient(from 180deg, hsl(0 80% 60%), hsl(40 90% 55%), hsl(140 60% 50%), hsl(210 80% 55%), hsl(280 60% 55%), hsl(0 80% 60%))'
      : undefined;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          'relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          isActive ? 'border-primary ring-2 ring-primary/40' : 'border-border',
          !bg && 'border-dashed border-muted-foreground/40',
        )}
        style={bg ? { background: bg } : undefined}
        aria-hidden="true"
      >
        {isOutOfStock && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(135deg, transparent calc(50% - 1px), hsl(var(--destructive)) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px))',
            }}
          />
        )}
      </span>
      <span
        className={cn(
          'truncate text-sm',
          isOutOfStock ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {label}
      </span>
    </span>
  );
}

// ============================================
// StockStatusChip — chip único consolidado
// ============================================

const CHIP_CONFIG: Record<
  StockStatus,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  in_stock: {
    label: 'Em Estoque',
    classes: 'border-success/30 bg-success/10 text-success',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  incoming: {
    label: 'Chegando',
    classes: 'border-primary/30 bg-primary/10 text-primary',
    icon: <Truck className="h-3 w-3" />,
  },
  low_stock: {
    label: 'Risco de Ruptura',
    classes: 'border-warning/30 bg-warning/10 text-warning',
    icon: <TrendingDown className="h-3 w-3" />,
  },
  critical: {
    label: 'Crítico',
    classes: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  out_of_stock: {
    label: 'Esgotado',
    classes: 'border-destructive/40 bg-destructive/15 text-destructive',
    icon: <XCircle className="h-3 w-3" />,
  },
  overstocked: {
    label: 'Em Estoque',
    classes: 'border-success/30 bg-success/10 text-success',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

export function StockStatusChip({
  status,
  current,
  reserved = 0,
  inTransit = 0,
  showLabel = true,
  projection,
}: {
  status: StockStatus;
  current: number;
  /** @deprecated mantido por compatibilidade — não é mais exibido na UI. */
  min?: number;
  reserved?: number;
  inTransit?: number;
  showLabel?: boolean;
  /** Dados da projeção preditiva (apenas quando status foi reavaliado por Risco de Ruptura). */
  projection?: {
    targetQty: number;
    avgDailyDepletion: number;
    horizonDays: number;
    projectedStock: number;
    daysToTarget: number | null;
  };
}) {
  const cfg = CHIP_CONFIG[status] ?? CHIP_CONFIG.in_stock;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('gap-1 font-medium', cfg.classes)}
            data-testid={`stock-status-chip-${status}`}
          >
            {cfg.icon}
            {showLabel && <span>{cfg.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5 text-xs">
            <p>
              <strong>{current.toLocaleString('pt-BR')}</strong> un. em estoque
            </p>
            {reserved > 0 && (
              <p className="text-warning">{reserved.toLocaleString('pt-BR')} reservadas</p>
            )}
            {inTransit > 0 && (
              <p className="text-primary">+{inTransit.toLocaleString('pt-BR')} em trânsito</p>
            )}
            {projection && (
              <div className="mt-1 space-y-0.5 border-t border-border/40 pt-1">
                <p className="font-semibold text-warning">
                  Projeção em {projection.horizonDays}d:{' '}
                  <strong>{projection.projectedStock.toLocaleString('pt-BR')} un.</strong>
                </p>
                <p className="text-muted-foreground">
                  Alvo {projection.targetQty.toLocaleString('pt-BR')} · média{' '}
                  {projection.avgDailyDepletion.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })}
                  /dia
                </p>
                {projection.daysToTarget !== null && (
                  <p className="text-muted-foreground">
                    Atinge o alvo em ~{projection.daysToTarget}d
                  </p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

