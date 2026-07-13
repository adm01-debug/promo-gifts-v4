/**
 * CartsListPage — Workspace: lista de carrinhos abertos do vendedor.
 *
 * Layout em tabela (estilo Orçamentos): logo do cliente + nome, status,
 * itens, valor, data de atualização. Clique na linha → /carrinhos/:cartId.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ArrowUpDown, Search, X, CheckSquare, Trash2, MoreVertical, Edit, Copy, FileText, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { showUndoToast } from '@/utils/undoToast';
import {
  bulkRestoreSummary,
  UNDO_DURATION_MS,
  UNDO_TOAST_DESCRIPTION,
  deleteConfirmDialogTitle,
  deleteConfirmDialogDescription,
  deletedToastTitle,
  confirmDialogConfirmLabel,
} from '@/pages/products/seller-carts/undoCopy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { FadeInView, AnimatedCounter } from '@/components/common/MicroInteractions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageSEO } from '@/components/seo/PageSEO';
import { CompanyListAvatar } from '@/components/shared/CompanyListAvatar';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { formatCurrency, getStatusCfg, STATUS_CONFIG } from '@/components/cart/CartUtilComponents';
import { cn } from '@/lib/utils';
import { maskCnpj } from '@/utils/masks';
import { useCrmCompanies } from '@/hooks/crm/useCrmCompanies';
import type { SellerCart, CartStatus } from '@/hooks/products';
import {
  matchesDeadlineFilter,
  getShippingDeadlineStatus,
  daysUntilDeadline,
  getDeadlineLabel,
  DEADLINE_BADGE_CLASSES,
  type DeadlineFilter,
} from '@/lib/carts/shipping-deadline';
import { useListUrlState } from '@/hooks/common/useListUrlState';


type StatusFilter = CartStatus | 'all';
type SortKey = 'items-desc' | 'recent' | 'value-desc' | 'deadline-asc' | 'deadline-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Mais recente' },
  { value: 'value-desc', label: 'Maior valor' },
  { value: 'items-desc', label: 'Mais itens' },
  { value: 'deadline-asc', label: 'Prazo: mais próximo' },
  { value: 'deadline-desc', label: 'Prazo: mais distante' },
];

const DEADLINE_FILTER_OPTIONS: { value: DeadlineFilter; label: string }[] = [
  { value: 'all', label: 'Todos os prazos' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'soon', label: 'Próximos (3 dias)' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'month', label: 'Próximos 30 dias' },
  { value: 'none', label: 'Sem prazo' },
];

function cartSubtotal(c: SellerCart) {
  return c.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
}

/**
 * Normaliza para busca acento-insensível: razões sociais em pt-BR são cheias de
 * acentos (São, Comércio, Eletrônica) e o vendedor frequentemente digita sem eles.
 * Sem isto, "sao paulo" não encontra "São Paulo".
 */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function CartsListPage() {
  return (
    <>
      <PageSEO
        title="Carrinhos"
        description="Carrinhos abertos por cliente — selecione um para gerenciar produtos, status, notas e exportar para orçamento."
        path="/carrinhos"
        noIndex
      />
      <CartsListContent />
    </>
  );
}

function CartsListContent() {
  const navigate = useNavigate();
  const { carts, isLoading, deleteCart, duplicateCart, restoreCart } = useSellerCartContext();

  const handleGenerateQuote = useCallback(
    (cart: SellerCart) => {
      if (!cart.items || cart.items.length === 0) {
        toast.error('Carrinho vazio', {
          description: 'Adicione ao menos um produto antes de gerar o orçamento.',
        });
        return;
      }
      navigate('/orcamentos/novo', {
        state: {
          fromCart: true,
          companyId: cart.company_id,
          companyName: cart.company_name,
          companyLocation: cart.company_location || undefined,
          items: cart.items.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            product_sku: i.product_sku || undefined,
            product_image_url: i.product_image_url || undefined,
            quantity: i.quantity,
            unit_price: i.product_price,
            color_name: i.color_name || undefined,
            color_hex: i.color_hex || undefined,
          })),
        },
      });
    },
    [navigate],
  );

  const { data: crmCompanies } = useCrmCompanies();
  const cnpjByCompanyId = useMemo(() => {
    const map = new Map<string, string>();
    (crmCompanies ?? []).forEach((c) => {
      if (c.id && c.cnpj) map.set(c.id, c.cnpj);
    });
    return map;
  }, [crmCompanies]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Persistência de filtros/ordenação na URL — SSOT: `useListUrlState`.
  // Deep-links sobrevivem a reload; defaults ficam fora da query string.
  const { values, setValue, searchInput: queryInput, setSearchInput: setQueryInput, clearAll } =
    useListUrlState({
      keys: { status: 'all', deadline: 'all', sort: 'recent', q: '' } as const,
      searchKey: 'q',
      debounceMs: 250,
    });

  const statusFilter = values.status as StatusFilter;
  const deadlineFilter = values.deadline as DeadlineFilter;
  const sort = values.sort as SortKey;
  const debouncedQuery = values.q;

  const setStatusFilter = useCallback(
    (v: StatusFilter) => setValue('status', v),
    [setValue],
  );
  const setDeadlineFilter = useCallback(
    (v: DeadlineFilter) => setValue('deadline', v),
    [setValue],
  );
  const setSort = useCallback((v: SortKey) => setValue('sort', v), [setValue]);


  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // deleteCart já vem do context acima


  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: carts.length,
      em_separacao: 0,
      pronto_orcamento: 0,
    };
    for (const c of carts) {
      const k = (c.status ?? 'em_separacao') as CartStatus;
      if (counts[k] !== undefined) counts[k] += 1;
    }
    return counts;
  }, [carts]);

  // Contagem de vencidos (só shipping_deadline no passado) — usado no chip
  // clicável do header. Independe do statusFilter atual para refletir o total
  // absoluto que o vendedor precisa priorizar.
  const overdueCount = useMemo(
    () => carts.filter((c) => getShippingDeadlineStatus(c.shipping_deadline) === 'overdue').length,
    [carts],
  );

  const filteredCarts = useMemo(() => {
    const q = fold(debouncedQuery.trim());
    let out = carts.filter((c) => {
      const matchesStatus = statusFilter === 'all' || (c.status ?? 'em_separacao') === statusFilter;
      if (!matchesStatus) return false;
      if (!matchesDeadlineFilter(c.shipping_deadline, deadlineFilter)) return false;
      if (!q) return true;
      return fold(c.company_name ?? '').includes(q) || fold(c.company_location ?? '').includes(q);
    });
    // Prazos: null vai para o fim em asc, para o topo em desc (mais distante = sem prazo é neutro no fim).
    const FAR = Number.POSITIVE_INFINITY;
    out = [...out].sort((a, b) => {
      if (sort === 'value-desc') return cartSubtotal(b) - cartSubtotal(a);
      if (sort === 'items-desc') return b.items.length - a.items.length;
      if (sort === 'deadline-asc' || sort === 'deadline-desc') {
        const da = daysUntilDeadline(a.shipping_deadline);
        const db = daysUntilDeadline(b.shipping_deadline);
        const va = da === null ? FAR : da;
        const vb = db === null ? FAR : db;
        return sort === 'deadline-asc' ? va - vb : vb - va;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return out;
  }, [carts, debouncedQuery, statusFilter, deadlineFilter, sort]);

  const totals = useMemo(() => {
    const totalValue = filteredCarts.reduce((acc, c) => acc + cartSubtotal(c), 0);
    const totalItems = filteredCarts.reduce((acc, c) => acc + c.items.length, 0);
    return { totalValue, totalItems, count: filteredCarts.length };
  }, [filteredCarts]);

  const hasActiveFilters =
    queryInput.trim() !== '' || statusFilter !== 'all' || deadlineFilter !== 'all';


  const visibleIds = useMemo(() => filteredCarts.map((c) => c.id), [filteredCarts]);
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleRow = useCallback((cartId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cartId)) next.delete(cartId);
      else next.add(cartId);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [visibleIds]);

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('Selecione ao menos um carrinho para excluir.');
      setBulkDeleteOpen(false);
      return;
    }

    // Snapshot ANTES do DELETE — necessário para restauração fiel (Undo).
    // Preserva ordem para restaurar do 1º ao último se o usuário desfizer.
    const snapshots = ids
      .map((id) => carts.find((c) => c.id === id))
      .filter((c): c is SellerCart => Boolean(c));

    setBulkDeleteOpen(false);
    clearSelection();

    // Executa DELETEs em paralelo. Falhas individuais reportadas pela mutation.
    const results = await Promise.allSettled(ids.map((id) => deleteCart(id)));
    const deletedCount = results.filter((r) => r.status === 'fulfilled').length;
    if (deletedCount === 0) return; // toda a exclusão falhou; mutation já mostrou erro.

    const isSingular = deletedCount === 1;
    showUndoToast({
      title: deletedToastTitle(deletedCount),
      description: UNDO_TOAST_DESCRIPTION,
      duration: UNDO_DURATION_MS,
      onUndo: async () => {
        // Restaura apenas os snapshots dos carrinhos que foram efetivamente
        // excluídos (mantém ordem original).
        const successIndexes = results
          .map((r, i) => (r.status === 'fulfilled' ? i : -1))
          .filter((i) => i >= 0);
        const toRestore = successIndexes.map((i) => snapshots[i]).filter(Boolean);

        const restoreResults = await Promise.allSettled(
          toRestore.map((snap) => restoreCart(snap)),
        );
        const restoredCount = restoreResults.filter(
          (r) => r.status === 'fulfilled' && r.value !== undefined,
        ).length;

        const summary = bulkRestoreSummary(toRestore.length, restoredCount);
        if (summary.tone === 'success') toast.success(summary.message);
        else if (summary.tone === 'warning') toast.warning(summary.message);
        else toast.error(summary.message);
      },
    });
  }, [selectedIds, deleteCart, clearSelection, carts, restoreCart]);

  /**
   * Atalho: Esc sai do modo de seleção e limpa marcações.
   * Ignora quando o AlertDialog de exclusão está aberto — nesse caso o
   * Radix já trata Esc para fechar o dialog, evitando duplo fechamento.
   * Ignora também quando foco está em input/textarea/contenteditable
   * (ex.: campo de busca) para não interromper edição de texto.
   */
  useEffect(() => {
    if (!selectionMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bulkDeleteOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (target?.isContentEditable ?? false)
      ) {
        return;
      }
      e.preventDefault();
      clearSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectionMode, bulkDeleteOpen, clearSelection]);

  return (
    <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
      <TooltipProvider>
        {/* Header: título + filtros + ação no mesmo eixo (padrão Orçamentos) */}
        <div className="flex flex-wrap items-center gap-3">
          <FadeInView>
            <div className="flex-shrink-0 min-w-0">
              <h1
                data-testid="page-title-carrinhos"
                className="flex items-center gap-2 whitespace-nowrap font-display text-xl font-bold text-foreground sm:text-2xl lg:text-3xl"
              >
                <ShoppingCart aria-hidden="true" className="h-7 w-7" />
                Carrinhos
              </h1>
              <p className="mt-1 text-muted-foreground">
                <AnimatedCounter value={totals.count} /> carrinho(s) encontrado(s) ·{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.totalValue)}
                </span>
              </p>
            </div>
          </FadeInView>

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-none sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[260px] lg:w-[320px]">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Buscar por empresa…"
                aria-label="Buscar carrinhos por empresa"
                data-testid="carts-list-search"
                className="pl-9 pr-9"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => setQueryInput('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select value={deadlineFilter} onValueChange={(v) => setDeadlineFilter(v as DeadlineFilter)}>
              <SelectTrigger
                className="w-full sm:w-[190px]"
                data-testid="carts-list-deadline-filter"
                aria-label="Filtrar por prazo de envio"
              >
                <SelectValue placeholder="Prazo p/ envio" />
              </SelectTrigger>
              <SelectContent>
                {DEADLINE_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} data-testid={`carts-deadline-opt-${o.value}`}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger
                className="w-full sm:w-[190px]"
                data-testid="carts-list-sort"
                aria-label="Ordenar carrinhos"
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="carts-list-new"
                  onClick={() => setPickerOpen(true)}
                  size="icon"
                  aria-label="Criar novo carrinho"
                  className="group relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-110 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
                  />
                  <Plus className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Criar novo carrinho</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>


      {/* Toolbar: chips de status + ações de seleção */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="Filtrar por status"
          className="flex flex-wrap items-center gap-1.5"
          data-testid="carts-list-status-chips"
        >
          <StatusChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label="Todos"
            count={statusCounts.all}
            testId="carts-list-chip-all"
          />
          {(
            Object.entries(STATUS_CONFIG) as [CartStatus, (typeof STATUS_CONFIG)[CartStatus]][]
          ).map(([key, cfg]) => (
            <StatusChip
              key={key}
              active={statusFilter === key}
              onClick={() => setStatusFilter(key)}
              label={cfg.label}
              count={statusCounts[key]}
              testId={`carts-list-chip-${key}`}
            />
          ))}

          {/* Chip clicável de Vencidos — só aparece quando há algum vencido.
              Aciona o filtro de deadline (independente do status atual). */}
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => setDeadlineFilter(deadlineFilter === 'overdue' ? 'all' : 'overdue')}
              data-testid="carts-list-chip-overdue"
              aria-pressed={deadlineFilter === 'overdue'}
              aria-label={`${overdueCount} ${overdueCount === 1 ? 'carrinho vencido' : 'carrinhos vencidos'}. ${deadlineFilter === 'overdue' ? 'Remover filtro' : 'Aplicar filtro de vencidos'}.`}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                deadlineFilter === 'overdue'
                  ? 'border-destructive/60 bg-destructive/20 text-destructive'
                  : 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15',
              )}
            >
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
              Vencidos
              <span
                className={cn(
                  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  deadlineFilter === 'overdue'
                    ? 'bg-destructive/30 text-destructive'
                    : 'bg-destructive/20 text-destructive',
                )}
              >
                {overdueCount}
              </span>
            </button>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-2">

          <div
            role="group"
            aria-label="Ações de seleção de carrinhos"
            className="flex items-center gap-2"
          >
            {/* Anúncio a leitores de tela quando entra/sai do modo e quantos itens estão selecionados. */}
            <span
              className="sr-only"
              role="status"
              aria-live="polite"
              data-testid="carts-selection-live"
            >
              {selectionMode
                ? selectedCount === 0
                  ? 'Modo de seleção ativado. Nenhum carrinho selecionado. Pressione Esc para sair.'
                  : `${selectedCount} ${selectedCount === 1 ? 'carrinho selecionado' : 'carrinhos selecionados'}. Pressione Esc para sair da seleção.`
                : ''}
            </span>

            {selectionMode && selectedCount > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                data-testid="carts-bulk-delete-top"
                aria-label={`Excluir ${selectedCount} ${selectedCount === 1 ? 'carrinho selecionado' : 'carrinhos selecionados'}`}
                className="h-9 gap-1.5"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Excluir ({selectedCount})
              </Button>
            )}
            <Button
              type="button"
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleSelectionMode}
              data-testid="carts-select-toggle"
              data-selected={selectionMode ? 'true' : 'false'}
              aria-pressed={selectionMode}
              aria-keyshortcuts={selectionMode ? 'Escape' : undefined}
              title={selectionMode ? 'Cancelar seleção (Esc)' : 'Selecionar carrinhos'}
              aria-label={
                selectionMode
                  ? `Cancelar seleção${selectedCount > 0 ? ` (${selectedCount})` : ''}. Atalho: Esc`
                  : 'Selecionar carrinhos'
              }
              className="h-9 gap-1.5"
            >
              <CheckSquare aria-hidden="true" className="h-3.5 w-3.5" />
              {selectionMode
                ? selectedCount > 0
                  ? `Cancelar seleção (${selectedCount})`
                  : 'Cancelar seleção'
                : 'Selecionar'}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : carts.length === 0 ? (
        <div data-testid="carts-empty-none">
          <EmptyState
            variant="cart"
            title="Nenhum carrinho aberto"
            description="Crie um carrinho para começar a montar uma proposta para um cliente."
          >
            <Button onClick={() => setPickerOpen(true)} className="gap-2">
              <Plus aria-hidden="true" className="h-4 w-4" /> Novo carrinho
            </Button>
          </EmptyState>
        </div>
      ) : filteredCarts.length === 0 ? (
        <div data-testid="carts-empty-filtered">
          <EmptyState
            variant="cart"
            title="Nenhum carrinho encontrado"
            description="Ajuste a busca ou os filtros para ver mais carrinhos."
          >
            <Button
              data-testid="carts-list-clear-filters"
              variant="outline"
              onClick={() => clearAll()}

              disabled={!hasActiveFilters}
              className="gap-2"
            >
              <X aria-hidden="true" className="h-4 w-4" /> Limpar filtros
            </Button>
          </EmptyState>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-primary/10 hover:bg-primary/10">
                  {selectionMode && (
                    <TableHead className="w-[44px] px-3">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label={
                          allVisibleSelected
                            ? 'Desmarcar todos os carrinhos visíveis'
                            : 'Selecionar todos os carrinhos visíveis'
                        }
                        data-testid="carts-select-all"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[90px] px-4">Status</TableHead>
                  <TableHead className="w-[320px] min-w-[260px] px-4">Empresa</TableHead>
                  <TableHead className="min-w-[180px] px-4">Ramo de Atividade</TableHead>
                  <TableHead className="w-[90px] px-4 text-center">Itens</TableHead>
                  <TableHead className="w-[130px] px-4 text-right">Valor</TableHead>
                  <TableHead className="w-[140px] px-4">Prazo p/ envio</TableHead>
                  <TableHead className="w-[170px] px-4">Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCarts.map((cart) => (
                  <CartRow
                    key={cart.id}
                    cart={cart}
                    cnpj={cnpjByCompanyId.get(cart.company_id) ?? null}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(cart.id)}
                    onToggleSelect={() => toggleRow(cart.id)}
                    onOpen={() => navigate(`/carrinhos/${cart.id}`)}
                    onEdit={() => navigate(`/carrinhos/${cart.id}`)}
                    onDuplicate={() => duplicateCart(cart.id)}
                    onDelete={() => setDeleteConfirmId(cart.id)}
                    onGenerateQuote={() => handleGenerateQuote(cart)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <CartCompanyPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onCreated={(cartId) => {
          setPickerOpen(false);
          if (cartId) navigate(`/carrinhos/${cartId}`);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        variant="destructive"
        title={deleteConfirmDialogTitle(selectedCount)}
        description={deleteConfirmDialogDescription(selectedCount)}
        confirmLabel={confirmDialogConfirmLabel(selectedCount)}
        confirmLabelShort="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmBulkDelete}
        testId="carts-bulk-delete-dialog"
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        variant="destructive"
        title={deleteConfirmDialogTitle(1)}
        description={deleteConfirmDialogDescription(1)}
        confirmLabel={confirmDialogConfirmLabel(1)}
        confirmLabelShort="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          // Snapshot ANTES do DELETE para restauração fiel (Undo).
          const snapshot = carts.find((c) => c.id === deleteConfirmId);
          setDeleteConfirmId(null);
          if (!snapshot) return;
          try {
            await deleteCart(deleteConfirmId);
            showUndoToast({
              title: deletedToastTitle(1),
              description: UNDO_TOAST_DESCRIPTION,
              duration: UNDO_DURATION_MS,
              onUndo: async () => {
                // O toast de sucesso (com métricas items_total/inserted/deduped)
                // e o toast de erro (com mapping por SQLSTATE) são emitidos
                // dentro do próprio `restoreCart` — evita duplicidade aqui.
                const newId = await restoreCart(snapshot);
                return newId ? true : false;
              },
            });
          } catch {
            // Mutation já emitiu toast de erro.
          }
        }}
        testId="cart-row-delete-dialog"
      />
    </div>
  );
}

interface StatusChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  testId: string;
}

function StatusChip({ active, onClick, label, count, testId }: StatusChipProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border/40 bg-card/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
          active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

interface CartRowProps {
  cart: SellerCart;
  cnpj: string | null;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGenerateQuote: () => void;
}

function CartRow({
  cart,
  cnpj,
  selectionMode,
  isSelected,
  onToggleSelect,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onGenerateQuote,
}: CartRowProps) {
  const statusCfg = getStatusCfg(cart.status);
  const subtotal = cart.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
  const itemCount = cart.items.length;
  const updatedAt = new Date(cart.updated_at);

  const handleActivate = () => {
    if (selectionMode) onToggleSelect();
    else onOpen();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <TableRow
      role="button"
      tabIndex={0}
      aria-label={
        selectionMode
          ? `${isSelected ? 'Desmarcar' : 'Selecionar'} carrinho de ${cart.company_name}`
          : `Abrir carrinho de ${cart.company_name}`
      }
      aria-selected={selectionMode ? isSelected : undefined}
      onClick={handleActivate}
      onKeyDown={handleKey}
      data-testid={`cart-row-${cart.id}`}
      data-selected={selectionMode && isSelected ? 'true' : undefined}
      className={cn(
        'group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        selectionMode && isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      {selectionMode && (
        <TableCell className="w-[44px] px-3 align-middle" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`${isSelected ? 'Desmarcar' : 'Selecionar'} ${cart.company_name}`}
            data-testid={`cart-row-checkbox-${cart.id}`}
          />
        </TableCell>
      )}
      <TableCell className="px-4 align-middle">
        <span
          data-testid={`cart-row-status-${cart.id}`}
          className={cn(
            'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            statusCfg.color,
          )}
        >
          {statusCfg.label}
        </span>
      </TableCell>
      <TableCell className="max-w-0 px-4 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyListAvatar
            name={cart.company_name}
            logoUrl={cart.company_logo_url}
          />
          <div className="min-w-0 flex-1">
            <div
              className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
              title={cart.company_name}
            >
              {cart.company_name}
            </div>
            {cnpj && (
              <div
                className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground"
                data-testid={`cart-row-cnpj-${cart.id}`}
              >
                {maskCnpj(cnpj)}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-0 px-4 align-middle text-xs text-muted-foreground">
        {cart.company_location ? (
          <span
            className="block overflow-hidden text-ellipsis whitespace-nowrap"
            title={cart.company_location}
          >
            {cart.company_location}
          </span>
        ) : (
          <span className="opacity-60">—</span>
        )}
      </TableCell>
      <TableCell className="px-4 text-center align-middle">
        <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-bold text-primary">
          {itemCount}
        </span>
      </TableCell>
      <TableCell className="px-4 text-right align-middle font-display text-sm font-semibold tracking-tight tabular-nums">
        {formatCurrency(subtotal)}
      </TableCell>
      <TableCell className="px-4 align-middle text-xs" data-testid={`cart-row-shipping-deadline-${cart.id}`}>
        {(() => {
          if (!cart.shipping_deadline) return <span className="opacity-60">—</span>;
          const status = getShippingDeadlineStatus(cart.shipping_deadline);
          const diff = daysUntilDeadline(cart.shipping_deadline);
          const showBadge = status === 'overdue' || status === 'soon';
          const formattedDate = format(new Date(`${cart.shipping_deadline}T00:00:00`), 'dd/MM/yyyy', { locale: ptBR });
          const badgeLabel = getDeadlineLabel(status, diff);
          return (
            <div
              className="flex flex-col gap-0.5"
              role="group"
              aria-label={
                showBadge
                  ? `Prazo de envio ${formattedDate}. ${badgeLabel}.`
                  : `Prazo de envio ${formattedDate}.`
              }
            >
              <span
                className={cn(
                  'whitespace-nowrap font-medium tabular-nums',
                  // Contraste WCAG AA: shade escuro no light, claro no dark.
                  status === 'overdue' && 'text-destructive',
                  status === 'soon' && 'text-yellow-700 dark:text-yellow-300',
                  status === 'ok' && 'text-foreground',
                )}
              >
                {formattedDate}
              </span>
              {showBadge && (
                <span
                  role="status"
                  aria-label={badgeLabel}
                  data-testid={`cart-row-deadline-badge-${cart.id}`}
                  className={cn(
                    'status-chip-glow inline-flex w-fit items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    DEADLINE_BADGE_CLASSES[status],
                  )}
                >
                  {badgeLabel}
                </span>
              )}
            </div>
          );
        })()}
      </TableCell>
      <TableCell className="px-4 align-middle text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="whitespace-nowrap">
              {format(updatedAt, 'dd/MM/yyyy', { locale: ptBR })}
            </div>
            <div className="whitespace-nowrap text-[10px] opacity-70">
              {formatDistanceToNow(updatedAt, { addSuffix: true, locale: ptBR })}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  aria-label={`Mais opções para o carrinho de ${cart.company_name}`}
                  data-testid={`cart-row-more-${cart.id}`}
                >
                  <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
                data-testid={`cart-row-menu-${cart.id}`}
                className="!min-w-0 w-[6.8rem] max-w-[calc(100vw-1rem)] p-1 [&_[role=menuitem]]:whitespace-nowrap [&_[role=menuitem]]:px-1.5 [&_[role=menuitem]]:text-[0.8rem] [&_[role=menuitem]_svg]:mr-1.5 [&_[role=menuitem]_svg]:h-3.5 [&_[role=menuitem]_svg]:w-3.5"
              >
                <DropdownMenuItem
                  data-testid={`cart-row-menu-generate-quote-${cart.id}`}
                  disabled={cart.items.length === 0}
                  onClick={onGenerateQuote}
                >
                  <FileText className="mr-2 h-4 w-4" /> Orçamento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid={`cart-row-menu-edit-${cart.id}`}
                  onClick={onEdit}
                >
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid={`cart-row-menu-duplicate-${cart.id}`}
                  onClick={onDuplicate}
                >
                  <Copy className="mr-2 h-4 w-4" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid={`cart-row-menu-delete-${cart.id}`}
                  className="text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
