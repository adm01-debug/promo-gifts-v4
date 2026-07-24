import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  KeyRound,
  ShieldCheck,
  Clock,
  UserRound,
  History,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { MaskedSuffixBadge } from './MaskedSuffixBadge';
import type { resolveSupabaseConnectionStatus } from './connectionStatus';
import type { LastTestInfo } from './LastTestLine';
import { useSecretsManager, type RotationHistoryEntry, type SecretStatus } from '@/hooks/admin';

type ConnectionStatus = ReturnType<typeof resolveSupabaseConnectionStatus>;

interface CredentialField {
  /** Rótulo amigável (ex: "URL do projeto", "Anon Key"). */
  label: string;
  /** Nome do secret no `integration_credentials` (ex: EXTERNAL_PROMOBRIND_URL). */
  secretName: string;
  /** Status já resolvido (do hook useSecretsManager). */
  status: SecretStatus | undefined;
  /** Marca campos sensíveis (Service Role) com ícone diferenciado. */
  sensitive?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Nome humano (ex: "Catálogo Promobrind"). */
  connectionLabel: string;
  /** Descrição secundária do card. */
  description?: string;
  /** Status calculado (Ativo/Erro/Sem credenciais…). */
  status: ConnectionStatus;
  /** Último teste de conexão (null se nunca testado). */
  last?: LastTestInfo | null;
  /** Lista de credenciais mascaradas a exibir. */
  fields: CredentialField[];
  /** Slot opcional para mostrar histórico/teste extra. */
  onOpenFullHistory?: () => void;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Tela de detalhes de uma conexão (Promobrind / CRM / etc).
 *
 * Mostra **apenas** dados não-sensíveis:
 *   - Badge de status (Ativo / Erro / Sem credenciais)
 *   - Resultado do último teste (latência, mensagem, timestamp)
 *   - Cada credencial: rótulo + sufixo mascarado + length + última rotação
 *     (autor por e-mail via `rotated_by_email`, com timestamp)
 *
 * NUNCA exibe o valor cru — sufixo já vem mascarado do secrets-manager.
 */
export function ConnectionDetailsDialog({
  open,
  onOpenChange,
  connectionLabel,
  description,
  status,
  last,
  fields,
  onOpenFullHistory,
}: Props) {
  const { getRotationHistory } = useSecretsManager();
  const [historyBySecret, setHistoryBySecret] = useState<
    Record<string, RotationHistoryEntry | null>
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    Promise.all(
      fields.map(async (f) => {
        const entries = await getRotationHistory(f.secretName);
        return [f.secretName, entries[0] ?? null] as const;
      }),
    )
      .then((pairs) => {
        if (!active) return;
        setHistoryBySecret(Object.fromEntries(pairs));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, fields, getRotationHistory]);

  const overallUpdatedAt = useMemo(() => {
    const stamps = fields
      .map((f) => f.status?.updated_at)
      .filter((v): v is string => !!v)
      .sort();
    return stamps[stamps.length - 1] ?? null;
  }, [fields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <DialogTitle>{connectionLabel}</DialogTitle>
            </div>
            <ConnectionStatusBadge status={status} />
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-5">
            {/* Resumo do último teste */}
            <section className="rounded-lg border bg-muted/30 p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Último teste
              </h3>
              {last ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Resultado</dt>
                  <dd className="font-medium">
                    {last.ok ? (
                      <span className="text-success">OK</span>
                    ) : (
                      <span className="text-destructive">Falhou</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Quando</dt>
                  <dd>{fmtDate(last.tested_at)}</dd>
                  {last.latency_ms !== null && (
                    <>
                      <dt className="text-muted-foreground">Latência</dt>
                      <dd>{last.latency_ms} ms</dd>
                    </>
                  )}
                  {last.message && (
                    <>
                      <dt className="text-muted-foreground">Mensagem</dt>
                      <dd className="truncate font-mono text-xs">{last.message}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Nunca testado.</p>
              )}
            </section>

            <Separator />

            {/* Credenciais mascaradas */}
            <section>
              <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Credenciais ({fields.length})
                </span>
                <span className="text-[10px] normal-case text-muted-foreground">
                  Atualizado por último: {fmtDate(overallUpdatedAt)}
                </span>
              </h3>
              <ul className="space-y-3">
                {fields.map((f) => {
                  const fieldStatus = f.status;
                  const has = !!fieldStatus?.has_value;
                  const fieldLast = historyBySecret[f.secretName];
                  return (
                    <li key={f.secretName} className="rounded-md border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {f.sensitive ? (
                            <ShieldCheck className="h-4 w-4 text-primary" />
                          ) : (
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{f.label}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {f.secretName}
                            </p>
                          </div>
                        </div>
                        {has ? (
                          <MaskedSuffixBadge
                            suffix={fieldStatus?.masked_suffix ?? null}
                            length={fieldStatus?.length ?? null}
                            secretName={f.secretName}
                            showWhenValid
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/10 text-destructive"
                          >
                            ausente
                          </Badge>
                        )}
                      </div>

                      <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
                        <dt className="text-muted-foreground">Tamanho</dt>
                        <dd className="col-span-2 font-mono">
                          {fieldStatus?.length ? `${fieldStatus.length} chars` : '—'}
                        </dd>
                        <dt className="text-muted-foreground">Origem</dt>
                        <dd className="col-span-2 capitalize">
                          {fieldStatus?.source ?? (has ? '—' : 'não configurado')}
                        </dd>
                        <dt className="text-muted-foreground">Última rotação</dt>
                        <dd className="col-span-2">
                          {loading ? (
                            <span className="text-muted-foreground">carregando…</span>
                          ) : fieldLast ? (
                            <span className="flex items-center gap-1.5">
                              <UserRound className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">
                                {fieldLast.rotated_by_email ??
                                  (fieldLast.rotated_by
                                    ? `${fieldLast.rotated_by.slice(0, 8)}…`
                                    : 'autor desconhecido')}
                              </span>
                              <span className="text-muted-foreground">
                                · {fmtDate(fieldLast.rotated_at)}
                              </span>
                              {fieldLast.action_type && (
                                <Badge
                                  variant="outline"
                                  className="ml-1 px-1 py-0 text-[9px] uppercase"
                                >
                                  {fieldLast.action_type}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">nenhuma registrada</span>
                          )}
                        </dd>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/external-db">
              <ExternalLink className="mr-1 h-4 w-4" /> Ver schema
            </Link>
          </Button>
          <div className="flex gap-2">
            {onOpenFullHistory && (
              <Button variant="outline" size="sm" onClick={onOpenFullHistory}>
                <History className="mr-1 h-4 w-4" /> Histórico de testes
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
