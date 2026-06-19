import { Database, AlertTriangle, Minus, Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SecretStatus } from '@/hooks/admin';

const SUFFIXES = ['URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'] as const;

type Aggregate = 'db' | 'env' | 'mixed' | 'partial' | 'none';

function aggregateSource(
  envKey: string,
  secrets: SecretStatus[],
): {
  state: Aggregate;
  per: { name: string; source: SecretStatus['source'] | 'missing'; hasValue: boolean }[];
} {
  const per = SUFFIXES.map((suf) => {
    const name = `EXTERNAL_${envKey.toUpperCase()}_${suf}`;
    const s = secrets.find((x) => x.name === name);
    const source: SecretStatus['source'] | 'missing' = s?.has_value
      ? (s.source ?? 'db')
      : 'missing';
    return { name, source, hasValue: !!s?.has_value };
  });

  const present = per.filter((p) => p.hasValue);
  if (present.length === 0) return { state: 'none', per };
  if (present.length < SUFFIXES.length) return { state: 'partial', per };

  const sources = new Set(present.map((p) => p.source));
  if (sources.size === 1) {
    return { state: sources.has('env') ? 'env' : 'db', per };
  }
  return { state: 'mixed', per };
}

const META: Record<
  Aggregate,
  { label: string; cls: string; Icon: typeof Database; tooltip: string }
> = {
  db: {
    label: 'DB',
    cls: 'border-success/30 bg-success/10 text-success',
    Icon: Database,
    tooltip: 'Todas as credenciais persistidas no banco — auditáveis e rotacionáveis.',
  },
  env: {
    label: 'ENV',
    cls: 'border-warning/40 bg-warning/10 text-warning',
    Icon: AlertTriangle,
    tooltip:
      'Todas as credenciais vêm de variáveis de ambiente. Salve no painel para migrar para o banco e habilitar rotação/auditoria.',
  },
  mixed: {
    label: 'MISTO',
    cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
    Icon: Layers,
    tooltip:
      'Credenciais misturando DB e ENV. Padronize salvando todas no painel para evitar inconsistências.',
  },
  partial: {
    label: 'PARCIAL',
    cls: 'border-destructive/40 bg-destructive/10 text-destructive',
    Icon: AlertTriangle,
    tooltip: 'Faltam credenciais EXTERNAL_* obrigatórias para esta conexão.',
  },
  none: {
    label: '—',
    cls: 'border-border bg-muted text-muted-foreground',
    Icon: Minus,
    tooltip: 'Nenhuma credencial EXTERNAL_* configurada para esta conexão.',
  },
};

export function ConnectionRowSourceBadge({
  envKey,
  secrets,
  className,
}: {
  envKey: string | null;
  secrets: SecretStatus[];
  className?: string;
}) {
  if (!envKey) {
    const m = META.none;
    const Icon = m.Icon;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          m.cls,
          className,
        )}
        aria-label="Origem indisponível (sem env_key)"
      >
        <Icon className="h-2.5 w-2.5" />
        n/a
      </span>
    );
  }

  const { state, per } = aggregateSource(envKey, secrets);
  const m = META[state];
  const Icon = m.Icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'inline-flex cursor-help items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-ring',
            m.cls,
            className,
          )}
          aria-label={`Origem das credenciais: ${m.label}`}
        >
          <Icon className="h-2.5 w-2.5" />
          {m.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-1.5 text-xs">
          <div>{m.tooltip}</div>
          <ul className="space-y-0.5 font-mono text-[10px]">
            {per.map((p) => {
              const tag =
                p.source === 'missing'
                  ? 'não configurado'
                  : p.source === 'env'
                    ? 'ENV'
                    : p.source === 'db'
                      ? 'DB'
                      : (p.source ?? '—');
              const tone =
                p.source === 'missing'
                  ? 'text-destructive'
                  : p.source === 'env'
                    ? 'text-warning'
                    : 'text-success';
              return (
                <li key={p.name} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {p.name.replace(`EXTERNAL_${envKey.toUpperCase()}_`, '…_')}
                  </span>
                  <span className={cn('font-semibold uppercase', tone)}>{tag}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
