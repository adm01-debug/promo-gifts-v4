import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Send,
  Ban,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        // Quote statuses
        draft: 'bg-muted text-foreground border border-border font-bold',
        pending: 'bg-warning text-white border-2 border-warning shadow-sm font-bold',
        sent: 'bg-info text-white border-2 border-info shadow-sm font-bold',
        approved: 'bg-success text-white border-2 border-success shadow-sm font-bold',
        rejected: 'bg-destructive text-white border-2 border-destructive shadow-sm font-bold',
        expired: 'bg-muted text-foreground border-2 border-border font-bold',

        // Order statuses
        processing: 'bg-info text-white border-2 border-info animate-pulse font-bold',
        shipped: 'bg-primary text-white border-2 border-primary shadow-sm font-bold',
        delivered: 'bg-success text-white border-2 border-success shadow-sm font-bold',
        cancelled: 'bg-destructive text-white border-2 border-destructive shadow-sm font-bold',

        // Generic statuses
        active: 'bg-success text-white border-2 border-success shadow-sm font-bold',
        inactive: 'bg-muted text-foreground border-2 border-border font-bold',
        warning: 'bg-warning text-white border-2 border-warning shadow-sm font-bold',
        error: 'bg-destructive text-white border-2 border-destructive shadow-sm font-bold',
        info: 'bg-info text-white border-2 border-info shadow-sm font-bold',
        success: 'bg-success text-white border-2 border-success shadow-sm font-bold',

        // Loading
        loading: 'bg-muted text-muted-foreground animate-pulse',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        default: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      status: 'draft',
      size: 'default',
    },
  },
);

const statusIcons: Record<string, LucideIcon> = {
  draft: FileText,
  pending: Clock,
  sent: Send,
  approved: CheckCircle,
  rejected: XCircle,
  expired: Ban,
  processing: Loader2,
  shipped: Send,
  delivered: CheckCircle,
  cancelled: XCircle,
  active: CheckCircle,
  inactive: Ban,
  warning: AlertCircle,
  error: XCircle,
  info: AlertCircle,
  success: CheckCircle,
  loading: Loader2,
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  processing: 'Processando',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  active: 'Ativo',
  inactive: 'Inativo',
  warning: 'Atenção',
  error: 'Erro',
  info: 'Info',
  success: 'Sucesso',
  loading: 'Carregando',
};

type StatusValue = NonNullable<VariantProps<typeof statusBadgeVariants>['status']>;

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  status: StatusValue;
  label?: string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, showIcon = true, size, className }: StatusBadgeProps) {
  const Icon = statusIcons[status];
  const displayLabel = label || statusLabels[status];
  const isLoading = status === 'loading' || status === 'processing';

  return (
    <span
      className={cn(statusBadgeVariants({ status, size }), className)}
      role="status"
      aria-label={displayLabel}
    >
      {showIcon && Icon && (
        <Icon className={cn('h-3 w-3', isLoading && 'animate-spin')} aria-hidden="true" />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

const STATUS_ALIAS_MAP: Record<string, keyof typeof statusLabels> = {
  rascunho: 'draft',
  pendente: 'pending',
  aguardando: 'pending',
  enviado: 'sent',
  aprovado: 'approved',
  rejeitado: 'rejected',
  expirado: 'expired',
  processando: 'processing',
  emprocessamento: 'processing',
  entregue: 'delivered',
  cancelado: 'cancelled',
  ativo: 'active',
  inativo: 'inactive',
} as const;

// Utility function to map any status string to a valid status
export function mapToStatus(status: string): keyof typeof statusLabels {
  const normalized = status.toLowerCase().replace(/[_-]/g, '');
  return (
    STATUS_ALIAS_MAP[normalized] ||
    (statusLabels[status] ? (status as keyof typeof statusLabels) : 'info')
  );
}
