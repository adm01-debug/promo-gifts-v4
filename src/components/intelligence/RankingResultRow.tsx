import { TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TrendingProduct } from '@/hooks/intelligence';
import { HighlightMatch } from './RankingFilterToolbar';

export function RankBadge({ index }: { index: number }) {
  if (index === 0)
    return (
      <span className="text-base" title="1º lugar">
        🥇
      </span>
    );
  if (index === 1)
    return (
      <span className="text-base" title="2º lugar">
        🥈
      </span>
    );
  if (index === 2)
    return (
      <span className="text-base" title="3º lugar">
        🥉
      </span>
    );
  return (
    <span
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
        'bg-muted text-muted-foreground',
      )}
    >
      {index + 1}
    </span>
  );
}

export function ABCBadge({ revenue, topRevenue }: { revenue: number; topRevenue: number }) {
  const ratio = topRevenue > 0 ? revenue / topRevenue : 0;
  if (ratio >= 0.5)
    return (
      <Badge variant="default" className="h-4 bg-success px-1 text-[9px] hover:bg-success">
        🔥 A
      </Badge>
    );
  if (ratio >= 0.2)
    return (
      <Badge
        variant="secondary"
        className="h-4 bg-warning/20 px-1 text-[9px] text-warning hover:bg-warning/20"
      >
        ⚡ B
      </Badge>
    );
  return (
    <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">
      📦 C
    </Badge>
  );
}

const trendIcon = {
  up: <TrendingUp className="h-3 w-3 text-success" />,
  down: <TrendingDown className="h-3 w-3 text-destructive" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
};

interface RankingResultRowProps {
  product: TrendingProduct;
  index: number;
  topRevenue: number;
  searchQuery: string;
  formatCurrency: (v: number | null | undefined) => string;
  onClick: () => void;
}

export function RankingResultRow({
  product,
  index,
  topRevenue,
  searchQuery,
  formatCurrency,
  onClick,
}: RankingResultRowProps) {
  // FIX: null-guard — totalQuantity/totalRevenue podem vir null antes de estabilizar
  const safeQty = product.totalQuantity ?? 0;
  const safeRev = product.totalRevenue ?? 0;
  const avgUnit = safeQty > 0 ? safeRev / safeQty : 0;

  return (
    <div
      className={cn(
        'grid cursor-pointer items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/20',
        'grid-cols-[2rem_2.5rem_1fr_auto] sm:grid-cols-[2rem_2.5rem_1fr_4.5rem_5rem_5rem_4rem]',
        index < 3 && 'bg-primary/[0.02]',
      )}
      onClick={onClick}
    >
      {/* Rank */}
      <div className="flex items-center justify-center">
        <RankBadge index={index} />
      </div>

      {/* Image */}
      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
        {product.productImage ? (
          <img
            src={product.productImage}
            alt="Imagem do produto"
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Name + Meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">
            <HighlightMatch text={product.productName} query={searchQuery} />
          </p>
          <ABCBadge revenue={safeRev} topRevenue={topRevenue} />
        </div>
        <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
          {product.productSku && <HighlightMatch text={product.productSku} query={searchQuery} />}
          {product.productSku && ' · '}
          {product.orderCount} pedidos
          {/* FIX: null-guard mobile — crash site #1 */}
          <span className="sm:hidden">
            {' '}
            · {safeQty.toLocaleString('pt-BR')} un. ·{' '}
            {formatCurrency(safeRev)}
          </span>
        </div>
      </div>

      {/* Mobile trend indicator */}
      <div className="flex items-center gap-1 sm:hidden">{trendIcon[product.trend]}</div>

      {/* Quantity — desktop: FIX null-guard crash site #2 */}
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium">{safeQty.toLocaleString('pt-BR')}</p>
        <p className="text-[10px] text-muted-foreground">un.</p>
      </div>

      {/* Revenue — desktop */}
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold">{formatCurrency(safeRev)}</p>
      </div>

      {/* Avg unit price — desktop */}
      <div className="hidden text-right sm:block">
        <p className="text-xs text-muted-foreground">{formatCurrency(avgUnit)}</p>
        <p className="text-[9px] text-muted-foreground/70">p/ un.</p>
      </div>

      {/* Conversion + Trend — desktop */}
      <div className="hidden items-center justify-end gap-1 sm:flex">
        {trendIcon[product.trend]}
        <span className="text-[10px] text-muted-foreground">{product.conversionRate}%</span>
      </div>
    </div>
  );
}
