/**
 * MedallionPipelineCard — saúde do pipeline Medallion (Bronze → Prata → Ouro)
 * no painel /system/status, direto das views Ouro de observabilidade
 * (vw_medallion_coverage + v_pipeline_progress).
 */
import { Layers, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useMedallionHealth } from '@/hooks/admin/useMedallionHealth';
import { cn } from '@/lib/utils';

const CAMADA_BADGE: Record<string, string> = {
  bronze: 'border-amber-700/40 bg-amber-900/20 text-amber-600',
  prata: 'border-slate-400/40 bg-slate-500/10 text-slate-400',
  silver: 'border-slate-400/40 bg-slate-500/10 text-slate-400',
  ouro: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
  gold: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
};

function camadaBadgeClass(camada: string | null): string {
  return CAMADA_BADGE[(camada ?? '').toLowerCase()] ?? 'border-muted bg-muted/40';
}

function pct(value: number | null): string {
  return value === null || value === undefined ? '—' : `${Math.round(Number(value))}%`;
}

export function MedallionPipelineCard() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useMedallionHealth();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5" />
            Pipeline Medalhão (Bronze → Prata → Ouro)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRefetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Falha ao ler views de observabilidade do pipeline:{' '}
            {error instanceof Error ? error.message : 'erro desconhecido'}
          </div>
        )}

        {data && (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Progresso por fase (v_pipeline_progress)
              </p>
              {data.progress.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma fase registrada.</p>
              ) : (
                <div className="space-y-2">
                  {data.progress.map((fase) => (
                    <div key={fase.fase ?? 'sem-fase'} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{fase.fase ?? '—'}</span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {(fase.com_erro ?? 0) > 0 && (
                            <Badge className="border-destructive/30 bg-destructive/20 text-destructive">
                              {fase.com_erro} erro(s)
                            </Badge>
                          )}
                          {fase.concluidas ?? 0}/{fase.total_etapas ?? 0} etapas ·{' '}
                          {pct(fase.pct_completo)}
                        </span>
                      </div>
                      <Progress value={Number(fase.pct_completo ?? 0)} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Cobertura por fornecedor (vw_medallion_coverage)
              </p>
              {data.coverage.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cobertura registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">Fornecedor</th>
                        <th className="py-2 pr-2 font-medium">Camada</th>
                        <th className="py-2 pr-2 text-right font-medium">Produtos</th>
                        <th className="py-2 pr-2 text-right font-medium">NCM</th>
                        <th className="py-2 pr-2 text-right font-medium">Categoria</th>
                        <th className="py-2 pr-2 text-right font-medium">Materiais</th>
                        <th className="py-2 text-right font-medium">Nome exib.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coverage.map((row, i) => (
                        <tr
                          key={`${row.fornecedor ?? 'x'}-${row.camada ?? 'x'}-${i}`}
                          className="border-b border-muted/40 last:border-0"
                        >
                          <td className="py-2 pr-2 font-medium">{row.fornecedor ?? '—'}</td>
                          <td className="py-2 pr-2">
                            <Badge className={camadaBadgeClass(row.camada)}>
                              {row.camada ?? '—'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {row.produtos ?? '—'}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{pct(row.ncm_pct)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {pct(row.category_pct)}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {pct(row.materials_pct)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {pct(row.display_name_pct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
