import { CheckCircle2, AlertTriangle, XCircle, CircleSlash, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  status: 'active' | 'degraded' | 'error' | 'unconfigured' | 'disabled' | 'never_tested';
  className?: string;
}

const MAP = {
  active: {
    icon: CheckCircle2,
    label: 'Ativo',
    cls: 'bg-green-500/10 text-green-700 border-green-500/30',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degradado',
    cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  },
  error: { icon: XCircle, label: 'Erro', cls: 'bg-red-500/10 text-red-700 border-red-500/30' },
  unconfigured: {
    icon: CircleSlash,
    label: 'Sem credenciais',
    cls: 'bg-muted text-muted-foreground border-border',
  },
  disabled: {
    icon: CircleSlash,
    label: 'Desabilitado',
    cls: 'bg-muted text-muted-foreground border-border',
  },
  never_tested: {
    icon: CircleDashed,
    label: 'Não testado',
    cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
  },
} as const;

export function ConnectionStatusBadge({ status, className }: Props) {
  const cfg = MAP[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', cfg.cls, className)}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </Badge>
  );
}
