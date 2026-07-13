import { useEffect, useRef, useState, useCallback } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Undo2, Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoToastOptions {
  title: string;
  description?: string;
  /**
   * Retorne `false` (ou lance) quando a operação de undo falhar — o toast
   * "Ação desfeita!" só aparece em sucesso. Retornos `void`/`true` = sucesso.
   */
  onUndo: () => void | boolean | Promise<void | boolean>;
  duration?: number;
}

interface ActionToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

interface UndoToastContentProps {
  title: string;
  description?: string;
  duration: number;
  /**
   * Pode ser assíncrono. O botão fica desabilitado enquanto a promise resolve
   * para impedir cliques concorrentes que disparariam múltiplas restaurações.
   */
  onUndo: () => void | Promise<void>;
  onTimeout: () => void;
  /**
   * Se definido, congela o tempo restante no valor informado (ms) e desativa
   * o intervalo interno + transições. Usado apenas por harness visual/testes
   * para gerar snapshots PNG estáveis. Não use em produção.
   */
  frozenMs?: number;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

/**
 * Conteúdo do toast com contagem regressiva discreta no botão.
 *
 * Pausa automaticamente quando o mouse entra ou recebe foco, e retoma
 * ao sair — UX padrão de toasts com ação reversível.
 * Respeita `prefers-reduced-motion` desligando transições.
 */
export function UndoToastContent({
  title,
  description,
  duration,
  onUndo,
  onTimeout,
  frozenMs,
}: UndoToastContentProps) {
  const totalMs = Math.max(1000, duration);
  const totalSec = Math.round(totalMs / 1000);
  const frozen = typeof frozenMs === 'number';
  const [remainingMs, setRemainingMs] = useState(
    frozen ? Math.max(0, Math.min(frozenMs!, totalMs)) : totalMs,
  );
  const pausedRef = useRef(false);
  const lastTickRef = useRef<number>(Date.now());
  const reducedNative = usePrefersReducedMotion();
  // Harness pode congelar tempo — quando frozen também suprime animações.
  const reduced = reducedNative || frozen;

  useEffect(() => {
    if (frozen) return;
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (pausedRef.current) return;
      setRemainingMs((prev) => Math.max(0, prev - delta));
    }, 200);
    return () => window.clearInterval(id);
  }, [frozen]);

  useEffect(() => {
    if (remainingMs <= 0) onTimeout();
  }, [remainingMs, onTimeout]);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const resume = useCallback(() => {
    lastTickRef.current = Date.now();
    pausedRef.current = false;
  }, []);

  const remainingSec = Math.ceil(remainingMs / 1000);
  const R = 7;
  const C = 2 * Math.PI * R;
  const progress = remainingMs / totalMs;
  const dashoffset = C * (1 - progress);

  return (
    <div
      data-testid="undo-toast"
      data-reduced-motion={reduced ? 'true' : 'false'}
      className="flex w-full items-center gap-2.5"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <div className="min-w-0 flex-1">
        <p
          data-testid="undo-toast-title"
          className="text-[13px] font-medium leading-tight text-foreground"
        >
          {title}
        </p>
        {description && (
          <p
            data-testid="undo-toast-description"
            className="mt-0.5 text-[11px] leading-tight text-muted-foreground"
          >
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        data-testid="undo-toast-button"
        data-remaining-ms={remainingMs}
        data-remaining-sec={remainingSec}
        data-expired={remainingMs <= 0 ? 'true' : 'false'}
        disabled={remainingMs <= 0}
        aria-disabled={remainingMs <= 0 || undefined}
        onClick={onUndo}
        aria-label={`Desfazer ação — ${remainingSec} segundos restantes de ${totalSec}`}
        className={cn(
          'group relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1',
          'border border-primary/30 bg-primary/10 text-primary backdrop-blur-sm',
          'text-[11px] font-semibold tracking-wide',
          'shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.35)]',
          !reduced && 'transition-all duration-200 ease-out',
          'hover:border-primary/50 hover:bg-primary/15',
          !reduced &&
            'hover:shadow-[0_4px_16px_-2px_hsl(var(--primary)/0.5)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="8"
              cy="8"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="1.25"
            />
            <circle
              cx="8"
              cy="8"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={dashoffset}
              style={reduced ? undefined : { transition: 'stroke-dashoffset 200ms linear' }}
            />
          </svg>
          <Undo2
            className={cn(
              'h-2.5 w-2.5',
              !reduced && 'transition-transform duration-300 group-hover:-rotate-12',
            )}
          />
        </span>
        <span aria-hidden="true">Desfazer</span>
        <span
          data-testid="undo-toast-countdown"
          data-remaining-sec={remainingSec}
          aria-live="polite"
          aria-atomic="true"
          className="tabular-nums text-primary/70 font-normal"
        >
          {remainingSec}s
        </span>
      </button>
    </div>
  );
}

/**
 * Shows a toast with an Undo button for reversible actions.
 * O countdown pausa no hover/focus e respeita prefers-reduced-motion.
 */
export function showUndoToast({ title, description, onUndo, duration = 5000 }: UndoToastOptions) {
  let undone = false;

  const handleUndo = async () => {
    if (undone) return;
    undone = true;
    // AGUARDA o resultado do onUndo antes de confirmar sucesso. Antes o toast
    // "Ação desfeita!" aparecia imediatamente (fire-and-forget), gerando falso
    // positivo quando a restauração falhava silenciosamente no INSERT.
    let ok = true;
    try {
      const result = await onUndo();
      if (result === false) ok = false;
    } catch {
      ok = false;
    }
    sonnerToast.dismiss(toastId);
    if (ok) {
      sonnerToast.success('Ação desfeita!', {
        duration: 2000,
        icon: <Undo2 className="h-4 w-4" />,
      });
    }
    // Em falha, o chamador é responsável por emitir o toast de erro
    // (com description sanitizada + contexto do snapshot).
  };

  const handleTimeout = () => {
    if (undone) return;
    sonnerToast.dismiss(toastId);
  };

  // Controlamos o dismiss manualmente (Infinity em sonner) para suportar pausa.
  const toastId = sonnerToast(
    <UndoToastContent
      title={title}
      description={description}
      duration={duration}
      onUndo={handleUndo}
      onTimeout={handleTimeout}
    />,
    {
      duration: Infinity,
      className:
        '!bg-card/95 !border-border/60 !backdrop-blur-md !rounded-xl !shadow-lg !py-2.5 !px-3',
    },
  );

  return toastId;
}

// Expõe um helper global apenas em DEV para specs Playwright dispararem o toast
// sem depender de seed de dados. Não é incluído em produção.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __showUndoToast?: typeof showUndoToast }).__showUndoToast =
    showUndoToast;
}

/**
 * Shows a success toast with check icon
 */
export function showSuccessToast({ title, description, duration = 3000 }: ActionToastOptions) {
  return sonnerToast.success(title, {
    description,
    duration,
    icon: <Check className="h-4 w-4 text-success" />,
  });
}

/**
 * Shows an error toast with X icon
 */
export function showErrorToast({ title, description, duration = 4000 }: ActionToastOptions) {
  return sonnerToast.error(title, {
    description,
    duration,
    icon: <X className="h-4 w-4 text-destructive" />,
  });
}

/**
 * Shows a warning toast
 */
export function showWarningToast({ title, description, duration = 4000 }: ActionToastOptions) {
  return sonnerToast.warning(title, {
    description,
    duration,
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
  });
}

/**
 * Shows an info toast
 */
export function showInfoToast({ title, description, duration = 3000 }: ActionToastOptions) {
  return sonnerToast.info(title, {
    description,
    duration,
    icon: <Info className="h-4 w-4 text-info" />,
  });
}

/**
 * Helper to create undoable actions
 */
export function createUndoableAction<T>({
  action,
  undo,
  successMessage,
  undoMessage,
}: {
  action: () => T;
  undo: (result: T) => void;
  successMessage: string;
  undoMessage?: string;
}) {
  const result = action();

  showUndoToast({
    title: successMessage,
    description: undoMessage,
    onUndo: () => undo(result),
  });

  return result;
}
