import {
  Check,
  Clock,
  FileText,
  RefreshCw,
  Send,
  Shield,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuoteStatusTimelineProps {
  status: string;
  createdAt?: string;
  updatedAt?: string;
  clientResponseAt?: string;
  isSyncing?: boolean;
}

const steps = [
  { key: 'draft', label: 'Rascunho', icon: FileText },
  { key: 'pending_approval', label: 'Aprovação Desconto', icon: Shield },
  { key: 'pending', label: 'Pendente', icon: Clock },
  { key: 'syncing', label: 'Sincronizando', icon: RefreshCw },
  { key: 'sent', label: 'Enviado', icon: Send },
];

const statusOrder: Record<string, number> = {
  draft: 0,
  pending_approval: 1,
  pending: 2,
  sent: 5,
  viewed: 5,
  approved: 5,
  converted: 5,
  rejected: 5,
  expired: 5,
  cancelled: 5,
};

function formatTs(ts?: string) {
  if (!ts) return null;
  try {
    return format(new Date(ts), 'dd/MM HH:mm', { locale: ptBR });
  } catch {
    return null;
  }
}

export function QuoteStatusTimeline({
  status,
  createdAt,
  updatedAt,
  clientResponseAt,
  isSyncing = false,
}: QuoteStatusTimelineProps) {
  const isPendingApproval = status === 'pending_approval';
  // Compute current index based on filtered steps
  const activeSteps = isPendingApproval ? steps : steps.filter((s) => s.key !== 'pending_approval');
  const stepIdx = activeSteps.findIndex((s) => s.key === status);
  const baseIdx =
    stepIdx >= 0
      ? stepIdx
      : statusOrder[status] !== null
        ? Math.min(statusOrder[status], activeSteps.length)
        : 0;
  const syncIdx = activeSteps.findIndex((s) => s.key === 'syncing');
  const currentIdx = isSyncing && syncIdx >= 0 ? syncIdx : baseIdx;

  const isRejected = status === 'rejected';
  const isExpired = status === 'expired';
  const isCancelled = status === 'cancelled';
  const isFinalNegative = isRejected || isExpired || isCancelled;

  // Filter out pending_approval step if not relevant to this quote
  const relevantSteps =
    isPendingApproval || status === 'pending_approval'
      ? steps
      : steps.filter((s) => s.key !== 'pending_approval');

  const displaySteps = relevantSteps.map((step, idx) => {
    if (idx === relevantSteps.length - 1 && isRejected) {
      return { key: 'rejected', label: 'Rejeitado', icon: ThumbsDown };
    }
    if (idx === relevantSteps.length - 1 && isExpired) {
      return { key: 'expired', label: 'Expirado', icon: AlertTriangle };
    }
    if (idx === relevantSteps.length - 1 && isCancelled) {
      return { key: 'cancelled', label: 'Cancelado', icon: AlertTriangle };
    }
    return step;
  });

  return (
    <div className="flex w-full items-center gap-0">
      {displaySteps.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const Icon = step.icon;
        const isSync = step.key === 'syncing';

        let timestamp: string | null = null;
        if (idx === 0) timestamp = formatTs(createdAt);
        else if (isCurrent && !isSyncing) timestamp = formatTs(updatedAt);
        if (idx === steps.length - 1 && (status === 'approved' || isRejected)) {
          timestamp = formatTs(clientResponseAt || updatedAt);
        }

        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent &&
                    isPendingApproval &&
                    step.key === 'pending_approval' &&
                    'border-amber-500 bg-amber-500/10 text-amber-500 ring-2 ring-amber-500/20',
                  isCurrent &&
                    !isFinalNegative &&
                    !isSync &&
                    !isPendingApproval &&
                    'border-primary bg-primary/10 text-primary ring-2 ring-primary/20',
                  isCurrent &&
                    isSync &&
                    'border-success bg-primary/10 text-primary ring-2 ring-primary/20',
                  isCurrent &&
                    (isRejected || isCancelled) &&
                    'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/20',
                  isCurrent &&
                    isExpired &&
                    'border-muted-foreground bg-muted text-muted-foreground ring-2 ring-muted-foreground/20',
                  !isCompleted &&
                    !isCurrent &&
                    'border-muted-foreground/30 text-muted-foreground/40',
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent && isSync ? (
                  <Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap text-xs font-medium',
                  isCompleted && 'text-primary',
                  isCurrent && !isFinalNegative && !isSync && 'font-semibold text-primary',
                  isCurrent && isSync && 'font-semibold text-primary',
                  isCurrent && (isRejected || isCancelled) && 'font-semibold text-destructive',
                  isCurrent && isExpired && 'font-semibold text-muted-foreground',
                  !isCompleted && !isCurrent && 'text-muted-foreground/50',
                )}
              >
                {step.label}
              </span>
              {timestamp && <span className="text-[10px] text-muted-foreground">{timestamp}</span>}
            </div>

            {/* Connector line */}
            {idx < displaySteps.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 flex-1 rounded-full transition-all',
                  idx < currentIdx ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
