import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, RotateCw, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toErrorMessage } from '@/lib/to-error-message';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExportButton } from './ExportButton';
import { cn } from '@/lib/utils';

interface FailedDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  attempt: number;
  error_message: string | null;
  delivered_at: string;
  outbound_webhooks: { name: string; url: string; active: boolean } | null;
}

const PAGE_SIZE = 25;

export function FailedDeliveriesPanel() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [eventFilter, setEventFilter] = useState('');
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['failed-deliveries', page, eventFilter],
    queryFn: async () => {
      let q = supabase
        .from('webhook_deliveries')
        .select(
          'id, webhook_id, event, status_code, attempt, error_message, delivered_at, outbound_webhooks(name, url, active)',
          { count: 'exact' },
        )
        .eq('success', false)
        .order('delivered_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (eventFilter.trim()) q = q.ilike('event', `%${eventFilter.trim()}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
    refetchInterval: 30_000,
  });

  const replay = async (id: string) => {
    setReplayingId(id);
    try {
      const { data: result, error } = await supabase.functions.invoke('webhook-dispatcher', {
        body: { event: '__replay__', replay_delivery_id: id },
      });
      if (error) throw error;
      const r = result?.results?.[0];
      if (r?.status === 'success') toast.success('Webhook reenviado com sucesso');
      else
        toast.warning('Reenviado, mas o destino respondeu com erro', {
          description: r?.attempts ? `${r.attempts} tentativas` : undefined,
        });
      qc.invalidateQueries({ queryKey: ['failed-deliveries'] });
      qc.invalidateQueries({ queryKey: ['integrations-health'] });
    } catch (err) {
      toast.error('Falha ao reenviar', {
        description: toErrorMessage(err),
      });
    } finally {
      setReplayingId(null);
    }
  };

  const total = data?.count ?? 0;
  const rows: FailedDelivery[] = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Entregas falhas
            </CardTitle>
            <CardDescription>
              {total} {total === 1 ? 'entrega' : 'entregas'} sem sucesso. Reenvie manualmente quando
              o destino estiver de volta.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setPage(0);
              }}
              placeholder="Filtrar por evento…"
              className="h-8 w-48 text-xs"
            />
            <ExportButton
              filename="failed-deliveries"
              rows={(data?.rows ?? []).map((d) => ({
                webhook: d.outbound_webhooks?.name ?? '',
                webhook_url: d.outbound_webhooks?.url ?? '',
                event: d.event,
                status_code: d.status_code,
                attempt: d.attempt,
                error_message: d.error_message ?? '',
                delivered_at: d.delivered_at,
              }))}
              formats={['csv', 'json']}
            />
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            🎉 Nenhuma entrega falha. Tudo em ordem.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Tent.</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{d.outbound_webhooks?.name ?? '—'}</div>
                      {!d.outbound_webhooks?.active && (
                        <Badge
                          variant="outline"
                          className="mt-0.5 border-destructive/20 bg-destructive/10 text-[10px] text-destructive"
                        >
                          Webhook desativado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {d.event}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{d.status_code ?? '—'}</span>
                      {d.error_message && (
                        <div
                          className="max-w-[200px] truncate text-[10px] text-muted-foreground"
                          title={d.error_message}
                        >
                          {d.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{d.attempt}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.delivered_at), {
                        locale: ptBR,
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => replay(d.id)}
                        disabled={replayingId === d.id}
                        className="h-7 text-xs"
                      >
                        {replayingId === d.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3" />
                        )}
                        Reenviar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Página {page + 1} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
