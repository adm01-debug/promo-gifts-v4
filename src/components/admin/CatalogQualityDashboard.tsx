/**
 * CatalogQualityDashboard — painel administrativo que mostra métricas de qualidade do catálogo:
 * produtos sem imagem, sem categoria, com SKU duplicado, sem preço etc.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ImageOff, FolderX, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface QualityMetrics {
  totalSyncRuns: number;
  failedRuns: number;
  lastRunAt: string | null;
  totalRecordsProcessed: number;
  totalRecordsFailed: number;
}

export function CatalogQualityDashboard() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // BUG-CATALOGQUALITY-SYNCLOG-SELECT-SILENT-FAIL FIX: { data } without error check —
        // a failed SELECT produced null data and metrics showed health 100% / all zeros.
        const { data, error: syncErr } = await supabase
          .from('product_sync_logs')
          .select('status, records_processed, records_failed, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (syncErr) throw syncErr;

        const rows = data || [];
        setMetrics({
          totalSyncRuns: rows.length,
          failedRuns: rows.filter((r) => r.status === 'failed').length,
          lastRunAt: rows[0]?.created_at ?? null,
          totalRecordsProcessed: rows.reduce((sum, r) => sum + (r.records_processed || 0), 0),
          totalRecordsFailed: rows.reduce((sum, r) => sum + (r.records_failed || 0), 0),
        });
      } catch (err) {
        logger.error('[CatalogQualityDashboard] Failed to load sync metrics:', err);
        // metrics stays null → component returns null (invisible, better than fake 0% data)
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const healthScore = metrics.totalSyncRuns
    ? Math.max(0, 100 - Math.round((metrics.failedRuns / metrics.totalSyncRuns) * 100))
    : 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Saúde geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{healthScore}%</p>
            <Badge variant={healthScore > 90 ? 'default' : 'destructive'} className="mt-2">
              {healthScore > 90 ? 'Excelente' : 'Requer atenção'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-warning" /> Sincronizações com falha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.failedRuns}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              de {metrics.totalSyncRuns} execuções recentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ImageOff className="h-4 w-4 text-muted-foreground" /> Registros falhados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.totalRecordsFailed}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              de {metrics.totalRecordsProcessed} processados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4" /> Indicadores de qualidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <FolderX className="h-4 w-4" /> Para auditoria detalhada de imagens, categorias e SKUs
            duplicados, consulte o gerenciador de produtos.
          </p>
          {metrics.lastRunAt && (
            <p>
              Última sincronização:{' '}
              <strong>{new Date(metrics.lastRunAt).toLocaleString('pt-BR')}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
