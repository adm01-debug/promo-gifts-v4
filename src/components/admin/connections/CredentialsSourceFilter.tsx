import { useEffect, useMemo } from 'react';
import { Database, AlertTriangle, Minus, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCredentialsSourceFilter,
  resolveSource,
  type CredentialSource,
} from './CredentialsSourceFilterContext';
import type { SecretStatus } from '@/hooks/admin';

interface Props {
  secrets: SecretStatus[];
  className?: string;
}

export function CredentialsSourceFilter({ secrets, className }: Props) {
  const { filter, setFilter } = useCredentialsSourceFilter();

  const counts = useMemo(() => {
    let db = 0,
      env = 0,
      none = 0;
    for (const s of secrets) {
      const src = resolveSource(s);
      if (src === 'db') db++;
      else if (src === 'env') env++;
      else none++;
    }
    return { all: secrets.length, db, env, none };
  }, [secrets]);

  // Shift+E shortcut to toggle env/all
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setFilter(filter === 'env' ? 'all' : 'env');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filter, setFilter]);

  const chips: Array<{
    value: CredentialSource;
    label: string;
    count: number;
    icon: typeof Database;
    activeCls: string;
  }> = [
    {
      value: 'all',
      label: 'Todas',
      count: counts.all,
      icon: LayoutGrid,
      activeCls: 'border-primary bg-primary/10 text-primary',
    },
    {
      value: 'db',
      label: 'Banco',
      count: counts.db,
      icon: Database,
      activeCls: 'border-success/50 bg-success/15 text-success',
    },
    {
      value: 'env',
      label: 'Em ENV',
      count: counts.env,
      icon: AlertTriangle,
      activeCls: 'border-warning/50 bg-warning/15 text-warning',
    },
    {
      value: 'none',
      label: 'Não configuradas',
      count: counts.none,
      icon: Minus,
      activeCls: 'border-border bg-muted text-foreground',
    },
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        Origem das credenciais:
      </span>
      {chips.map((c) => {
        const active = filter === c.value;
        const Icon = c.icon;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => setFilter(c.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              active
                ? c.activeCls
                : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            aria-pressed={active}
          >
            <Icon className="h-3 w-3" />
            {c.label}
            <span className={cn('tabular-nums', !active && 'opacity-70')}>({c.count})</span>
          </button>
        );
      })}
      {filter === 'env' && counts.env > 0 && (
        <span className="ml-1 text-[11px] text-warning">↳ recomendado migrar para o banco</span>
      )}
      <span className="ml-auto hidden text-[10px] text-muted-foreground/70 md:inline">
        Atalho: <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Shift+E</kbd>
      </span>
    </div>
  );
}
