/**
 * Painel de auditoria de tentativas FULL bloqueadas por step-up.
 * Mostra eventos `*_denied` com reason=step_up_required|step_up_invalid,
 * com filtros por usuário e chave.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldX,
  Search,
  RefreshCw,
  Download,
  KeyRound,
  RotateCw,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useStepUpAttempts, type StepUpAttemptRow, type StepUpFilters } from './useStepUpAttempts';

const ACTION_META: Record<string, { label: string; Icon: typeof KeyRound }> = {
  'mcp_key.issue_denied': { label: 'Emissão', Icon: KeyRound },
  'mcp_key.rotate_denied': { label: 'Rotação', Icon: RotateCw },
  'mcp_key.update_denied': { label: 'Edição', Icon: Pencil },
};

function toCsv(rows: StepUpAttemptRow[]): string {
  const headers = [
    'created_at',
    'action',
    'reason',
    'scope',
    'actor_email',
    'actor_name',
    'user_id',
    'key_id',
    'key_name',
    'key_prefix',
    'ip_address',
    'expected_action',
    'detail',
  ];
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.action,
        r.reason,
        r.scope ?? '',
        r.actor_email ?? '',
        r.actor_name ?? '',
        r.user_id ?? '',
        r.resource_id ?? '',
        r.key_name ?? '',
        r.key_prefix ?? '',
        r.ip_address ?? '',
        r.expected_action ?? '',
        r.detail ?? '',
      ]
        .map(esc)
        .join(','),
    );
  }
  return lines.join('\n');
}

function ReasonBadge({ reason }: { reason: string }) {
  if (reason === 'step_up_required') {
    return (
      <Badge variant="secondary" className="text-[10px]">
        step_up_required
      </Badge>
    );
  }
  if (reason === 'step_up_invalid') {
    return (
      <Badge variant="destructive" className="text-[10px]">
        step_up_invalid
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {reason}
    </Badge>
  );
}

function AttemptRow({ row }: { row: StepUpAttemptRow }) {
  const meta = ACTION_META[row.action] ?? { label: row.action, Icon: AlertTriangle };
  const Icon = meta.Icon;
  return (
    <li className="rounded-md border border-border p-3 transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-destructive" />
          <Badge variant="outline" className="text-xs">
            {meta.label}
          </Badge>
          <ReasonBadge reason={row.reason} />
          {row.scope === 'full' && (
            <Badge variant="destructive" className="text-xs">
              FULL
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Usuário: </span>
          <span className="font-medium text-foreground">
            {row.actor_name ?? row.actor_email ?? row.user_id ?? '—'}
          </span>
          {row.actor_email && row.actor_name && <span className="ml-1">({row.actor_email})</span>}
        </div>
        <div className="font-mono">
          {row.key_name ? (
            <>
              <span className="text-muted-foreground">Chave: </span>
              <span className="text-foreground">{row.key_name}</span>
              {row.key_prefix && (
                <span className="ml-1 text-muted-foreground">({row.key_prefix}…)</span>
              )}
            </>
          ) : row.resource_id ? (
            <>
              <span className="text-muted-foreground">Key ID: </span>
              <span className="text-foreground">{row.resource_id.slice(0, 8)}…</span>
            </>
          ) : (
            <span className="italic text-muted-foreground">sem chave alvo</span>
          )}
        </div>
      </div>

      {(row.expected_action || row.detail) && (
        <div className="mt-2 text-xs text-muted-foreground">
          {row.expected_action && (
            <div>
              <span>Ação esperada: </span>
              <span className="font-mono text-foreground">{row.expected_action}</span>
            </div>
          )}
          {row.detail && <div className="mt-0.5 truncate italic">"{row.detail}"</div>}
        </div>
      )}

      {row.ip_address && (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          IP: {row.ip_address}
          {row.request_id && <span className="ml-2">· req: {row.request_id.slice(0, 8)}…</span>}
        </div>
      )}
    </li>
  );
}

export function StepUpAttemptsPanel() {
  const { rows, loading, filters, setFilters, counts, reload } = useStepUpAttempts();

  const onExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-stepup-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const update = (patch: Partial<StepUpFilters>) => setFilters({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldX className="h-4 w-4 text-destructive" />
          Tentativas FULL bloqueadas (step-up)
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Eventos de emissão, rotação ou edição negados por{' '}
          <code className="font-mono">step_up_required</code> ou{' '}
          <code className="font-mono">step_up_invalid</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.userQuery}
                onChange={(e) => update({ userQuery: e.target.value })}
                placeholder="Filtrar por usuário (email, nome ou UID)..."
                className="pl-9"
              />
            </div>
            <Input
              value={filters.keyId}
              onChange={(e) => update({ keyId: e.target.value.trim() })}
              placeholder="Key ID exato (UUID)"
              className="w-[260px] font-mono text-xs"
            />
            <Select
              value={filters.reason}
              onValueChange={(v) => update({ reason: v as StepUpFilters['reason'] })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motivos</SelectItem>
                <SelectItem value="step_up_required">step_up_required</SelectItem>
                <SelectItem value="step_up_invalid">step_up_invalid</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={reload} aria-label="Recarregar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onExport} aria-label="Exportar CSV">
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Total: <strong className="text-foreground">{counts.total}</strong>
            </span>
            <span>
              Required: <strong className="text-foreground">{counts.required}</strong>
            </span>
            <span className="text-destructive">
              Invalid: <strong>{counts.invalid}</strong>
            </span>
            <span>
              · Emissão: <strong className="text-foreground">{counts.issue}</strong>
            </span>
            <span>
              Rotação: <strong className="text-foreground">{counts.rotate}</strong>
            </span>
            <span>
              Edição: <strong className="text-foreground">{counts.update}</strong>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma tentativa bloqueada encontrada com os filtros atuais.
          </p>
        ) : (
          <ScrollArea className="h-[600px] pr-3">
            <ul className="space-y-2">
              {rows.map((r) => (
                <AttemptRow key={r.id} row={r} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
