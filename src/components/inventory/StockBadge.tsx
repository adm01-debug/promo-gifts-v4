import { Package, AlertTriangle, XCircle, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'pre-order' | 'incoming';

const STOCK_INDICATOR_DOT_COLORS: Record<StockStatus, string> = {
  'in-stock': 'bg-primary',
  'low-stock': 'bg-warning',
  'out-of-stock': 'bg-destructive',
  'pre-order': 'bg-primary',
  incoming: 'bg-primary/70',
} as const;

interface StockBadgeProps {
  status: StockStatus;
  quantity?: number;
  showQuantity?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  expectedDate?: string;
  className?: string;
}

const statusConfig: Record<
  StockStatus,
  {
    label: string;
    shortLabel: string;
    icon: typeof Package;
    className: string;
    bgClass: string;
  }
> = {
  'in-stock': {
    label: 'Em Estoque',
    shortLabel: 'Disponível',
    icon: Package,
    className: 'text-primary dark:text-primary',
    bgClass: 'bg-primary/10 border-primary/20',
  },
  'low-stock': {
    label: 'Estoque Baixo',
    shortLabel: 'Estoque baixo',
    icon: AlertTriangle,
    className: 'text-warning dark:text-warning',
    bgClass: 'bg-warning/10 dark:bg-warning/15 border-warning/20 dark:border-warning/40',
  },
  'out-of-stock': {
    label: 'Sem Estoque',
    shortLabel: 'Indisponível',
    icon: XCircle,
    className: 'text-destructive dark:text-destructive',
    bgClass:
      'bg-destructive/10 dark:bg-destructive/20 border-destructive/20 dark:border-destructive/40',
  },
  'pre-order': {
    label: 'Pré-venda',
    shortLabel: 'Pré-venda',
    icon: TrendingUp,
    className: 'text-primary',
    bgClass: 'bg-primary/10 border-primary/20',
  },
  incoming: {
    label: 'Chegando',
    shortLabel: 'Em trânsito',
    icon: Clock,
    className: 'text-primary/80',
    bgClass: 'bg-primary/10 border-primary/15',
  },
};

const sizeConfig = {
  sm: {
    badge: 'text-[10px] px-1.5 py-0.5 gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'text-xs px-2 py-1 gap-1.5',
    icon: 'h-3.5 w-3.5',
  },
  lg: {
    badge: 'text-sm px-3 py-1.5 gap-2',
    icon: 'h-4 w-4',
  },
};

export function StockBadge({
  status,
  quantity,
  showQuantity = false,
  showIcon = true,
  size = 'md',
  expectedDate,
  className,
}: StockBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  const formatQuantity = (qty: number) => {
    if (qty >= 1000) {
      return `${(qty / 1000).toFixed(1)}k`;
    }
    return qty.toLocaleString('pt-BR');
  };

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center border font-medium transition-all',
        config.bgClass,
        config.className,
        sizeStyles.badge,
        className,
      )}
    >
      {showIcon && <Icon className={sizeStyles.icon} />}
      <span>
        {showQuantity && quantity !== undefined ? (
          <>{formatQuantity(quantity)} un.</>
        ) : (
          config.shortLabel
        )}
      </span>
    </Badge>
  );

  // Se tem informação adicional, mostrar tooltip
  if (expectedDate || (quantity !== undefined && !showQuantity)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">{config.label}</p>
            {quantity !== undefined && (
              <p>Quantidade: {quantity.toLocaleString('pt-BR')} unidades</p>
            )}
            {expectedDate && <p>Previsão: {new Date(expectedDate).toLocaleDateString('pt-BR')}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badgeContent;
}

// Função helper para determinar status com base na quantidade
export function getStockStatus(quantity: number, lowThreshold = 50): StockStatus {
  if (quantity === 0) return 'out-of-stock';
  if (quantity <= lowThreshold) return 'low-stock';
  return 'in-stock';
}

// Componente de indicador compacto para listas
interface StockIndicatorProps {
  status: StockStatus;
  className?: string;
}

export function StockIndicator({ status, className }: StockIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full',
            STOCK_INDICATOR_DOT_COLORS[status],
            status === 'low-stock' && 'animate-pulse',
            className,
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{statusConfig[status].label}</TooltipContent>
    </Tooltip>
  );
}
