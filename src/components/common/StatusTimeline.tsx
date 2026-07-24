import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  type Check,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  Eye,
  MessageSquare,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TimelineStatus =
  | 'approved'
  | 'cancelled'
  | 'comment'
  | 'created'
  | 'delivered'
  | 'paid'
  | 'production'
  | 'rejected'
  | 'sent'
  | 'shipped'
  | 'viewed';

interface TimelineEvent {
  id: string;
  status: TimelineStatus;
  title: string;
  description?: string;
  timestamp: Date | string;
  user?: string;
  metadata?: Record<string, boolean | number | string>;
}

interface StatusTimelineProps {
  events: TimelineEvent[];
  className?: string;
  showConnector?: boolean;
}

const statusConfig: Record<
  TimelineStatus,
  {
    icon: typeof Check;
    color: string;
    bgColor: string;
  }
> = {
  created: {
    icon: FileText,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  sent: {
    icon: Send,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  viewed: {
    icon: Eye,
    color: 'text-accent-foreground',
    bgColor: 'bg-accent',
  },
  approved: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  rejected: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  paid: {
    icon: CreditCard,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  production: {
    icon: Package,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  shipped: {
    icon: Truck,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  delivered: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  comment: {
    icon: MessageSquare,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
};

export function StatusTimeline({ events, className, showConnector = true }: StatusTimelineProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {events.map((event, index) => {
        const config = statusConfig[event.status];
        const Icon = config.icon;
        const isLast = index === events.length - 1;
        const timestamp =
          typeof event.timestamp === 'string' ? new Date(event.timestamp) : event.timestamp;

        return (
          <div key={event.id} className="relative flex gap-4">
            {/* Connector line */}
            {showConnector && !isLast && (
              <div
                className="absolute left-5 top-10 h-[calc(100%-0.5rem)] w-0.5 bg-border"
                aria-hidden="true"
              />
            )}

            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                config.bgColor,
              )}
            >
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-foreground">{event.title}</h4>
                  {event.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
                  )}
                </div>
                <time className="whitespace-nowrap text-xs text-muted-foreground">
                  {format(timestamp, 'dd MMM, HH:mm', { locale: ptBR })}
                </time>
              </div>

              {/* User */}
              {event.user && <p className="mt-1 text-xs text-muted-foreground">por {event.user}</p>}

              {/* Metadata */}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact horizontal status bar
interface StatusBarStep {
  status: TimelineStatus;
  label: string;
  completed: boolean;
  current?: boolean;
}

interface HorizontalStatusBarProps {
  steps: StatusBarStep[];
  className?: string;
}

export function HorizontalStatusBar({ steps, className }: HorizontalStatusBarProps) {
  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((step, index) => {
        const config = statusConfig[step.status];
        const Icon = config.icon;
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex items-center">
            {/* Step */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  step.completed ? config.bgColor : 'bg-muted',
                  step.current && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
              >
                {step.completed ? (
                  <Icon className={cn('h-4 w-4', config.color)} />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span
                className={cn(
                  'mt-1 whitespace-nowrap text-xs',
                  step.completed || step.current ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className={cn('mx-1 h-0.5 w-12', step.completed ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Current status indicator
interface CurrentStatusProps {
  status: TimelineStatus;
  label: string;
  since?: Date | string;
  className?: string;
}

export function CurrentStatus({ status, label, since, className }: CurrentStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const sinceDate = since ? (typeof since === 'string' ? new Date(since) : since) : null;

  return (
    <div className={cn('flex items-center gap-3 rounded-lg p-3', config.bgColor, className)}>
      <div className="relative">
        <Icon className={cn('h-5 w-5', config.color)} />
        {status !== 'delivered' && status !== 'cancelled' && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-success" />
        )}
      </div>
      <div>
        <p className={cn('text-sm font-medium', config.color)}>{label}</p>
        {sinceDate && (
          <p className="text-xs text-muted-foreground">
            desde {format(sinceDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>
    </div>
  );
}
