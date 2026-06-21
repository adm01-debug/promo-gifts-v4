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
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateStockStatus, type StockStatus } from '@/types/stock';
import {
  getColorSwatchClasses,
  resolveSwatchBackground,
} from '@/components/shared/ColorSwatch';


// ============================================
// VariantThumb — imagem 44/56/72px com fallback elegante
// ============================================

interface VariantThumbProps {
  imageUrl?: string;
  productName: string;
  colorName?: string;
  colorHex?: string;
  size?: 'lg' | 'md' | 'sm';
  /** Quando true, mostra um ring colorido com o hex da variação. */
  showColorRing?: boolean;
}

const SIZE_MAP = {
  sm: 'h-[2.875rem] w-[2.875rem] rounded-md',
  md: 'h-16 w-16 rounded-lg',
  lg: 'h-[5.75rem] w-[5.75rem] rounded-xl',
} as const;

/** Miniatura da variação com fallback de iniciais, ring colorido e lazy-load. */
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

/** Swatch de cor enriquecido: gradiente para cores mistas, indicador de esgotado e estado ativo. */
export function RichColorSwatch({
  hex,
  name,
  isOutOfStock = false,
  isActive = false,
}: RichColorSwatchProps) {
  const label = name?.trim() || 'Sem cor';
  const bg = resolveSwatchBackground(hex, label);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            className={cn(
              // SSOT: src/components/shared/ColorSwatch.tsx — não duplicar
              // regras visuais aqui. Tamanho fixo 25px (estoque).
              'h-[25px] w-[25px] shrink-0 cursor-help',
              getColorSwatchClasses({ isActive, isOutOfStock }),
              !bg && 'border-dashed border-muted-foreground/40',
            )}
            style={
              bg
                ? bg.startsWith('conic-gradient')
                  ? { backgroundImage: bg }
                  : { backgroundColor: bg }
                : undefined
            }
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}




// ============================================
// StockStatusChip — chip único consolidado
// ============================================

const CHIP_CONFIG: Record<StockStatus, { label: string; classes: string; icon: React.ReactNode }> =
  {
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

/** Chip colorido que exibe o status de estoque de uma variação com tooltip de detalhes. */
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

// ============================================
// StockProgressBar — barra de progresso com tooltip de detalhe
// ============================================

/** Barra de progresso de estoque com cor semântica e tooltip de percentual. */
export function StockProgressBar({ current, min }: { current: number; min: number; max?: number }) {
  const percentage = min > 0 ? Math.min((current / min) * 100, 100) : current > 0 ? 100 : 0;

  const PROGRESS_PRESENTATION: Record<string, { label: string; color: string }> = {
    out_of_stock: { label: 'Esgotado', color: 'bg-destructive' },
    critical: { label: 'Crítico', color: 'bg-destructive' },
    low_stock: { label: 'Estoque baixo', color: 'bg-warning' },
    in_stock: { label: 'OK', color: 'bg-success' },
    incoming: { label: 'Chegando', color: 'bg-warning' },
    overstocked: { label: 'OK', color: 'bg-success' },
  };
  const { label: statusLabel, color: progressColor } =
    PROGRESS_PRESENTATION[calculateStockStatus(current, min)] ?? PROGRESS_PRESENTATION.in_stock;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-28 cursor-help space-y-0.5">
            <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />
            <div className="flex justify-between">
              <span
                className={cn(
                  'text-[9px] tabular-nums',
                  percentage <= 25
                    ? 'text-destructive'
                    : percentage <= 100
                      ? 'text-warning'
                      : 'text-success',
                )}
              >
                {Math.round(percentage)}%
              </span>
              <span className="text-[9px] text-muted-foreground">{statusLabel}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>
              <span className="font-semibold">{Math.round(percentage)}%</span> do estoque mínimo
            </p>
            <p className="text-muted-foreground">
              Atual: <strong>{current.toLocaleString('pt-BR')}</strong> / Mínimo:{' '}
              <strong>{min.toLocaleString('pt-BR')}</strong> un.
            </p>
            {current <= min && current > 0 && (
              <p className="text-warning">⚠️ Abaixo do nível mínimo — considere reabastecer</p>
            )}
            {current <= 0 && (
              <p className="text-destructive">🚨 Estoque zerado — reposição urgente necessária</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
