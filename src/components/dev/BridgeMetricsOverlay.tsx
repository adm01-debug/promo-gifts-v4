/**
 * Overlay flutuante (somente preview/dev) que mostra cada chamada de bridge
 * em tempo real — latência, payload de resposta, status e request-id.
 */
import { memo, useCallback, useState } from 'react';
import { useDevGate } from '@/hooks/admin';
import {
  useBridgeMetrics,
  type BridgeMetricsFilter,
  type BridgeMetricsTab,
} from '@/hooks/dev/useBridgeMetrics';
import { BridgeCallItem } from './metrics/BridgeCallItem';
import { BridgeMetricsSummary } from './metrics/BridgeMetricsSummary';
import { latencyClass } from './metrics/MetricUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import type { BridgeCallSample } from '@/lib/telemetry/bridgeCallMetrics';
import type { LongTaskEvent } from '@/lib/telemetry/longTaskWatchdog';

export default function BridgeMetricsOverlay() {
  // ⚠️ Rules of Hooks: TODOS os hooks devem ser chamados antes de qualquer
  // early-return. Caso contrário, mudanças em `isAllowed` (ex: AuthContext
  // resolvendo role `dev` após RLS desbloqueada) provocam
  // "Rendered more hooks than during the previous render" e crash global.
  const { isDev, isAllowed } = useDevGate();

  const {
    open,
    setOpen,
    paused,
    setPaused,
    filter,
    setFilter,
    tab,
    setTab,
    samples,
    longTasks,
    summary,
    clear,
  } = useBridgeMetrics(isDev);

  const [showInfo, setShowInfo] = useState(false);
  const handleTogglePause = useCallback(() => setPaused((prev) => !prev), [setPaused]);
  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  // Guards APÓS todos os hooks (ordem de hooks fica estável entre renders).
  if (import.meta.env.PROD) return null;
  // Overlay de métricas = ferramenta de DEV PREVIEW com gate SSOT em runtime.
  // Exige AMBOS: papel `dev` (isDev) E aprovação do gate (isAllowed).
  //  - admin com isAllowed=true mas isDev=false → NÃO vê (não é dev).
  //  - dev com isAllowed=false → NÃO vê (gate SSOT rejeitou, mesmo sendo dev).
  if (!isDev || !isAllowed) return null;

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Abrir métricas de bridge (dev preview)"
        onClick={() => setOpen(true)}
        className="group fixed bottom-4 right-4 z-[9999] flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 font-mono text-xs text-white shadow-lg backdrop-blur transition-all hover:bg-black"
        style={{ pointerEvents: 'auto' }}
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="pointer-events-none absolute right-12 whitespace-nowrap rounded border border-white/10 bg-black/90 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
          Métricas de Bridge (Acesso Dev)
        </span>
        bridge metrics · `
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 z-[9999] flex h-[60vh] max-h-[85vh] w-full flex-col overflow-hidden rounded-t-xl border border-white/10 bg-zinc-950/95 font-mono text-xs text-zinc-100 shadow-2xl backdrop-blur sm:bottom-4 sm:right-4 sm:max-h-[70vh] sm:w-[480px] sm:rounded-xl"
      style={{
        pointerEvents: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <Header
        paused={paused}
        onTogglePause={handleTogglePause}
        onClear={clear}
        onClose={handleClose}
        onShowInfo={() => setShowInfo(true)}
      />

      <InfoModal open={showInfo} onOpenChange={setShowInfo} />

      <BridgeMetricsSummary summary={summary} />

      <Tabs
        tab={tab}
        setTab={setTab}
        longTasksCount={longTasks.length}
        filter={filter}
        setFilter={setFilter}
      />

      <div className="flex-1 overflow-auto">
        {tab === 'calls' ? <CallsList samples={samples} /> : <LongTasksList tasks={longTasks} />}
      </div>

      <div className="border-t border-white/5 bg-zinc-900/60 px-3 py-1 text-[10px] text-zinc-400">
        ` para fechar
      </div>
    </div>
  );
}

const Header = memo(
  ({
    paused,
    onTogglePause,
    onClear,
    onClose,
    onShowInfo,
  }: {
    paused: boolean;
    onTogglePause: () => void;
    onClear: () => void;
    onClose: () => void;
    onShowInfo: () => void;
  }) => (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-zinc-900/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="font-semibold">Métricas de Bridge</span>
        <button
          onClick={onShowInfo}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
          title="O que é isso?"
        >
          <Info size={14} />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onTogglePause}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${paused ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}
        >
          {paused ? 'paused' : 'live'}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300 hover:bg-white/10"
        >
          clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
    </div>
  ),
);

const InfoModal = memo(
  ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="text-emerald-400" size={18} />
            Entendendo as Bridge Metrics
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2 text-zinc-400">
            <p>
              O <strong>Bridge</strong> é a camada de comunicação entre a UI e a infraestrutura de
              dados. Estas métricas ajudam a identificar gargalos de performance no modo dev.
            </p>
            <div className="space-y-2 text-xs">
              <p>
                <strong>• Calls:</strong> Lista de requisições disparadas. Fique atento a status
                4xx/5xx e latências altas.
              </p>
              <p>
                <strong>• Long Tasks:</strong> Identifica tarefas pesadas no thread principal que
                podem travar a UI (bloqueios &gt;50ms).
              </p>
              <p>
                <strong>• Cores:</strong> Verde (Rápido), Amarelo (Moderado), Vermelho (Lento -
                requer atenção).
              </p>
            </div>
            <p className="border-t border-white/5 pt-2 text-[10px] italic opacity-70">
              Este painel é visível apenas para usuários com permissão 'dev' e é removido
              automaticamente em produção.
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
);

const Tabs = memo(
  ({
    tab,
    setTab,
    longTasksCount,
    filter,
    setFilter,
  }: {
    tab: BridgeMetricsTab;
    setTab: (t: BridgeMetricsTab) => void;
    longTasksCount: number;
    filter: BridgeMetricsFilter;
    setFilter: (f: BridgeMetricsFilter) => void;
  }) => (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-white/5 px-3 py-1.5 text-[10px] uppercase tracking-wider">
      <button
        type="button"
        onClick={() => setTab('calls')}
        className={`rounded px-2 py-0.5 ${tab === 'calls' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
      >
        calls
      </button>
      <button
        type="button"
        onClick={() => setTab('longtasks')}
        className={`rounded px-2 py-0.5 ${tab === 'longtasks' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
      >
        longtasks
        {longTasksCount > 0 && (
          <span className="ml-1 rounded bg-red-500/30 px-1 text-[9px] text-red-200">
            {longTasksCount}
          </span>
        )}
      </button>

      {tab === 'calls' && (
        <div className="ml-auto flex gap-1">
          {(['all', 'slow', 'errors'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-0.5 ${filter === f ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              {f === 'slow' ? '≥600ms' : f}
            </button>
          ))}
        </div>
      )}
    </div>
  ),
);
const CallsList = memo(({ samples }: { samples: BridgeCallSample[] }) => {
  if (samples.length === 0) {
    return <div className="px-3 py-6 text-center text-zinc-500">Sem chamadas ainda.</div>;
  }
  return (
    <ul className="divide-y divide-white/5">
      {samples.map((s: BridgeCallSample) => (
        <BridgeCallItem key={s.id} sample={s} />
      ))}
    </ul>
  );
});

const LongTasksList = memo(({ tasks }: { tasks: readonly LongTaskEvent[] }) => {
  if (tasks.length === 0) {
    return <div className="px-3 py-6 text-center text-zinc-500">Nenhuma long task detectada.</div>;
  }
  return (
    <ul className="divide-y divide-white/5">
      {[...tasks]
        .slice(-50)
        .reverse()
        .map((lt) => (
          <li key={lt.id} className="px-3 py-1.5 hover:bg-white/5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-zinc-200">
                {new Date(lt.startedAtWallMs).toISOString().slice(11, 23)}
              </span>
              <span className={`shrink-0 tabular-nums ${latencyClass(lt.durationMs)}`}>
                {lt.durationMs}ms
              </span>
            </div>
          </li>
        ))}
    </ul>
  );
});
