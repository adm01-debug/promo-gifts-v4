import { useState } from 'react';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useSupplierReliability } from '@/hooks/inventory/useSupplierReliability';
import { ReliabilityKpiBar } from './ReliabilityKpiBar';
import { SupplierReliabilityTable } from './SupplierReliabilityTable';
import { SupplierDrawer } from './SupplierDrawer';

export function SupplierReliabilityTab() {
  const { isLoading, isFetching, isError, suppliers, matching, refetch, rawCounts } =
    useSupplierReliability();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? suppliers.find((s) => s.supplierId === selectedId) ?? null : null;

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="reliability-tab-loading">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card data-testid="reliability-tab-error">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium">Erro ao carregar dados de confiabilidade</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Não conseguimos buscar promessas e chegadas no momento.
            </p>
          </div>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (suppliers.length === 0) {
    return (
      <Card data-testid="reliability-tab-empty">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Sem dados de confiabilidade ainda</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Conforme os fornecedores informarem previsões em
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                variant_supplier_sources
              </code>
              e o estoque receber chegadas registradas em
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                stock_snapshots
              </code>
              , esta aba calculará automaticamente o índice de confiança.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5" data-testid="supplier-reliability-tab">
      <ReliabilityKpiBar suppliers={suppliers} />

      <SupplierReliabilityTable
        suppliers={suppliers}
        onSelect={setSelectedId}
        selectedId={selectedId}
      />

      {rawCounts && (
        <p className="text-xs text-muted-foreground">
          Baseado em {rawCounts.sources.toLocaleString('pt-BR')} fontes de fornecedor ·{' '}
          {rawCounts.snapshots.toLocaleString('pt-BR')} snapshots de estoque (últimos 180d)
          {isFetching && ' · atualizando…'}
        </p>
      )}

      <SupplierDrawer
        supplier={selected}
        matching={matching}
        open={selectedId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      />
    </div>
  );
}
