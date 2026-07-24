import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  calcHealthScore,
  getHealthBand,
  HEALTH_BANDS,
  type HealthBand,
} from '@/lib/inventory/health-score';
import { StockThresholdsLegend } from './StockThresholdsLegend';
import { cn } from '@/lib/utils';

const BAND_CLASS: Record<HealthBand, string> = {
  good: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

interface Props {
  productsInStock: number;
  totalProducts: number;
  criticalAlerts: number;
}

export function HealthScoreInfoDialog({ productsInStock, totalProducts, criticalAlerts }: Props) {
  const score = calcHealthScore({ productsInStock, totalProducts });
  const band = getHealthBand(score);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          data-testid="health-score-info-trigger"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Como é calculado"
          title="Como é calculado"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="health-score-info-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Como é calculado</DialogTitle>
          <DialogDescription>
            Transparência da fórmula da Saúde do Estoque e do contador de alertas críticos.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Fórmula da Saúde</h3>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 text-xs">
            Saúde = round(produtos adequados / total de produtos × 100)
          </pre>
          <p className="text-xs text-muted-foreground" data-testid="health-score-live-example">
            Hoje:{' '}
            <span className="font-mono">
              {productsInStock.toLocaleString('pt-BR')} /{' '}
              {totalProducts.toLocaleString('pt-BR')}
            </span>{' '}
            ={' '}
            <span className={cn('font-semibold', BAND_CLASS[band])}>{score}%</span>
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Faixas de cor</h3>
          <ul className="space-y-1 text-xs">
            {HEALTH_BANDS.map((b) => (
              <li key={b.band} className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    b.band === 'good' && 'bg-success',
                    b.band === 'warning' && 'bg-warning',
                    b.band === 'danger' && 'bg-destructive',
                  )}
                  aria-hidden
                />
                <span className={BAND_CLASS[b.band]}>{b.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Alertas críticos</h3>
          <p className="text-xs text-muted-foreground">
            Contagem dos itens classificados como <code>severity === "error"</code> (sem estoque ou
            em nível crítico). Hoje:{' '}
            <span className="font-semibold text-destructive">
              {criticalAlerts.toLocaleString('pt-BR')}
            </span>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Faixas de classificação</h3>
          <StockThresholdsLegend />
        </section>
      </DialogContent>
    </Dialog>
  );
}
