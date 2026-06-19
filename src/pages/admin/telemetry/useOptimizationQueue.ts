/**
 * useOptimizationQueue
 * --------------------------------------------------------------
 * Gerencia a fila automática de otimizações:
 *   - lista os itens (auto-refresh 10s)
 *   - enfileira novos itens
 *   - executa uma de cada vez via `claim_next_optimization` + `complete_optimization`
 *   - respeita o guardrail (`check_telemetry_regression`): se status = 'regression',
 *     o item é marcado como 'blocked' e a fila pausa.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { waitForBridgeReady, invalidateBridgeReadyCache } from '@/lib/external-db/health-check';

/** Detecta erros do bridge causados por 503 / cold-start do isolate. */
const BRIDGE_FAILURE_PATTERNS = [
  '503',
  '502',
  '504',
  'supabase_edge_runtime_error',
  'boot_error',
  'service is temporarily unavailable',
  'bad gateway',
  'gateway timeout',
];

export function isBridgeColdStartError(msg?: string | null): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return BRIDGE_FAILURE_PATTERNS.some((p) => m.includes(p));
}

export interface OptimizationItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: number;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'blocked';
  result: Record<string, unknown> | null;
  error: string | null;
  guardrail_status: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

const QUEUE_KEY = ['admin', 'optimization-queue'];

export function useOptimizationQueue() {
  const queryClient = useQueryClient();
  const [autoRun, setAutoRun] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const stopRef = useRef(false);

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery<OptimizationItem[]>({
    queryKey: QUEUE_KEY,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('optimization_queue' as never)
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUEUE_KEY }),
    [queryClient],
  );

  const enqueue = useCallback(
    async (input: {
      title: string;
      description?: string;
      category?: string;
      priority?: number;
    }) => {
      const { error } = await supabase.rpc(
        'enqueue_optimization' as never,
        {
          _title: input.title,
          _description: input.description ?? null,
          _category: input.category ?? 'performance',
          _priority: input.priority ?? 100,
        } as never,
      );
      if (error) {
        toast.error('Falha ao enfileirar otimização');
        return false;
      }
      toast.success('Otimização enfileirada');
      invalidate();
      return true;
    },
    [invalidate],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('optimization_queue' as never)
        .delete()
        .eq('id', id);
      if (error) {
        toast.error('Falha ao remover item da fila');
        return;
      }
      invalidate();
    },
    [invalidate],
  );

  const resetStuck = useCallback(async () => {
    const { error } = await supabase.rpc(
      'reset_optimization_queue' as never,
      { _only_running: false } as never,
    );
    if (error) {
      toast.error('Falha ao resetar a fila');
      return;
    }
    toast.success('Fila resetada');
    invalidate();
  }, [invalidate]);

  /** Executa um item: simula trabalho leve + checa guardrail. */
  const runOne = useCallback(async (): Promise<'done' | 'blocked' | 'empty' | 'error'> => {
    const { data: claimedRaw, error: claimErr } = await supabase.rpc(
      'claim_next_optimization' as never,
    );
    if (claimErr) {
      toast.error('Falha ao reivindicar item da fila');
      return 'error';
    }
    const claimed: unknown = claimedRaw;
    if (!claimed || (Array.isArray(claimed) && claimed.length === 0)) {
      return 'empty';
    }
    const item = (Array.isArray(claimed) ? claimed[0] : claimed) as OptimizationItem;
    invalidate();

    // Aguarda janela curta para guardrail medir possíveis regressões pós-execução.
    await new Promise((r) => {
      setTimeout(r, 1500);
    });

    // Checa guardrail
    const { data: guardrail } = await supabase.rpc('check_telemetry_regression' as never);
    const guardrailStatus =
      (guardrail as { status?: string } | null)?.status ?? 'insufficient_data';

    let finalStatus: 'done' | 'blocked' = 'done';
    let notes = `Executado automaticamente · guardrail=${guardrailStatus}`;
    let errorMsg: string | null = null;

    if (guardrailStatus === 'regression') {
      finalStatus = 'blocked';
      errorMsg = 'KPIs pioraram (guardrail=regression). Execução pausada.';
      notes = errorMsg;
    }

    await supabase.rpc(
      'complete_optimization' as never,
      {
        _id: item.id,
        _status: finalStatus,
        _notes: notes,
        _guardrail_status: guardrailStatus,
        _result: { executed_at: new Date().toISOString() } as never,
        _error: errorMsg,
      } as never,
    );

    invalidate();
    return finalStatus === 'blocked' ? 'blocked' : 'done';
  }, [invalidate]);

  /** Loop sequencial: executa enquanto houver pending e o guardrail permitir. */
  const startAuto = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setAutoRun(true);
    stopRef.current = false;
    try {
      while (!stopRef.current) {
        const result = await runOne();
        if (result === 'empty') {
          toast.success('Fila concluída ✓');
          break;
        }
        if (result === 'blocked') {
          toast.error('Execução pausada por regressão de KPIs');
          break;
        }
        if (result === 'error') {
          break;
        }
        await new Promise((r) => {
          setTimeout(r, 800);
        });
      }
    } finally {
      setIsExecuting(false);
      setAutoRun(false);
    }
  }, [isExecuting, runOne]);

  const stopAuto = useCallback(() => {
    stopRef.current = true;
    setAutoRun(false);
  }, []);

  useEffect(
    () => () => {
      stopRef.current = true;
    },
    [],
  );

  /**
   * Última execução do optimization/bridge que falhou com 503 ou
   * SUPABASE_EDGE_RUNTIME_ERROR. Usado para habilitar o botão de re-enfileirar.
   */
  const lastBridgeFailure = useMemo(() => {
    const candidates = items
      .filter(
        (i) => (i.status === 'failed' || i.status === 'blocked') && isBridgeColdStartError(i.error),
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return candidates[0] ?? null;
  }, [items]);

  /**
   * Re-enfileira o item falho com prioridade alta (10), aguarda o bridge ficar
   * pronto via health-check e dispara a fila automaticamente. Garante que a
   * nova tentativa não pega o mesmo cold-start.
   */
  const requeueLastBridgeFailure = useCallback(async () => {
    if (!lastBridgeFailure) {
      toast.info('Nenhuma falha de bridge/503 recente para re-enfileirar');
      return false;
    }
    const target = lastBridgeFailure;

    // 1) Aguarda bridge pronto antes de re-enfileirar — evita loop de cold start.
    invalidateBridgeReadyCache();
    const tReady = toast.loading('Verificando readiness do bridge…');
    const ready = await waitForBridgeReady(8000);
    toast.dismiss(tReady);
    if (!ready.ok) {
      toast.error('Bridge ainda indisponível. Tente novamente em alguns segundos.');
      return false;
    }

    // 2) Re-enfileira como novo item com prioridade alta + marca de retry.
    const retryTitle = target.title.startsWith('[retry] ')
      ? target.title
      : `[retry] ${target.title}`;
    const retryDescription = [
      target.description ?? '',
      `\n— Re-enfileirado após falha (${target.error ?? 'erro desconhecido'})`,
      `Origem: ${target.id}`,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    const ok = await enqueue({
      title: retryTitle,
      description: retryDescription,
      category: target.category,
      priority: 10,
    });
    if (!ok) return false;

    // 3) Marca o item original como 'skipped' para limpar a UI.
    await supabase
      .from('optimization_queue' as never)
      .update({ status: 'skipped', error: `${target.error ?? ''} (re-enfileirado)` } as never)
      .eq('id', target.id);
    invalidate();

    // 4) Dispara o auto-runner imediatamente.
    toast.success('Item re-enfileirado. Iniciando execução…');
    void startAutoRef.current?.();
    return true;
  }, [lastBridgeFailure, enqueue, invalidate]);

  // Permite que requeue chame startAuto sem ciclo de dependência.
  const startAutoRef = useRef<typeof startAuto | null>(null);
  useEffect(() => {
    startAutoRef.current = startAuto;
  }, [startAuto]);

  const pending = items.filter((i) => i.status === 'pending').length;
  const done = items.filter((i) => i.status === 'done').length;
  const blocked = items.filter((i) => i.status === 'blocked' || i.status === 'failed').length;

  return {
    items,
    isLoading,
    refetch,
    enqueue,
    remove,
    resetStuck,
    runOne,
    startAuto,
    stopAuto,
    requeueLastBridgeFailure,
    lastBridgeFailure,
    isExecuting,
    autoRun,
    counts: { pending, done, blocked, total: items.length },
  };
}
