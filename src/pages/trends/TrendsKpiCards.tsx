/**
 * TrendsKpiCards — KPI cards com deltas % vs período anterior.
 * Substitui os cards inline de TrendsPage que tinham classes Tailwind dinâmicas (purge JIT).
 */
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Search, Package, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateDelta } from '@/lib/trending-score';

interface KpiData {
  totalViews: number;
  totalSearches: number;
  uniqueProducts: number;
  uniqueSearches: number;
}

interface TrendsKpiCardsProps {
  current: KpiData;
  previous: KpiData;
}

// Mapeamento estático (evita purge do Tailwind JIT em produção)
const COLOR_CLASSES = {
  primary: {
    gradient: 'from-primary/10 to-primary/5',
    border: 'border-primary/20',
    iconBg: 'bg-primary/20',
    iconText: 'text-primary',
  },
  chart2: {
    gradient: 'from-chart-2/10 to-chart-2/5',
    border: 'border-chart-2/20',
    iconBg: 'bg-chart-2/20',
    iconText: 'text-chart-2',
  },
  chart3: {
    gradient: 'from-chart-3/10 to-chart-3/5',
    border: 'border-chart-3/20',
    iconBg: 'bg-chart-3/20',
    iconText: 'text-chart-3',
  },
  chart4: {
    gradient: 'from-chart-4/10 to-chart-4/5',
    border: 'border-chart-4/20',
    iconBg: 'bg-chart-4/20',
    iconText: 'text-chart-4',
  },
} as const;

type ColorKey = keyof typeof COLOR_CLASSES;

interface KpiItem {
  key: keyof KpiData;
  icon: typeof Eye;
  label: string;
  color: ColorKey;
}

const ITEMS: KpiItem[] = [
  { key: 'totalViews', icon: Eye, label: 'Visualizações', color: 'primary' },
  { key: 'totalSearches', icon: Search, label: 'Buscas', color: 'chart2' },
  { key: 'uniqueProducts', icon: Package, label: 'Produtos únicos', color: 'chart3' },
  { key: 'uniqueSearches', icon: Sparkles, label: 'Termos únicos', color: 'chart4' },
];

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = calculateDelta(current, previous);
  if (!delta?.isSignificant) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" />
        estável
      </span>
    );
  }
  const isUp = delta.direction === 'up';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold',
        isUp ? 'text-success' : 'text-destructive',
      )}
      title={`vs período anterior: ${previous.toLocaleString('pt-BR')}`}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}
      {delta.delta}%
    </span>
  );
}

export function TrendsKpiCards({ current, previous }: TrendsKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {ITEMS.map(({ key, icon: Icon, label, color }) => {
        const c = COLOR_CLASSES[color];
        const value = current[key];
        const prev = previous[key];
        return (
          <Card key={label} className={cn('bg-gradient-to-br', c.gradient, c.border, 'border')}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn('shrink-0 rounded-lg p-2', c.iconBg)}>
                  <Icon className={cn('h-5 w-5', c.iconText)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold leading-tight text-foreground">
                    {value.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs leading-tight text-muted-foreground">{label}</p>
                  <div className="mt-1">
                    <DeltaBadge current={value} previous={prev} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
