/**
 * OptimizationQueuePanel
 * --------------------------------------------------------------
 * Card para o /admin/telemetria que mostra a fila automática de otimizações.
 * - Botão "Executar tudo" roda os itens pendentes em sequência sem pausas.
 * - Cada execução checa o guardrail; regressão pausa a fila e marca o item como blocked.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Play,
  Pause,
  Plus,
  Trash2,
  RotateCcw,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useOptimizationQueue,
  type OptimizationItem,
} from '@/pages/admin/telemetry/useOptimizationQueue';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OPTIMIZATION_STATUS_CONFIG: Record<
  OptimizationItem['status'],
  { label: string; cls: string; Icon: typeof Clock }
> = {
  pending: { label: 'Pendente', cls: 'bg-muted text-muted-foreground', Icon: Clock },
  running: {
    label: 'Executando',
    cls: 'bg-primary/15 text-primary border-primary/30',
    Icon: Loader2,
  },
  done: {
    label: 'Concluído',
    cls: 'bg-success/15 text-success border-success/30',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Falhou',
    cls: 'bg-destructive/15 text-destructive border-destructive/30',
    Icon: AlertTriangle,
  },
  blocked: {
    label: 'Bloqueado',
    cls: 'bg-warning/15 text-warning border-warning/30',
    Icon: AlertTriangle,
  },
  skipped: { label: 'Ignorado', cls: 'bg-muted text-muted-foreground', Icon: Clock },
};

function StatusBadge({ status }: { status: OptimizationItem['status'] }) {
  // Fallback defensivo para status fora do union (pode acontecer com dados
  // legados, hooks mockados parcialmente em testes, ou novos status no DB
  // antes do client ser atualizado).
  const entry = OPTIMIZATION_STATUS_CONFIG[status] ?? {
    label: String(status ?? '—'),
    cls: 'bg-muted text-muted-foreground',
    Icon: Clock,
  };
  const { label, cls, Icon } = entry;
  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px]', cls)}>
      <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} aria-hidden />
      {label}
    </Badge>
  );
}

export function OptimizationQueuePanel() {
  const {
    items,
    isLoading,
    enqueue,
    remove,
    resetStuck,
    startAuto,
    stopAuto,
    isExecuting,
    counts,
    requeueLastBridgeFailure,
    lastBridgeFailure,
  } = useOptimizationQueue();
  const [requeuing, setRequeuing] = useState(false);

  const handleRequeue = async () => {
    setRequeuing(true);
    try {
      await requeueLastBridgeFailure();
    } finally {
      setRequeuing(false);
    }
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('100');

  const handleAdd = async () => {
    if (!title.trim()) return;
    const ok = await enqueue({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: Number(priority) || 100,
    });
    if (ok) {
      setTitle('');
      setDescription('');
      setPriority('100');
      setDialogOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4" />
            Fila automática de otimizações
            <span className="text-xs font-normal text-muted-foreground">
              · {counts.pending} pendentes · {counts.done} concluídas · {counts.blocked} bloqueadas
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova otimização na fila</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Título</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Habilitar índice idx_products_active_category_created"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Descrição (opcional)
                    </label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detalhes técnicos, links, comandos…"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Prioridade (menor = antes)
                    </label>
                    <Input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAdd} disabled={!title.trim()}>
                    Enfileirar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={resetStuck}
              title="Reiniciar itens travados/falhos"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRequeue}
              disabled={!lastBridgeFailure || requeuing || isExecuting}
              className={cn(
                lastBridgeFailure &&
                  'border-warning/50 text-warning hover:bg-warning/10 hover:text-warning',
              )}
              title={
                lastBridgeFailure
                  ? `Re-enfileirar: ${lastBridgeFailure.title} (${lastBridgeFailure.error ?? 'erro'})`
                  : 'Sem falhas de 503/SUPABASE_EDGE_RUNTIME_ERROR para retry'
              }
            >
              {requeuing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3.5 w-3.5" />
              )}
              Retry 503
              {lastBridgeFailure && (
                <Badge
                  variant="outline"
                  className="ml-1.5 h-4 border-warning/30 bg-warning/10 px-1 text-[9px] text-warning"
                >
                  1
                </Badge>
              )}
            </Button>
            {isExecuting ? (
              <Button variant="destructive" size="sm" onClick={stopAuto}>
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Parar
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={startAuto}
                disabled={counts.pending === 0}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Executar tudo
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-4 text-xs text-muted-foreground">Carregando fila…</p>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ListChecks className="mx-auto mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Nenhuma otimização na fila</p>
            <p className="mt-1 text-xs">
              Adicione itens e clique em "Executar tudo" para rodar em sequência.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                    Título
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                    Guardrail
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                    Atualizado
                  </th>
                  <th className="p-2 text-right text-xs font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr
                    key={it.id}
                    className="border-b border-border/30 transition-colors hover:bg-muted/20"
                  >
                    <td className="p-2 text-xs tabular-nums text-muted-foreground">{idx + 1}</td>
                    <td className="p-2">
                      <p className="text-sm font-medium">{it.title}</p>
                      {it.description && (
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {it.description}
                        </p>
                      )}
                      {it.error && (
                        <p className="mt-0.5 text-[11px] text-destructive">⚠ {it.error}</p>
                      )}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {it.guardrail_status ?? '—'}
                    </td>
                    <td className="whitespace-nowrap p-2 text-[11px] text-muted-foreground">
                      {(() => {
                        if (!it.updated_at) return '—';
                        const d = new Date(it.updated_at);
                        if (Number.isNaN(d.getTime())) return '—';
                        try {
                          return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
                        } catch {
                          return '—';
                        }
                      })()}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(it.id)}
                        disabled={it.status === 'running'}
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
