import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { bucketByStatus } from '@/lib/inventory/health-score';
import { StockThresholdsLegend } from './StockThresholdsLegend';
import type { ProductStockSummary } from '@/types/stock';
import { cn } from '@/lib/utils';

type BucketKey = 'healthy' | 'low' | 'critical' | 'out';

const TAB_META: Record<BucketKey, { label: string; testid: string; tone: string }> = {
  healthy: { label: 'Adequado', testid: 'tab-healthy', tone: 'text-success' },
  low: { label: 'Baixo', testid: 'tab-low', tone: 'text-warning' },
  critical: { label: 'Crítico', testid: 'tab-critical', tone: 'text-destructive' },
  out: { label: 'Sem estoque', testid: 'tab-out', tone: 'text-muted-foreground' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: readonly ProductStockSummary[];
}

function matches(p: ProductStockSummary, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    p.productName.toLowerCase().includes(needle) ||
    p.productSku.toLowerCase().includes(needle)
  );
}

function ProductRow({ p }: { p: ProductStockSummary }) {
  return (
    <Link
      to={`/produto/${p.productId}`}
      data-testid="stock-breakdown-row"
      className="flex items-center gap-3 rounded-md border border-border/40 p-2 transition hover:bg-muted/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {p.productImageUrl ? (
          <img
            src={p.productImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.productName}</p>
        <p className="truncate text-xs text-muted-foreground">SKU {p.productSku}</p>
      </div>
      <div className="shrink-0 text-right text-xs">
        <p className="font-mono font-semibold">{p.totalCurrentStock.toLocaleString('pt-BR')}</p>
        <p className="text-muted-foreground">mín {p.totalMinStock.toLocaleString('pt-BR')}</p>
      </div>
    </Link>
  );
}

export function StockHealthBreakdownDrawer({ open, onOpenChange, products }: Props) {
  const [tab, setTab] = useState<BucketKey>('healthy');
  const [query, setQuery] = useState('');

  const buckets = useMemo(() => bucketByStatus(products), [products]);
  const counts = useMemo(
    () => ({
      healthy: buckets.healthy.length,
      low: buckets.low.length,
      critical: buckets.critical.length,
      out: buckets.out.length,
    }),
    [buckets],
  );
  const filtered = useMemo(() => buckets[tab].filter((p) => matches(p, query)), [buckets, tab, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-3 sm:max-w-2xl"
        data-testid="stock-breakdown-drawer"
      >
        <SheetHeader>
          <SheetTitle>Produtos por faixa de estoque</SheetTitle>
          <SheetDescription>
            Detalhamento dos {products.length.toLocaleString('pt-BR')} produtos do dataset atual,
            classificados pela faixa de estoque de cada produto.
          </SheetDescription>
        </SheetHeader>

        <StockThresholdsLegend compact />

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            data-testid="stock-breakdown-search"
            placeholder="Buscar por nome ou SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as BucketKey)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-4">
            {(Object.keys(TAB_META) as BucketKey[]).map((k) => (
              <TabsTrigger key={k} value={k} data-testid={TAB_META[k].testid}>
                <span className={cn('truncate', TAB_META[k].tone)}>{TAB_META[k].label}</span>
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {counts[k]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(TAB_META) as BucketKey[]).map((k) => (
            <TabsContent key={k} value={k} className="mt-3 flex-1">
              <ScrollArea className="h-[calc(100vh-280px)] pr-2">
                {filtered.length === 0 ? (
                  <p
                    data-testid="stock-breakdown-empty"
                    className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground"
                  >
                    {buckets[k].length === 0
                      ? 'Nenhum produto nesta faixa.'
                      : 'Nenhum produto corresponde à busca.'}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {filtered.map((p) => (
                      <li key={p.productId}>
                        <ProductRow p={p} />
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
