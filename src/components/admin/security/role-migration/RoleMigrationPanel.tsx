/**
 * RoleMigrationPanel
 * ----------------------------------------------------------------------------
 * Painel administrativo para executar migração de papéis em lotes:
 *
 *  1. Selecionar usuários da lista de profiles.
 *  2. Definir operação (add / remove / replace) e papel-alvo.
 *  3. Rodar dry-run para validar (não aplica, só audita).
 *  4. Executar de fato — cada item gera entrada em `role_migration_items`
 *     e em `admin_audit_log` (rastreio por usuário e por evento).
 *  5. Acompanhar histórico de lotes com drill-down nos itens.
 *
 * RBAC: a RPC server-side exige `is_admin_strict`; aqui no front também
 * gateamos por `useUserRole` para evitar mostrar a UI a quem não pode usar.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  PlayCircle,
  FlaskConical,
  History,
  ChevronRight,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useRoleMigration,
  type AppRole,
  type BatchRow,
  type ItemRow,
  type MigrationItemInput,
} from '@/hooks/admin';

const ROLES: AppRole[] = [
  'admin',
  'manager',
  'supervisor',
  'coordenador',
  'agente',
  'vendedor',
  'dev',
];
const OPERATIONS = [
  { value: 'add', label: 'Adicionar papel', description: 'INSERT user_roles (mantém os demais)' },
  {
    value: 'remove',
    label: 'Remover papel',
    description: 'DELETE user_roles deste papel específico',
  },
  {
    value: 'replace',
    label: 'Substituir todos',
    description: 'DELETE todos os papéis + INSERT do novo',
  },
] as const;

interface ProfileLite {
  userId: string;
  email: string | null;
  full_name: string | null;
  current_roles: AppRole[];
}

const STATUS_BADGE: Record<
  string,
  { variant: 'default' | 'destructive' | 'outline' | 'secondary'; className?: string }
> = {
  completed: { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  partial: { variant: 'secondary' },
  failed: { variant: 'destructive' },
  running: { variant: 'outline' },
  pending: { variant: 'outline' },
  dry_run: { variant: 'secondary' },
  success: { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  skipped: { variant: 'outline' },
};

export function RoleMigrationPanel() {
  const { batches, loadingBatches, submitting, refreshBatches, executeBatch, fetchItems } =
    useRoleMigration();
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toRole, setToRole] = useState<AppRole>('supervisor');
  const [operation, setOperation] = useState<MigrationItemInput['operation']>('add');
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [openBatch, setOpenBatch] = useState<BatchRow | null>(null);
  const [openItems, setOpenItems] = useState<ItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Carrega profiles + papéis atuais
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProfiles(true);
      try {
        const [{ data: profs, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
          supabase.from('profiles').select('user_id, email, full_name').order('email'),
          supabase.from('user_roles').select('user_id, role'),
        ]);
        if (pErr) throw pErr;
        if (rErr) throw rErr;
        if (cancelled) return;
        const rolesByUser = new Map<string, AppRole[]>();
        for (const r of roles ?? []) {
          const arr = rolesByUser.get(r.user_id) ?? [];
          arr.push(r.role as AppRole);
          rolesByUser.set(r.user_id, arr);
        }
        setProfiles(
          (profs ?? [])
            .filter((p): p is typeof p & { user_id: string } => p.user_id !== null)
            .map((p) => ({
              userId: p.user_id,
              email: p.email,
              full_name: p.full_name,
              current_roles: rolesByUser.get(p.user_id) ?? [],
            })),
        );
      } catch {
        toast.error('Falha ao carregar usuários', {
          description: 'Não foi possível carregar a lista de usuários.',
        });
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.email ?? '').toLowerCase().includes(q) || (p.full_name ?? '').toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const buildItems = (): MigrationItemInput[] =>
    Array.from(selected).map((userId) => ({ user_id: userId, to_role: toRole, operation }));

  const submit = async (dryRun: boolean) => {
    if (selected.size === 0) {
      toast.error('Selecione ao menos 1 usuário');
      return;
    }
    if (label.trim().length < 3) {
      toast.error('Defina um rótulo descritivo para o lote (mín. 3 caracteres)');
      return;
    }
    if (reason.trim().length < 5) {
      toast.error('Justifique a migração (mín. 5 caracteres)');
      return;
    }
    try {
      const batchId = await executeBatch({
        label: label.trim(),
        reason: reason.trim(),
        items: buildItems(),
        dryRun,
      });
      toast.success(dryRun ? 'Dry-run concluído' : 'Lote executado', {
        description: `Batch ${batchId.slice(0, 8)}… registrado.`,
      });
      if (!dryRun) {
        setSelected(new Set());
      }
    } catch {
      toast.error('Falha ao executar lote', {
        description: 'Não foi possível executar o lote de migração.',
      });
    }
  };

  const drillDown = async (b: BatchRow) => {
    setOpenBatch(b);
    setLoadingItems(true);
    try {
      setOpenItems(await fetchItems(b.id));
    } catch {
      toast.error('Falha ao carregar itens', {
        description: 'Não foi possível carregar os itens do lote.',
      });
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Migração de papéis em lote</CardTitle>
              <CardDescription>
                Execute trocas de papéis para múltiplos usuários com auditoria por evento
                (`role_migration_items` + `admin_audit_log`). Sempre rode <strong>dry-run</strong>{' '}
                antes de aplicar de verdade.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="rm-label">Rótulo do lote</Label>
              <Input
                id="rm-label"
                placeholder="ex.: Fase 2 — Supervisores"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="rm-reason">Justificativa</Label>
              <Textarea
                id="rm-reason"
                rows={2}
                placeholder="Descreva o motivo desta migração (auditoria)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Operação</Label>
              <Select
                value={operation}
                onValueChange={(v) => setOperation(v as MigrationItemInput['operation'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex flex-col">
                        <span>{o.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {o.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel-alvo</Label>
              <Select value={toRole} onValueChange={(v) => setToRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rm-search">Filtrar usuários</Label>
              <Input
                id="rm-search"
                placeholder="email ou nome…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {(operation === 'replace' || toRole === 'admin' || toRole === 'dev') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Operação de alto impacto</AlertTitle>
              <AlertDescription>
                {operation === 'replace' &&
                  'Esta operação remove TODOS os papéis atuais antes de inserir o novo. '}
                {(toRole === 'admin' || toRole === 'dev') &&
                  `Promover a "${toRole}" concede acesso administrativo. `}
                Sempre execute dry-run primeiro e revise o histórico.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selected.size} de {filtered.length} usuários selecionados
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(filtered.map((p) => p.userId)))}
                >
                  Selecionar todos visíveis
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Limpar
                </Button>
              </div>
            </div>
            <ScrollArea className="h-72 rounded-lg border">
              {loadingProfiles ? (
                <div className="flex items-center justify-center p-6 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((p) => (
                    <label
                      key={p.userId}
                      className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selected.has(p.userId)}
                        onCheckedChange={() => toggle(p.userId)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {p.full_name || p.email || p.userId}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.current_roles.length === 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            sem papel
                          </Badge>
                        ) : (
                          p.current_roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {r}
                            </Badge>
                          ))
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => submit(true)} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              Dry-run
            </Button>
            <Button onClick={() => submit(false)} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Executar lote
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>Histórico de lotes</CardTitle>
                <CardDescription>Últimos 50 lotes (dry-run incluso)</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refreshBatches();
              }}
              disabled={loadingBatches}
            >
              {loadingBatches && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum lote ainda. Execute o primeiro acima.
            </p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => {
                const meta = STATUS_BADGE[b.status] ?? STATUS_BADGE.pending;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      drillDown(b);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{b.label}</span>
                        <Badge variant={meta.variant} className={meta.className}>
                          {b.status}
                        </Badge>
                        {b.dry_run && (
                          <Badge variant="outline" className="text-[10px]">
                            DRY-RUN
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{b.reason}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {new Date(b.created_at).toLocaleString('pt-BR')} · {b.total_items} itens ·
                        ✅ {b.success_count} · ❌ {b.failed_count} · ⏭ {b.skipped_count}
                        {b.duration_ms !== null && ` · ${b.duration_ms}ms`}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}

          {openBatch && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Itens do lote: {openBatch.label}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpenBatch(null);
                      setOpenItems([]);
                    }}
                  >
                    Fechar
                  </Button>
                </div>
                {loadingItems ? (
                  <div className="flex items-center justify-center p-4 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando itens…
                  </div>
                ) : (
                  <div className="space-y-1">
                    {openItems.map((it) => {
                      const meta = STATUS_BADGE[it.status] ?? STATUS_BADGE.pending;
                      return (
                        <div
                          key={it.id}
                          className="flex items-start gap-3 rounded border bg-card p-2 text-sm"
                        >
                          <Badge variant={meta.variant} className={meta.className}>
                            {it.status}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="truncate">
                              <span className="font-medium">{it.user_email ?? it.user_id}</span>
                              <span className="text-muted-foreground"> · {it.operation} </span>
                              <code className="text-xs">
                                {it.from_role ?? '—'} → {it.to_role}
                              </code>
                            </div>
                            {it.error_message && (
                              <div className="mt-1 font-mono text-xs text-destructive">
                                {it.error_message}
                              </div>
                            )}
                          </div>
                          {it.duration_ms !== null && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {it.duration_ms}ms
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
