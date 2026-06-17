/**
 * DiscountManagementPanel — Painel completo de Gestão de Descontos
 * (limites por vendedor + fila de aprovações). Extraído da antiga
 * AdminDiscountApprovalsPage para reutilização dentro de Usuários.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Percent,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Edit,
  Trash2,
  Search,
  TrendingUp,
  Filter,
  Eye,
} from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
  useDiscountApproval,
  useSellerDiscountLimits,
  type DiscountApprovalWithQuote,
} from '@/hooks/quotes';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SellerProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

type ApprovalFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function DiscountManagementPanel() {
  const navigate = useNavigate();
  const {
    limits,
    isLoading: limitsLoading,
    fetchAllLimits,
    setLimit,
    deleteLimit,
  } = useSellerDiscountLimits();
  const {
    pendingRequests,
    isLoading: requestsLoading,
    fetchPendingRequests,
    respondToApproval,
  } = useDiscountApproval();

  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all');
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    userId: string;
    name: string;
    currentLimit: number;
    notes: string;
  }>({ open: false, userId: '', name: '', currentLimit: 5, notes: '' });
  const [respondDialog, setRespondDialog] = useState<{
    open: boolean;
    request: DiscountApprovalWithQuote | null;
    action: 'approve' | 'reject' | null;
    notes: string;
  }>({ open: false, request: null, action: null, notes: '' });

  const fetchSellers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, role')
      .order('full_name');
    setSellers((data || []) as SellerProfile[]);
  }, []);

  useEffect(() => {
    void fetchAllLimits();
    void fetchPendingRequests();
    void fetchSellers();
  }, [fetchAllLimits, fetchPendingRequests, fetchSellers]);

  const handleSetLimit = async () => {
    const ok = await setLimit(editDialog.userId, editDialog.currentLimit, editDialog.notes);
    if (ok) {
      setEditDialog({ open: false, userId: '', name: '', currentLimit: 5, notes: '' });
      fetchAllLimits();
    }
  };

  const handleRespond = async () => {
    if (!respondDialog.request || !respondDialog.action) return;
    const ok = await respondToApproval(
      respondDialog.request.id,
      respondDialog.action === 'approve',
      respondDialog.notes,
    );
    if (ok) {
      setRespondDialog({ open: false, request: null, action: null, notes: '' });
      fetchPendingRequests();
    }
  };

  const getLimitForSeller = (userId: string) => limits.find((l) => l.user_id === userId);

  const stats = useMemo(() => {
    const pendingCount = pendingRequests.filter((r) => r.status === 'pending').length;
    const approvedCount = pendingRequests.filter((r) => r.status === 'approved').length;
    const rejectedCount = pendingRequests.filter((r) => r.status === 'rejected').length;
    const sellersWithLimit = limits.length;
    const avgLimit =
      limits.length > 0
        ? limits.reduce((s, l) => s + l.max_discount_percent, 0) / limits.length
        : 0;
    return { pendingCount, approvedCount, rejectedCount, sellersWithLimit, avgLimit };
  }, [pendingRequests, limits]);

  const filteredSellers = useMemo(() => {
    if (!searchTerm) return sellers;
    const term = searchTerm.toLowerCase();
    return sellers.filter(
      (s) =>
        (s.full_name || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term),
    );
  }, [sellers, searchTerm]);

  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return pendingRequests;
    return pendingRequests.filter((r) => r.status === approvalFilter);
  }, [pendingRequests, approvalFilter]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Pendentes',
            value: stats.pendingCount,
            icon: Clock,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            border: stats.pendingCount > 0 ? 'border-amber-500/30' : 'border-border/50',
          },
          {
            label: 'Aprovados',
            value: stats.approvedCount,
            icon: CheckCircle,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            border: 'border-border/50',
          },
          {
            label: 'Rejeitados',
            value: stats.rejectedCount,
            icon: XCircle,
            color: 'text-destructive',
            bg: 'bg-destructive/10',
            border: 'border-border/50',
          },
          {
            label: 'Com Limite',
            value: stats.sellersWithLimit,
            icon: Users,
            color: 'text-primary',
            bg: 'bg-primary/10',
            border: 'border-border/50',
            suffix: ` / ${sellers.length}`,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Card className={cn('border', stat.border)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn('shrink-0 rounded-lg p-2', stat.bg)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {stat.value}
                    {stat.suffix && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {stat.suffix}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="limits" className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="limits" className="gap-2 px-4">
            <Percent className="h-4 w-4" /> Limites
          </TabsTrigger>
          <TabsTrigger value="approvals" className="relative gap-2 px-4">
            <Clock className="h-4 w-4" /> Aprovações
            {stats.pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] animate-pulse items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {stats.pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === LIMITS TAB === */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Limites de Desconto por Vendedor
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
              {stats.avgLimit > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Média de limite:{' '}
                  <span className="font-semibold">{stats.avgLimit.toFixed(1)}%</span>
                </p>
              )}
            </CardHeader>
            <CardContent>
              {limitsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2 pr-2">
                    <AnimatePresence mode="popLayout">
                      {filteredSellers.map((seller, idx) => {
                        const limit = getLimitForSeller(seller.user_id);
                        return (
                          <motion.div
                            key={seller.user_id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ delay: idx * 0.02 }}
                            className="group flex items-center justify-between rounded-xl border border-border/50 p-3 transition-all hover:border-primary/30 hover:bg-primary/[0.02]"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors',
                                  limit
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {(seller.full_name || seller.email || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {seller.full_name || seller.email}
                                </p>
                                <p className="text-xs text-muted-foreground">{seller.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {limit ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 font-semibold tabular-nums"
                                >
                                  <Percent className="h-3 w-3" />
                                  {limit.max_discount_percent}% máx
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="font-normal text-muted-foreground"
                                >
                                  Sem limite definido
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-50 transition-opacity group-hover:opacity-100"
                                onClick={() =>
                                  setEditDialog({
                                    open: true,
                                    userId: seller.user_id,
                                    name: seller.full_name || seller.email || '',
                                    currentLimit: limit?.max_discount_percent || 5,
                                    notes: limit?.notes || '',
                                  })
                                }
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              {limit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive opacity-50 transition-opacity hover:text-destructive group-hover:opacity-100"
                                  onClick={async () => {
                                    await deleteLimit(limit.id);
                                    fetchAllLimits();
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {filteredSellers.length === 0 && (
                      <div className="space-y-2 py-10 text-center">
                        <Search className="mx-auto h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm
                            ? 'Nenhum vendedor encontrado para esta busca'
                            : 'Nenhum vendedor cadastrado'}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === APPROVALS TAB === */}
        <TabsContent value="approvals" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(['all', 'pending', 'approved', 'rejected'] as ApprovalFilter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={approvalFilter === f ? 'default' : 'outline'}
                className={cn(
                  'h-7 gap-1.5 text-xs',
                  approvalFilter === f &&
                    f === 'pending' &&
                    'bg-amber-500 text-white hover:bg-amber-600',
                )}
                onClick={() => setApprovalFilter(f)}
              >
                {f === 'all' && 'Todos'}
                {f === 'pending' && (
                  <>
                    <Clock className="h-3 w-3" /> Pendentes
                  </>
                )}
                {f === 'approved' && (
                  <>
                    <CheckCircle className="h-3 w-3" /> Aprovados
                  </>
                )}
                {f === 'rejected' && (
                  <>
                    <XCircle className="h-3 w-3" /> Rejeitados
                  </>
                )}
                <span className="ml-0.5 tabular-nums">
                  (
                  {f === 'all'
                    ? pendingRequests.length
                    : pendingRequests.filter((r) => r.status === f).length}
                  )
                </span>
              </Button>
            ))}
          </div>

          {requestsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredApprovals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="space-y-3 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle className="h-7 w-7 text-emerald-500" />
                </div>
                <div>
                  <p className="text-base font-semibold">
                    {approvalFilter === 'all'
                      ? 'Nenhuma solicitação'
                      : `Nenhuma solicitação ${approvalFilter === 'pending' ? 'pendente' : approvalFilter === 'approved' ? 'aprovada' : 'rejeitada'}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {approvalFilter === 'pending'
                      ? 'Todas as solicitações foram respondidas'
                      : 'Não há registros para este filtro'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredApprovals.map((req, idx) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card
                      className={cn(
                        'transition-all hover:shadow-md',
                        req.status === 'pending' && 'border-amber-500/40 bg-amber-500/[0.03]',
                        req.status === 'approved' && 'border-emerald-500/30',
                        req.status === 'rejected' && 'border-destructive/20',
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'gap-1 font-semibold',
                                  req.status === 'pending' &&
                                    'border-amber-500/30 bg-amber-500/15 text-amber-600',
                                  req.status === 'approved' &&
                                    'border-emerald-500/30 bg-emerald-500/15 text-emerald-600',
                                  req.status === 'rejected' &&
                                    'border-destructive/30 bg-destructive/15 text-destructive',
                                )}
                              >
                                {req.status === 'pending' && <Clock className="h-3 w-3" />}
                                {req.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                                {req.status === 'rejected' && <XCircle className="h-3 w-3" />}
                                {req.status === 'pending'
                                  ? 'Pendente'
                                  : req.status === 'approved'
                                    ? 'Aprovado'
                                    : 'Rejeitado'}
                              </Badge>
                              {req.quote && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 gap-1 px-2 font-mono text-sm font-semibold text-foreground hover:text-primary"
                                  onClick={() => navigate(`/orcamentos/${req.quote_id}`)}
                                >
                                  {req.quote.quote_number}
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                                {format(new Date(req.created_at), "dd/MM 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <InfoCell label="Vendedor" value={req.seller?.full_name || '—'} />
                              <InfoCell
                                label="Cliente"
                                value={req.quote?.client_name || req.quote?.client_company || '—'}
                              />
                              <InfoCell
                                label="Solicitado"
                                value={`${req.requested_discount_percent}%`}
                                valueClass="text-amber-500 font-bold"
                              />
                              <InfoCell label="Limite" value={`${req.max_allowed_percent}%`} />
                            </div>

                            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/50 transition-all"
                                style={{ width: `${Math.min(req.max_allowed_percent, 100)}%` }}
                              />
                              <div
                                className={cn(
                                  'absolute inset-y-0 left-0 rounded-full transition-all',
                                  req.requested_discount_percent > req.max_allowed_percent
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500',
                                )}
                                style={{
                                  width: `${Math.min(req.requested_discount_percent, 100)}%`,
                                }}
                              />
                            </div>

                            {req.quote && (
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-muted-foreground">Total do orçamento:</span>
                                <span className="font-bold tabular-nums text-foreground">
                                  {formatCurrency(req.quote.total)}
                                </span>
                              </div>
                            )}
                            {req.seller_notes && (
                              <div className="rounded-lg border border-border/40 bg-muted/50 px-3 py-2 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Nota do vendedor
                                </span>
                                <p className="mt-0.5 text-foreground/80">{req.seller_notes}</p>
                              </div>
                            )}
                            {req.admin_notes && (
                              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                                  Nota do admin
                                </span>
                                <p className="mt-0.5 text-foreground/80">{req.admin_notes}</p>
                              </div>
                            )}
                          </div>

                          {req.status === 'pending' && (
                            <div className="flex shrink-0 flex-col gap-2">
                              <Button
                                size="sm"
                                className="gap-1.5 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                                onClick={() =>
                                  setRespondDialog({
                                    open: true,
                                    request: req,
                                    action: 'approve',
                                    notes: '',
                                  })
                                }
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5"
                                onClick={() =>
                                  setRespondDialog({
                                    open: true,
                                    request: req,
                                    action: 'reject',
                                    notes: '',
                                  })
                                }
                              >
                                <XCircle className="h-3.5 w-3.5" /> Rejeitar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Limit Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => !open && setEditDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Limite de Desconto
            </DialogTitle>
            <DialogDescription>
              Defina o desconto máximo para{' '}
              <span className="font-semibold text-foreground">{editDialog.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Desconto Máximo (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={editDialog.currentLimit}
                  onChange={(e) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      currentLimit: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="pr-8 text-lg font-semibold"
                />
                <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(editDialog.currentLimit, 100)}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={editDialog.notes}
                onChange={(e) => setEditDialog((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações sobre este limite..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog((prev) => ({ ...prev, open: false }))}
            >
              Cancelar
            </Button>
            <Button onClick={handleSetLimit} className="gap-1.5">
              <CheckCircle className="h-4 w-4" />
              Salvar Limite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond Dialog */}
      <Dialog
        open={respondDialog.open}
        onOpenChange={(open) => !open && setRespondDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {respondDialog.action === 'approve' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-500" /> Aprovar Desconto
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" /> Rejeitar Desconto
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {respondDialog.action === 'approve'
                ? 'O vendedor poderá aplicar o desconto solicitado ao orçamento.'
                : 'O vendedor será notificado e deverá ajustar o desconto.'}
            </DialogDescription>
          </DialogHeader>
          {respondDialog.request && (
            <div className="space-y-4 py-2">
              <div className="space-y-2 rounded-xl border border-border/40 bg-muted/50 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoCell
                    label="Orçamento"
                    value={respondDialog.request.quote?.quote_number || '—'}
                  />
                  <InfoCell
                    label="Vendedor"
                    value={respondDialog.request.seller?.full_name || '—'}
                  />
                  <InfoCell
                    label="Desconto solicitado"
                    value={`${respondDialog.request.requested_discount_percent}%`}
                    valueClass="text-amber-500 font-bold"
                  />
                  <InfoCell
                    label="Limite autorizado"
                    value={`${respondDialog.request.max_allowed_percent}%`}
                  />
                </div>
                <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/40"
                    style={{
                      width: `${Math.min(respondDialog.request.max_allowed_percent, 100)}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
                    style={{
                      width: `${Math.min(respondDialog.request.requested_discount_percent, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                  <span>0%</span>
                  <span>{respondDialog.request.max_allowed_percent}% (limite)</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  {respondDialog.action === 'reject' ? 'Motivo da rejeição' : 'Notas (opcional)'}
                </Label>
                <Textarea
                  value={respondDialog.notes}
                  onChange={(e) => setRespondDialog((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={
                    respondDialog.action === 'reject'
                      ? 'Explique o motivo da rejeição...'
                      : 'Observações...'
                  }
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRespondDialog((prev) => ({ ...prev, open: false }))}
            >
              Cancelar
            </Button>
            <Button
              className={cn(
                'gap-1.5',
                respondDialog.action === 'approve' &&
                  'bg-emerald-500 text-white hover:bg-emerald-600',
              )}
              variant={respondDialog.action === 'reject' ? 'destructive' : 'default'}
              onClick={handleRespond}
            >
              {respondDialog.action === 'approve' ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Confirmar Aprovação
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" /> Confirmar Rejeição
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 truncate text-sm font-medium', valueClass)}>{value}</p>
    </div>
  );
}
