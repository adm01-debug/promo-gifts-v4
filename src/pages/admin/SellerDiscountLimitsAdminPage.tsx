/**
 * SellerDiscountLimitsAdminPage — Tela admin para configurar `seller_discount_limits`
 * e visualizar o impacto direto nas `discount_approval_requests`.
 *
 * Estrutura:
 *  • Header explicativo + regras gerais (como o limite afeta o fluxo)
 *  • Tabela de vendedores: limite editável, notas, métricas de impacto (pendentes/aprovadas/negadas)
 *  • Painel de requisições recentes que excederam o limite
 */
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Percent,
  Save,
  ShieldAlert,
  Info,
  ArrowLeft,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

const DEFAULT_LIMIT = 5;

interface SellerRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  max_discount_percent: number;
  notes: string | null;
  hasCustomLimit: boolean;
}

interface ImpactRow {
  seller_id: string;
  pending: number;
  approved: number;
  rejected: number;
  avg_requested: number;
  max_requested: number;
}

interface ExceededRequest {
  id: string;
  seller_id: string;
  requested_discount_percent: number;
  max_allowed_percent: number;
  status: string;
  created_at: string;
  quote_id: string;
}

export default function SellerDiscountLimitsAdminPage() {
  const qc = useQueryClient();
  const { isAdmin, rolesLoaded } = useAuth(); // FIX 2026-06-18: guard de auth
  const [edits, setEdits] = useState<Record<string, { percent?: number; notes?: string }>>({});

  // ---------- Vendedores + limites ----------
  const { data: sellers, isLoading: loadingSellers } = useQuery({
    queryKey: ['admin-seller-discount-limits'],
    enabled: rolesLoaded && Boolean(isAdmin),
    retry: 0,
    queryFn: async (): Promise<SellerRow[]> => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role, is_active')
        .eq('role', 'vendedor')
        .eq('is_active', true)
        .order('full_name');
      if (pErr) throw pErr;

      const sellers = (profiles ?? []).filter(
        (p): p is typeof p & { user_id: string } => p.user_id !== null,
      );
      const ids = sellers.map((p) => p.user_id);
      if (!ids.length) return [];

      const { data: limits } = await supabase
        .from('seller_discount_limits')
        .select('user_id, max_discount_percent, notes')
        .in('user_id', ids);

      const byId = new Map(
        (limits ?? []).map((l) => [
          l.user_id,
          { pct: Number(l.max_discount_percent), notes: l.notes ?? null },
        ]),
      );

      return sellers.map((p) => {
        const lim = byId.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          max_discount_percent: lim?.pct ?? DEFAULT_LIMIT,
          notes: lim?.notes ?? null,
          hasCustomLimit: !!lim,
        };
      });
    },
  });

  // ---------- Impacto: agregados de discount_approval_requests ----------
  const { data: impact } = useQuery({
    queryKey: ['admin-discount-impact'],
    enabled: rolesLoaded && Boolean(isAdmin),
    retry: 0,
    queryFn: async (): Promise<Map<string, ImpactRow>> => {
      const { data, error } = await supabase
        // rls-allow: admin-only; RLS filtra
        .from('discount_approval_requests')
        .select('seller_id, status, requested_discount_percent');
      if (error) throw error;

      const map = new Map<string, ImpactRow>();
      for (const r of data ?? []) {
        const cur = map.get(r.seller_id) ?? {
          seller_id: r.seller_id,
          pending: 0,
          approved: 0,
          rejected: 0,
          avg_requested: 0,
          max_requested: 0,
        };
        if (r.status === 'pending') cur.pending++;
        else if (r.status === 'approved') cur.approved++;
        else if (r.status === 'rejected') cur.rejected++;
        const pct = Number(r.requested_discount_percent);
        cur.avg_requested += pct;
        cur.max_requested = Math.max(cur.max_requested, pct);
        map.set(r.seller_id, cur);
      }
      // converter soma em média
      for (const v of map.values()) {
        const total = v.pending + v.approved + v.rejected;
        v.avg_requested = total ? +(v.avg_requested / total).toFixed(2) : 0;
      }
      return map;
    },
  });

  // ---------- Requisições recentes que excederam limite ----------
  const { data: exceeded } = useQuery({
    queryKey: ['admin-discount-exceeded'],
    enabled: rolesLoaded && Boolean(isAdmin),
    retry: 0,
    queryFn: async (): Promise<ExceededRequest[]> => {
      const { data, error } = await supabase
        // rls-allow: admin-only; RLS filtra
        .from('discount_approval_requests')
        .select(
          'id, seller_id, requested_discount_percent, max_allowed_percent, status, created_at, quote_id',
        )
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).filter(
        (r) => Number(r.requested_discount_percent) > Number(r.max_allowed_percent),
      );
    },
  });

  // ---------- Mutation: salvar limite + notas ----------
  const save = useMutation({
    mutationFn: async ({
      userId,
      percent,
      notes,
    }: {
      userId: string;
      percent: number;
      notes: string;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const { error } = await supabase.from('seller_discount_limits').upsert(
        {
          user_id: userId,
          max_discount_percent: percent,
          notes: notes || null,
          set_by: u.user.id,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success('Limite atualizado');
      setEdits((prev) => {
        const { [vars.userId]: _, ...rest } = prev;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ['admin-seller-discount-limits'] });
      qc.invalidateQueries({ queryKey: ['admin-discount-impact'] });
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const sellerNameById = useMemo(() => {
    const m = new Map<string, string>();
    (sellers ?? []).forEach((s) =>
      m.set(s.user_id, s.full_name ?? s.email ?? s.user_id.slice(0, 8)),
    );
    return m;
  }, [sellers]);

  const totals = useMemo(() => {
    let pending = 0,
      approved = 0,
      rejected = 0;
    impact?.forEach((v) => {
      pending += v.pending;
      approved += v.approved;
      rejected += v.rejected;
    });
    return { pending, approved, rejected, total: pending + approved + rejected };
  }, [impact]);

  return (
    <>
      <PageSEO
        title="Limites de Desconto — Admin"
        description="Configure os limites máximos de desconto por vendedor e visualize o impacto nas solicitações de aprovação."
        path="/admin/limites-desconto"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <Percent className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1
                data-testid="page-title-seller-discount-limits"
                className="font-display text-3xl font-bold tracking-tight"
              >
                Limites de desconto
              </h1>
              <p className="text-muted-foreground">
                Defina o teto de desconto por vendedor — solicitações acima do limite exigem
                aprovação.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/usuarios">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>

        {/* Regras gerais */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como o limite afeta as requisições</AlertTitle>
          <AlertDescription className="mt-2 space-y-1 text-sm">
            <p>
              • <b>Desconto ≤ limite</b>: aplicado direto no orçamento, sem aprovação.
            </p>
            <p>
              • <b>Desconto &gt; limite</b>: cria uma <code>discount_approval_request</code>{' '}
              pendente que precisa ser aprovada por supervisor/admin.
            </p>
            <p>
              • <b>Sem limite definido</b>: o vendedor herda o padrão global de{' '}
              <b>{DEFAULT_LIMIT}%</b>.
            </p>
            <p>
              • Alterações de limite valem apenas para <b>novas</b> solicitações; pendentes
              existentes mantêm o teto registrado no momento da criação.
            </p>
          </AlertDescription>
        </Alert>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Pendentes"
            value={totals.pending}
            tone="warning"
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Aprovadas"
            value={totals.approved}
            tone="success"
          />
          <KpiCard
            icon={<XCircle className="h-4 w-4" />}
            label="Recusadas"
            value={totals.rejected}
            tone="danger"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total histórico"
            value={totals.total}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Tabela de vendedores */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Limites por vendedor</CardTitle>
              <CardDescription>
                Edite o percentual e adicione observações para justificar exceções. Métricas mostram
                o impacto histórico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSellers ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (sellers?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum vendedor ativo encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {(sellers ?? []).map((row) => {
                    const edit = edits[row.user_id] ?? {};
                    const currentPct = edit.percent ?? row.max_discount_percent;
                    const currentNotes = edit.notes ?? row.notes ?? '';
                    const dirty =
                      currentPct !== row.max_discount_percent || currentNotes !== (row.notes ?? '');
                    const imp = impact?.get(row.user_id);
                    const stress = imp && imp.max_requested > row.max_discount_percent;

                    return (
                      <div
                        key={row.user_id}
                        className="space-y-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-[180px] flex-1">
                            <p className="truncate text-sm font-medium">
                              {row.full_name || 'Sem nome'}
                              {!row.hasCustomLimit && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  padrão
                                </Badge>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={currentPct}
                              onChange={(e) =>
                                setEdits((p) => ({
                                  ...p,
                                  [row.user_id]: { ...p[row.user_id], percent: +e.target.value },
                                }))
                              }
                              className="w-24"
                              aria-label="Limite máximo de desconto em porcentagem"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <Button
                              size="sm"
                              disabled={!dirty || save.isPending}
                              onClick={() =>
                                save.mutate({
                                  userId: row.user_id,
                                  percent: currentPct,
                                  notes: currentNotes,
                                })
                              }
                            >
                              <Save className="mr-1 h-3.5 w-3.5" /> Salvar
                            </Button>
                          </div>
                        </div>

                        <Textarea
                          placeholder="Observações internas (motivo da exceção, validade, etc.)"
                          value={currentNotes}
                          onChange={(e) =>
                            setEdits((p) => ({
                              ...p,
                              [row.user_id]: { ...p[row.user_id], notes: e.target.value },
                            }))
                          }
                          rows={2}
                          className="text-xs"
                        />

                        {/* Impacto */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <ImpactPill label="pendentes" value={imp?.pending ?? 0} tone="warning" />
                          <ImpactPill label="aprovadas" value={imp?.approved ?? 0} tone="success" />
                          <ImpactPill label="recusadas" value={imp?.rejected ?? 0} tone="danger" />
                          {imp && imp.avg_requested > 0 && (
                            <span className="text-muted-foreground">
                              média solicitada: <b>{imp.avg_requested}%</b>
                            </span>
                          )}
                          {imp && imp.max_requested > 0 && (
                            <span className="text-muted-foreground">
                              pico: <b>{imp.max_requested}%</b>
                            </span>
                          )}
                          {stress && (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              vendedor solicita acima do limite
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requisições que excederam */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Requisições acima do limite
              </CardTitle>
              <CardDescription>
                Últimas 20 solicitações criadas — destaque para as que estouraram.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!exceeded ? (
                <Skeleton className="h-32" />
              ) : exceeded.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma solicitação recente excedeu o limite. ✅
                </p>
              ) : (
                <ul className="divide-y">
                  {exceeded.map((r) => (
                    <li key={r.id} className="space-y-0.5 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {sellerNameById.get(r.seller_id) ?? r.seller_id.slice(0, 8)}
                        </span>
                        <Badge
                          variant={
                            r.status === 'approved'
                              ? 'default'
                              : r.status === 'rejected'
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        solicitou{' '}
                        <b className="text-destructive">{r.requested_discount_percent}%</b> / teto{' '}
                        <b>{r.max_allowed_percent}%</b>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} ·{' '}
                        <Link to={`/orcamentos/${r.quote_id}`} className="underline">
                          ver orçamento
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------- subcomponentes ----------
function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const toneCls =
    tone === 'success'
      ? 'text-emerald-600 bg-emerald-500/10'
      : tone === 'warning'
        ? 'text-amber-600 bg-amber-500/10'
        : tone === 'danger'
          ? 'text-destructive bg-destructive/10'
          : 'text-muted-foreground bg-muted';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${toneCls}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ImpactPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
}) {
  const toneCls =
    tone === 'success'
      ? 'border-emerald-500/30 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-500/30 text-amber-700'
        : 'border-destructive/30 text-destructive';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${toneCls}`}>
      <b>{value}</b> {label}
    </span>
  );
}
