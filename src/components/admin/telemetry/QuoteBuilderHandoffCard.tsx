/**
 * Painel de auditoria dos handoffs do QuoteBuilder (BUG-CART-HANDOFF, 2026-07).
 *
 * Lê a tabela `frontend_telemetry` filtrando por `event_type =
 * 'quote_builder_handoff'` e mostra, por fonte (carrinho, coleção, simulador,
 * URL params), quantos handoffs chegaram em janelas de 1h/24h/7d.
 *
 * Serve para confirmar após deploy que o evento continua sendo emitido e
 * detectar regressões silenciosas (autosave engolindo dados novos).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  QUOTE_HANDOFF_EVENT_TYPE,
  QUOTE_HANDOFF_NAME_PREFIX,
  type QuoteHandoffSource,
} from '@/lib/telemetry/quoteHandoffTelemetry';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HandoffRow {
  name: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const SOURCE_LABELS: Record<QuoteHandoffSource, string> = {
  fromCart: 'Carrinho',
  fromCollection: 'Coleção',
  fromSimulator: 'Simulador',
  fromUrlParams: 'URL params (lote)',
  fromUrlParamsSingle: 'URL params (produto único)',
};

const ALL_SOURCES: QuoteHandoffSource[] = [
  'fromCart',
  'fromCollection',
  'fromSimulator',
  'fromUrlParams',
  'fromUrlParamsSingle',
];

function countInWindow(rows: HandoffRow[], source: string, ms: number): number {
  const cutoff = Date.now() - ms;
  const fullName = `${QUOTE_HANDOFF_NAME_PREFIX}${source}`;
  return rows.filter((r) => r.name === fullName && new Date(r.created_at).getTime() >= cutoff)
    .length;
}

function stripPrefix(name: string): string {
  return name.startsWith(QUOTE_HANDOFF_NAME_PREFIX)
    ? name.slice(QUOTE_HANDOFF_NAME_PREFIX.length)
    : name;
}

export function QuoteBuilderHandoffCard() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['quote-builder-handoff-telemetry'],
    queryFn: async (): Promise<HandoffRow[]> => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dbData, error } = await supabase
        .from('frontend_telemetry')
        .select('name, created_at, metadata')
        .eq('event_type', QUOTE_HANDOFF_EVENT_TYPE)
        .like('name', `${QUOTE_HANDOFF_NAME_PREFIX}%`)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (dbData ?? []) as HandoffRow[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);
  const stats = useMemo(() => {
    return ALL_SOURCES.map((source) => ({
      source,
      label: SOURCE_LABELS[source],
      c1h: countInWindow(rows, source, 60 * 60 * 1000),
      c24h: countInWindow(rows, source, 24 * 60 * 60 * 1000),
      c7d: countInWindow(rows, source, 7 * 24 * 60 * 60 * 1000),
    }));
  }, [rows]);

  const latest = rows.slice(0, 5);
  const total24h = stats.reduce((sum, s) => sum + s.c24h, 0);
  const total1h = stats.reduce((sum, s) => sum + s.c1h, 0);
  const noRecent7d = rows.length === 0;

  return (
    <Card data-testid="quote-handoff-telemetry-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">
            Handoff QuoteBuilder — auditoria pós-deploy
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="quote-handoff-total-1h">
            {total1h} na última 1h
          </Badge>
          <Badge variant="secondary" data-testid="quote-handoff-total-24h">
            {total24h} nas últimas 24h
          </Badge>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Falha ao consultar `frontend_telemetry`. Confirme permissão de admin.
          </div>
        )}
        {!isError && noRecent7d && !isLoading && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            Nenhum handoff registrado nos últimos 7 dias — investigar após o próximo deploy se o
            fluxo Carrinho → Orçamento continua funcionando.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Fonte</th>
                <th className="py-2 text-right">1h</th>
                <th className="py-2 text-right">24h</th>
                <th className="py-2 text-right">7d</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.source}
                  data-testid={`quote-handoff-row-${s.source}`}
                  className="border-b last:border-0"
                >
                  <td className="py-2">{s.label}</td>
                  <td className="py-2 text-right font-mono">{s.c1h}</td>
                  <td className="py-2 text-right font-mono">{s.c24h}</td>
                  <td className="py-2 text-right font-mono">{s.c7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {latest.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Últimos eventos</div>
            <ul className="space-y-1 text-xs">
              {latest.map((r, i) => (
                <li key={`${r.created_at}-${i}`} className="flex justify-between gap-2">
                  <span>
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {SOURCE_LABELS[stripPrefix(r.name) as QuoteHandoffSource] ?? r.name}
                    </Badge>
                    {typeof r.metadata?.items_count === 'number'
                      ? `${r.metadata.items_count} item(ns)`
                      : ''}
                  </span>
                  <span className="text-muted-foreground">
                    há{' '}
                    {formatDistanceToNowStrict(new Date(r.created_at), {
                      locale: ptBR,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
