import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useEmaPipelineHealth } from '@/hooks/stock/useEmaPipelineHealth';
import { useQueryClient } from '@tanstack/react-query';

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  if (normalized === 'OK') {
    return (
      <Badge className="gap-1 border-success/30 bg-success/10 text-success" variant="outline">
        <CheckCircle2 className="h-3 w-3" /> OK
      </Badge>
    );
  }
  if (normalized === 'ATRASO' || normalized === 'WARN') {
    return (
      <Badge className="gap-1 border-warning/30 bg-warning/10 text-warning" variant="outline">
        <AlertTriangle className="h-3 w-3" /> {normalized}
      </Badge>
    );
  }
  return (
    <Badge
      className="gap-1 border-destructive/30 bg-destructive/10 text-destructive"
      variant="outline"
    >
      <XCircle className="h-3 w-3" /> {normalized}
    </Badge>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function EmaHealthPage() {
  const { data, isLoading, error, isFetching } = useEmaPipelineHealth();
  const qc = useQueryClient();

  return (
    <>
      <PageSEO
        title="Saúde do Pipeline EMA"
        description="Monitor dos crons e mat.views do motor preditivo de ruptura."
        path="/admin/ema-health"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1
              data-testid="page-title-ema-health"
              className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              <Activity className="h-7 w-7 text-primary" />
              Saúde do Pipeline EMA
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Status dos crons noturnos, mat.view e ETL do motor preditivo de ruptura
              (banco canônico).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => qc.invalidateQueries({ queryKey: ['ema-pipeline-health'] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Componentes do pipeline</CardTitle>
            <CardDescription>
              Refresh automático a cada 60 segundos. Dados via{' '}
              <code>fn_ema_pipeline_health()</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Não foi possível executar <code className="mx-1">fn_ema_pipeline_health</code>.
                Verifique se a função existe no banco canônico.
              </div>
            ) : !data || data.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum componente reportado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Componente</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Última execução</th>
                      <th className="px-2 py-2">Próxima execução</th>
                      <th className="px-2 py-2">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr
                        key={row.componente}
                        className="border-b border-border/30 hover:bg-muted/40"
                      >
                        <td className="px-2 py-2 font-medium">{row.componente}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-2 py-2 tabular-nums text-muted-foreground">
                          {formatDate(row.ultima_execucao)}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-muted-foreground">
                          {formatDate(row.proxima_execucao)}
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">
                          {row.detalhe ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
