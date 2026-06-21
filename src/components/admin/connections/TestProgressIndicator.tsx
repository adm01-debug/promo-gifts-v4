import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TestProgressPhase = 'completed' | 'failed' | 'idle' | 'running';

interface Props {
  phase: TestProgressPhase;
  /** Optional latency to show on the completed/failed line. */
  latencyMs?: number | null;
  /** Optional short message to show on completed/failed (e.g. status code or error). */
  message?: string | null;
  /** ms after which a non-running phase auto-clears. Default 3500. */
  autoDismissMs?: number;
  /** Called when the auto-dismiss fires. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline status strip rendered in the connection card while a manual test runs
 * and briefly afterwards. Communicates: started → completed/failed, then
 * auto-fades. Pairs with the optimistic placeholder in ConnectionTestHistoryPanel.
 */
export function TestProgressIndicator({
  phase,
  latencyMs,
  message,
  autoDismissMs = 3500,
  onDismiss,
  className,
}: Props) {
  const [visible, setVisible] = useState(phase !== 'idle');

  useEffect(() => {
    if (phase === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (phase === 'running') return; // never auto-dismiss while running
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [phase, autoDismissMs, onDismiss]);

  if (!visible || phase === 'idle') return null;

  const isRunning = phase === 'running';
  const isOk = phase === 'completed';

  const Icon = isRunning ? Loader2 : isOk ? CheckCircle2 : XCircle;
  const tone = isRunning
    ? 'border-primary/30 bg-primary/5 text-primary'
    : isOk
      ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
      : 'border-destructive/30 bg-destructive/5 text-destructive';

  const label = isRunning ? 'Teste em andamento…' : isOk ? 'Teste concluído' : 'Teste falhou';

  const detail = isRunning
    ? 'Adicionando ao histórico assim que terminar'
    : [latencyMs !== null ? `${latencyMs}ms` : null, message].filter(Boolean).join(' · ') ||
      (isOk ? 'Histórico atualizado' : 'Veja detalhes no histórico');

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs duration-200 animate-in fade-in slide-in-from-top-1',
        tone,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', isRunning && 'animate-spin')} aria-hidden />
      <span className="font-medium">{label}</span>
      {detail && <span className="truncate text-[11px] opacity-80">— {detail}</span>}
    </div>
  );
}
