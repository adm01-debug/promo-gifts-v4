/**
 * CredentialsSourceIndicator
 *
 * Indicador read-only no topo da zona Conexões em /admin/conexoes que torna
 * explícita a origem dos dados de credenciais exibidos na página:
 *
 *   Fonte: tabela `integration_credentials` (banco principal — SSOT)
 *   Lida via edge function `secrets-manager` (action: list)
 *
 * Mostra também:
 *   - Contagem por origem resolvida (DB · ENV fallback · ausente)
 *   - Data/hora da última atualização (max(updated_at) entre todos os secrets carregados)
 *   - Quem atualizou por último (updated_by_email do registro mais recente)
 *
 * Importante: é apenas leitura, não dispara invocações novas — recebe os
 * `secrets` já carregados pelo hook `useSecretsManager` do componente pai.
 */
import { useMemo, useState } from 'react';
import { Database, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { resolveSource } from './CredentialsSourceFilterContext';
import type { SecretStatus } from '@/hooks/admin';

interface Props {
  secrets: SecretStatus[];
  /** Mostra esqueleto enquanto a primeira carga está em andamento. */
  isLoading?: boolean;
  /**
   * Handler de refresh manual: deve invalidar o cache no servidor
   * (`secrets-manager` action `refresh_cache`) e em seguida re-listar
   * os secrets para refletir o estado mais recente. Quando ausente,
   * o botão de refresh não é renderizado.
   */
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

const RTF = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function hasUpdatedAt(secret: SecretStatus): secret is SecretStatus & { updated_at: string } {
  return !!secret.updated_at;
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffMs = t - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (abs < min) return 'há poucos segundos';
  if (abs < hour) return RTF.format(Math.round(diffMs / min), 'minute');
  if (abs < day) return RTF.format(Math.round(diffMs / hour), 'hour');
  return RTF.format(Math.round(diffMs / day), 'day');
}

function formatAbsolute(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TOOLTIP_LIMIT = 12;

export function CredentialsSourceIndicator({ secrets, isLoading, onRefresh, className }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success('Credenciais recarregadas', {
        description: 'Cache do secrets-manager invalidado e integration_credentials re-listada.',
      });
    } catch {
      toast.error('Falha ao recarregar credenciais', {
        description: 'Erro desconhecido.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Agrupa secrets por origem resolvida — usado tanto para os contadores
  // quanto para listar os nomes contribuintes em cada tooltip.
  const { grouped, counts } = useMemo(() => {
    const g = secrets.reduce(
      (acc, s) => {
        const src = resolveSource(s);
        acc[src].push(s);
        return acc;
      },
      { db: [] as SecretStatus[], env: [] as SecretStatus[], none: [] as SecretStatus[] },
    );
    // Ordena alfabeticamente para consistência de leitura nos tooltips.
    (Object.keys(g) as Array<'db' | 'env' | 'none'>).forEach((k) => {
      g[k].sort((a, b) => a.name.localeCompare(b.name));
    });
    return { grouped: g, counts: { db: g.db.length, env: g.env.length, none: g.none.length } };
  }, [secrets]);

  // Limita a lista exibida no tooltip para não estourar a viewport
  // quando houver muitos secrets — o restante aparece como "+ N mais".

  function renderNameList(items: SecretStatus[], tone: 'success' | 'warning' | 'destructive') {
    if (items.length === 0) {
      return <p className="italic text-muted-foreground">Nenhum secret nesta categoria.</p>;
    }
    const visible = items.slice(0, TOOLTIP_LIMIT);
    const rest = items.length - visible.length;
    const toneCls =
      tone === 'success'
        ? 'text-success'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-destructive';
    return (
      <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1 font-mono text-[10px]">
        {visible.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-2">
            <span className={`truncate ${toneCls}`}>{s.name}</span>
            {s.masked_suffix ? (
              <span className="shrink-0 text-muted-foreground">••••{s.masked_suffix}</span>
            ) : (
              <span className="shrink-0 text-muted-foreground">—</span>
            )}
          </li>
        ))}
        {rest > 0 && <li className="pt-0.5 italic text-muted-foreground">+ {rest} mais…</li>}
      </ul>
    );
  }

  // Pega o secret mais recentemente atualizado (apenas os com updated_at)
  const latest = secrets
    .filter(hasUpdatedAt)
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))[0];

  const relative = formatRelative(latest?.updated_at ?? null);
  const absolute = formatAbsolute(latest?.updated_at ?? null);

  return (
    <div
      className={[
        'rounded-lg border bg-card px-4 py-3',
        'flex flex-wrap items-start gap-3',
        className ?? '',
      ].join(' ')}
      role="status"
      aria-live="polite"
      data-testid="credentials-source-indicator"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Database className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>

      <div className="min-w-[260px] flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium leading-none">Fonte das credenciais</p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="cursor-help border-success/40 bg-success/10 font-mono text-[10px] uppercase text-success"
                >
                  <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                  SSOT
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className=" ">
                Single Source of Truth: os valores exibidos vêm da tabela
                <code className="mx-1 font-mono">integration_credentials</code>
                lida via edge function
                <code className="mx-1 font-mono">secrets-manager</code>
                (action <code className="font-mono">list</code>). Os segredos permanecem mascarados
                — apenas o sufixo é retornado ao navegador.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <p className="text-xs text-muted-foreground">
          Lista, badges e máscaras desta página vêm de{' '}
          <code className="font-mono text-[11px] text-foreground">integration_credentials</code> via{' '}
          <code className="font-mono text-[11px] text-foreground">secrets-manager</code>. Valores
          nunca trafegam em texto puro para o frontend.
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  tabIndex={0}
                  className="cursor-help border-success/40 bg-success/10 font-mono text-[10px] uppercase text-success focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`${counts.db} credenciais com origem DB`}
                >
                  DB · {counts.db}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="space-y-1.5">
                <p className="font-semibold">Origem: banco (SSOT) — {counts.db}</p>
                <p>
                  Valor persistido em <code className="font-mono">integration_credentials</code> e
                  resolvido pelo <code className="font-mono">secrets-manager</code>.
                </p>
                <div className="border-t pt-1.5">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Secrets contribuintes
                  </p>
                  {renderNameList(grouped.db, 'success')}
                </div>
                <p className="text-muted-foreground">
                  ✅ Nada a fazer — auditável, rotacionável e versionado pelo painel.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  tabIndex={0}
                  className="cursor-help border-warning/40 bg-warning/10 font-mono text-[10px] uppercase text-warning focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`${counts.env} credenciais com origem ENV`}
                >
                  ENV · {counts.env}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="space-y-1.5">
                <p className="font-semibold">
                  Origem: variável de ambiente (legado) — {counts.env}
                </p>
                <p>
                  Valor lido via <code className="font-mono">Deno.env.get()</code> porque o registro
                  ainda não existe em <code className="font-mono">integration_credentials</code>.
                </p>
                <div className="border-t pt-1.5">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Secrets resolvidos por ENV
                  </p>
                  {renderNameList(grouped.env, 'warning')}
                </div>
                <p className="text-muted-foreground">
                  ⚠ Abra o card correspondente e clique em <strong>Salvar</strong> para migrar para
                  o banco e liberar rotação/auditoria.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  tabIndex={0}
                  className="cursor-help border-destructive/40 bg-destructive/10 font-mono text-[10px] uppercase text-destructive focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`${counts.none} credenciais ausentes`}
                >
                  AUSENTE · {counts.none}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="space-y-1.5">
                <p className="font-semibold">Sem valor em DB nem em ENV — {counts.none}</p>
                <p>
                  O <code className="font-mono">secrets-manager</code> não encontrou o segredo em
                  nenhuma das duas fontes — a integração que depende dele ficará inativa.
                </p>
                <div className="border-t pt-1.5">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Secrets ausentes
                  </p>
                  {renderNameList(grouped.none, 'destructive')}
                </div>
                <p className="text-muted-foreground">
                  🔧 Preencha o campo correspondente no card e salve para gravar em{' '}
                  <code className="font-mono">integration_credentials</code>.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
        title={absolute ? `Última gravação em ${absolute}` : undefined}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {isLoading && secrets.length === 0 ? (
          <span className="italic">Carregando…</span>
        ) : !relative ? (
          <span>Sem atualização registrada</span>
        ) : (
          <span>
            <span className="font-medium text-foreground">Atualizado {relative}</span>
            {absolute && (
              <span className="ml-1 hidden text-muted-foreground/80 md:inline">· {absolute}</span>
            )}
            {latest?.updated_by_email && (
              <span className="ml-1 hidden lg:inline">
                · por <span className="font-mono">{latest.updated_by_email}</span>
              </span>
            )}
          </span>
        )}
      </div>

      {onRefresh && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || isLoading}
                aria-label="Forçar atualização dos secrets"
                aria-busy={refreshing}
                data-testid="credentials-source-refresh"
                className="shrink-0 self-start"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="ml-1.5 text-xs">{refreshing ? 'Atualizando…' : 'Atualizar'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className=" ">
              Invalida o cache do <code className="font-mono">secrets-manager</code> e recarrega{' '}
              <code className="font-mono">integration_credentials</code> imediatamente. Útil após
              editar secrets em outra aba.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
