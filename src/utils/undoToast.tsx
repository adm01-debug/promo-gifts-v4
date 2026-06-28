import { useEffect, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Undo2, Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoToastOptions {
  title: string;
  description?: string;
  onUndo: () => void;
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
  onUndo: () => void;
}

/** Conteúdo do toast com contagem regressiva discreta no botão. */
function UndoToastContent({ title, description, duration, onUndo }: UndoToastContentProps) {
  const totalSec = Math.max(1, Math.round(duration / 1000));
  const [remaining, setRemaining] = useState(totalSec);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, totalSec - Math.floor(elapsed));
      setRemaining(left);
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [totalSec]);

  // SVG ring: progresso restante sobre circunferência (r=7 → C≈43.98)
  const R = 7;
  const C = 2 * Math.PI * R;
  const progress = remaining / totalSec;
  const dashoffset = C * (1 - progress);

  return (
    <div className="flex w-full items-center gap-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        onClick={onUndo}
        className={cn(
          'group relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1',
          'border border-primary/30 bg-primary/10 text-primary backdrop-blur-sm',
          'text-[11px] font-semibold tracking-wide',
          'shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.35)]',
          'transition-all duration-200 ease-out',
          'hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_4px_16px_-2px_hsl(var(--primary)/0.5)] hover:-translate-y-px',
          'active:translate-y-0 active:scale-[0.98]',
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
              style={{ transition: 'stroke-dashoffset 250ms linear' }}
            />
          </svg>
          <Undo2 className="h-2.5 w-2.5 transition-transform duration-300 group-hover:-rotate-12" />
        </span>
        <span>Desfazer</span>
        <span
          className="tabular-nums text-primary/70 font-normal"
          aria-label={`${remaining} segundos restantes`}
        >
          {remaining}s
        </span>
      </button>
    </div>
  );
}

/**
 * Shows a toast with an Undo button for reversible actions
 */
export function showUndoToast({ title, description, onUndo, duration = 5000 }: UndoToastOptions) {
  let undone = false;

  const toastId = sonnerToast(
    <UndoToastContent
      title={title}
      description={description}
      duration={duration}
      onUndo={() => {
        if (undone) return;
        undone = true;
        onUndo();
        sonnerToast.dismiss(toastId);
        sonnerToast.success('Ação desfeita!', {
          duration: 2000,
          icon: <Undo2 className="h-4 w-4" />,
        });
      }}
    />,
    {
      duration,
      className: '!bg-card/95 !border-border/60 !backdrop-blur-md !rounded-xl !shadow-lg !py-2.5 !px-3',
    },
  );

  return toastId;
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
