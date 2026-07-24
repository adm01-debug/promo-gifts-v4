/**
 * Skeletons fallback para os cards lazy-loaded da /admin/telemetria.
 *
 * Renderizados imediatamente no FCP enquanto o chunk JS de cada card baixa.
 * Cada skeleton mantém a altura aproximada do componente real para evitar CLS.
 *
 * Por que dimensões fixas: o shell da página tem ~10 cards/banners empilhados.
 * Sem altura reservada, o paint inicial colapsa o layout e dispara reflows
 * conforme cada chunk resolve — dobrando o tempo até a página ficar estável.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton({ height = 120, label }: { height?: number; label?: string }) {
  return (
    <Card aria-busy="true" aria-label={label ?? 'Carregando'}>
      <CardContent className="space-y-2 p-4" style={{ minHeight: height }}>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-3 h-8 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function BannerSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Carregando alerta">
      <CardContent className="flex items-center gap-3 p-3" style={{ minHeight: 56 }}>
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </CardContent>
    </Card>
  );
}

export function ChartsSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Carregando gráficos">
      <CardContent className="p-4" style={{ minHeight: 320 }}>
        <Skeleton className="mb-4 h-5 w-1/4" />
        <Skeleton className="h-[260px] w-full" />
      </CardContent>
    </Card>
  );
}

export function GridCardsSkeleton({
  count = 4,
  height = 100,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} height={height} />
      ))}
    </div>
  );
}
