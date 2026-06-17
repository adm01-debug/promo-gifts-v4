import { Database, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveSource } from './CredentialsSourceFilterContext';
import type { SecretStatus } from '@/hooks/admin';

const SOURCE_CONFIG = {
  db: {
    label: 'DB',
    icon: Database,
    tooltip: 'Valor persistido no banco. Auditável e rotacionável pelo painel.',
    cls: 'border-success/30 bg-success/10 text-success',
  },
  env: {
    label: 'ENV',
    icon: AlertTriangle,
    tooltip:
      'Valor herdado de variável de ambiente. Salve novamente para migrar para o banco e habilitar rotação/auditoria.',
    cls: 'border-warning/40 bg-warning/10 text-warning',
  },
  none: {
    label: '—',
    icon: Minus,
    tooltip: 'Credencial ainda não configurada.',
    cls: 'border-border bg-muted text-muted-foreground',
  },
} as const;

interface Props {
  status?: SecretStatus;
  className?: string;
}

export function CredentialSourceBadge({ status, className }: Props) {
  const source = resolveSource(status);
  const config = SOURCE_CONFIG[source];

  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              config.cls,
              className,
            )}
            aria-label={`Origem da credencial: ${config.label}`}
          >
            <Icon className="h-2.5 w-2.5" />
            {config.label}
            {source === 'env' && <span aria-hidden="true">⚠</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>{config.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
