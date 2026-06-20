/**
 * SellerCartsPage - Workspace de carrinhos do vendedor (Onda Excelência UX).
 * - Header compactado (Carrinhos · X · Y · R$ Z)
 * - Picker em Dialog (Recentes/Favoritas/Todas)
 * - Tabs ricas (status dot, contador colorido, indicador follow-up, +novo)
 * - Cart header fundido (status como Select óbvio)
 * - Empty state inteligente (template / duplicar / catálogo)
 * - Notas sempre visíveis (textarea inline com debounce)
 * - Sidebar reorganizada (Hero pricing → Ação → Menu) + Health Checklist
 */
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import {
  CartTablePreferences,
  type CartTableColumnKey,
  type CartTableDensity,
} from '@/components/cart/CartTablePreferences';

import { type CartStatus } from '@/hooks/products';
import { useAuth } from '@/contexts/AuthContext';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { CartTabsRich } from '@/components/cart/CartTabsRich';
import { CartEmptyStateSmart } from '@/components/cart/CartEmptyStateSmart';
import { SortableCartItem } from '@/components/cart/SortableCartItem';
import {
  getStatusCfg,
  STATUS_CONFIG,
  CartItemSkeleton,
  FollowUpTimer,
  CompareCartsDialog,
  MobileSummarySheet,
  formatCurrency,
} from '@/components/cart/CartUtilComponents';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { DeleteConfirmDialog, ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { ShoppingCart, Plus, Building2, Trash2, Clock, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageSEO } from '@/components/seo/PageSEO';
import { useSellerCartsPage } from '@/pages/products/seller-carts/useSellerCartsPage';
import { CartSidebar } from '@/pages/products/seller-carts/CartSidebar';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function SellerCartsPage() {
  return (
    <>
      <PageSEO
        title="Carrinhos"
        description="Gerencie carrinhos de seleção de produtos para seus clientes."
        path="/carrinhos"
        noIndex
      />
      <ErrorBoundary>
        <SellerCartsContent />
      </ErrorBoundary>
    </>
  );
}

const NOTES_PLACEHOLDERS = [
  'Cliente quer entrega para o evento dia DD/MM...',
  'Negociar prazo 30/60/90 dias...',
  'Aprovar arte até dia X — produção começa após confirmação...',
  'Margem-alvo: XX%. Frete por conta do cliente.',
];

const DEFAULT_CART_TABLE_COLS: Record<CartTableColumnKey, boolean> = {
  color: true,
  quantity: true,
  price: true,
  total: true,
  actions: true,
} as const;

function SellerCartsContent() {
  const s = useSellerCartsPage();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const qtyDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = qtyDebounceRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const { user } = useAuth();
  const uid = user?.id ?? '';

  // View mode + grid columns (persisted, namespaced by user)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [gridColumns, setGridColumns] = useState<ColumnCount>(3);

  // Tabela: colunas visíveis + densidade (persistidos, namespaced por user)
  const [visibleColumns, setVisibleColumns] =
    useState<Record<CartTableColumnKey, boolean>>(DEFAULT_CART_TABLE_COLS);
  const [density, setDensity] = useState<CartTableDensity>('comfortable');

  // Ordenação + paginação (persistidas, namespaced por user)
  type SortKey = 'name' | 'price' | 'total';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [pageSize, setPageSize] = useState<number>(25);

  // Carrega preferências do localStorage quando o uid fica disponível
  useEffect(() => {
    if (!uid) return;
    const ns = (key: string) => `${key}:${uid}`;

    const vm = localStorage.getItem(ns('cart-view-mode'));
    if (vm === 'grid' || vm === 'list' || vm === 'table') setViewMode(vm);

    const gc = Number(localStorage.getItem(ns('cart-grid-columns')));
    if ([3, 4, 5, 6, 8].includes(gc)) setGridColumns(gc as ColumnCount);

    try {
      const raw = localStorage.getItem(ns('cart-table-columns'));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<CartTableColumnKey, boolean>>;
        setVisibleColumns({ ...DEFAULT_CART_TABLE_COLS, ...parsed, quantity: true, actions: true });
      }
    } catch {
      /* ignore corrupt stored value */
    }

    const dn = localStorage.getItem(ns('cart-table-density'));
    if (dn === 'comfortable' || dn === 'compact') setDensity(dn as CartTableDensity);

    const sk = localStorage.getItem(ns('cart-table-sort-key'));
    if (sk === 'name' || sk === 'price' || sk === 'total') setSortKey(sk as SortKey);

    const sd = localStorage.getItem(ns('cart-table-sort-dir'));
    if (sd === 'asc' || sd === 'desc') setSortDir(sd as SortDir);

    const ps = Number(localStorage.getItem(ns('cart-table-page-size')));
    if ([10, 25, 50, 100].includes(ps)) setPageSize(ps);
  }, [uid]);

  // Persiste preferências com chave namespaced por user
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-view-mode:${uid}`, viewMode);
  }, [viewMode, uid]);
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-grid-columns:${uid}`, String(gridColumns));
  }, [gridColumns, uid]);
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-table-columns:${uid}`, JSON.stringify(visibleColumns));
  }, [visibleColumns, uid]);
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-table-density:${uid}`, density);
  }, [density, uid]);
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-table-sort-key:${uid}`, sortKey);
  }, [sortKey, uid]);
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-table-sort-dir:${uid}`, sortDir);
  }, [sortDir, uid]);
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-table-page-size:${uid}`, String(pageSize));
  }, [pageSize, uid]);

  const [page, setPage] = useState(1);
  // Reset to page 1 whenever the active cart changes so the user doesn't land
  // on a page that doesn't exist in the new cart's item count.
  useEffect(() => {
    setPage(1);
  }, [s.activeCartId]);
  useEffect(() => {
    localStorage.setItem('cart-table-sort-key', sortKey);
  }, [sortKey]);
  useEffect(() => {
    localStorage.setItem('cart-table-sort-dir', sortDir);
  }, [sortDir]);
  useEffect(() => {
    localStorage.setItem('cart-table-page-size', String(pageSize));
  }, [pageSize]);
  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
    setPage(1);
  }, []);

  // Erros inline por linha (qty) — impedem persistir valor inválido
  const [qtyErrors, setQtyErrors] = useState<Record<string, string>>({});
  const setRowError = useCallback((id: string, msg: string | null) => {
    setQtyErrors((prev) => {
      const next = { ...prev };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });
  }, []);

  // Confirmação de remoção de item (tabela) — otimista; hook já oferece desfazer
  const [pendingRemoveItem, setPendingRemoveItem] = useState<{ id: string; name: string } | null>(
    null,
  );
  const confirmRemoveItem = useCallback(() => {
    if (!pendingRemoveItem) return;
    try {
      s.handleRemoveItem(pendingRemoveItem.id, pendingRemoveItem.name);
    } catch {
      toast.error('Não foi possível remover o item. Tente novamente.');
    } finally {
      setPendingRemoveItem(null);
    }
  }, [pendingRemoveItem, s]);

  // Validação + feedback inline ao alterar qtd
  const safeUpdateQuantity = useCallback(
    (itemId: string, rawValue: string, productName: string) => {
      const trimmed = rawValue.trim();
      if (trimmed === '') {
        setRowError(itemId, 'Informe uma quantidade.');
        return;
      }
      const raw = Number(trimmed);
      if (!Number.isFinite(raw) || Number.isNaN(raw)) {
        setRowError(itemId, 'Valor numérico inválido.');
        return;
      }
      if (raw < 0) {
        setRowError(itemId, 'Não use valores negativos.');
        return;
      }
      if (raw < 1) {
        setRowError(itemId, 'Mínimo 1 unidade.');
        return;
      }
      if (!Number.isInteger(raw)) {
        setRowError(itemId, 'Use apenas números inteiros.');
        return;
      }
      const qty = raw;
      if (qty > 999999) {
        setRowError(itemId, 'Máximo 999.999.');
        toast.warning(`Quantidade máxima para "${productName}" é 999.999.`);
        const prev = qtyDebounceRef.current.get(itemId);
        if (prev) clearTimeout(prev);
        qtyDebounceRef.current.set(
          itemId,
          setTimeout(() => {
            s.handleUpdateQuantity(itemId, 999999);
            qtyDebounceRef.current.delete(itemId);
          }, 400),
        );
        return;
      }
      setRowError(itemId, null);
      const prev = qtyDebounceRef.current.get(itemId);
      if (prev) clearTimeout(prev);
      qtyDebounceRef.current.set(
        itemId,
        setTimeout(() => {
          s.handleUpdateQuantity(itemId, qty);
          qtyDebounceRef.current.delete(itemId);
        }, 400),
      );
    },
    [s, setRowError],
  );

  const gridColsClass = useMemo(() => {
    if (viewMode !== 'grid') return 'grid-cols-1';
    const map: Record<ColumnCount, string> = {
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6',
      8: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8',
    };
    return map[gridColumns];
  }, [viewMode, gridColumns]);

  const focusNotes = useCallback(() => {
    notesRef.current?.focus();
    notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const aggregateTotal = useMemo(
    () =>
      s.carts.reduce(
        (sum, c) => sum + c.items.reduce((a, i) => a + i.product_price * i.quantity, 0),
        0,
      ),
    [s.carts],
  );

  // Stable rotating placeholder per cart — deps reduzida ao ID para evitar
  // recálculo quando outros campos do activeCart mudam (ex: notes, status).
  const activeCartId = s.activeCart?.id;
  const notesPlaceholder = useMemo(() => {
    if (!activeCartId) return NOTES_PLACEHOLDERS[0];
    const seed = activeCartId.charCodeAt(0) % NOTES_PLACEHOLDERS.length;
    return NOTES_PLACEHOLDERS[seed];
  }, [activeCartId]);

  const handleDuplicateLast = useCallback(
    (sourceCart: typeof s.activeCart) => {
      if (!sourceCart) return;
      // Aplica todos os itens de uma vez (handleLoadTemplate já é silencioso por
      // item e emite um único toast) — antes era 1 chamada por item, gerando N toasts.
      s.handleLoadTemplate(
        sourceCart.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          product_sku: i.product_sku || undefined,
          product_image_url: i.product_image_url || undefined,
          product_price: i.product_price,
          quantity: i.quantity,
          color_name: i.color_name || undefined,
          color_hex: i.color_hex || undefined,
        })),
      );
    },
    [s],
  );

  const cartTableData = useMemo(() => {
    const items = s.activeCart?.items ?? [];
    const sorted = [...items].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.product_name.localeCompare(b.product_name, 'pt-BR') * dir;
      if (sortKey === 'price') return (a.product_price - b.product_price) * dir;
      const ta = a.product_price * a.quantity;
      const tb = b.product_price * b.quantity;
      return (ta - tb) * dir;
    });
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const pageItems = sorted.slice(start, start + pageSize);
    return { sorted, totalPages, safePage, start, pageItems };
  }, [s.activeCart?.items, sortKey, sortDir, page, pageSize]);

  return (
    <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
      {/* Header compactado */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingCart className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1
              data-testid="page-title-carrinhos"
              className="font-display text-xl font-bold leading-tight text-foreground lg:text-2xl"
            >
              Carrinhos
            </h1>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="tabular-nums">{s.carts.length}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="tabular-nums">{s.totalItems} itens</span>
              {aggregateTotal > 0 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-medium tabular-nums text-foreground/80">
                    {formatCurrency(aggregateTotal)}
                  </span>
                </>
              )}
              <span
                className="ml-2 hidden items-center gap-1 text-muted-foreground/50 sm:inline-flex"
                title="Buscar produtos"
              >
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl+K</kbd>
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {s.carts.length >= 2 && <CompareCartsDialog carts={s.carts} />}
          <Button
            onClick={() => s.setShowNewCart(true)}
            disabled={!s.canCreateCart}
            size="sm"
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed"
            title={
              !s.canCreateCart
                ? 'Limite de 3 carrinhos atingido. Exclua um carrinho para criar outro.'
                : undefined
            }
          >
            <Plus className="h-3.5 w-3.5" /> Novo Carrinho
          </Button>
        </div>
      </header>

      {/* Picker em Dialog */}
      <CartCompanyPickerDialog
        open={s.showNewCart}
        onOpenChange={s.setShowNewCart}
        onCreated={() => s.setShowNewCart(false)}
      />

      {/* Tabs ricas */}
      {s.carts.length > 0 && (
        <CartTabsRich
          carts={s.carts}
          activeCartId={s.activeCartId}
          canCreateCart={s.canCreateCart}
          onSelect={s.setActiveCartId}
          onNew={() => s.setShowNewCart(true)}
          isLoading={s.isLoading}
        />
      )}

      {/* Conteúdo */}
      {s.isLoading ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="flex animate-pulse flex-col justify-between gap-3 rounded-xl border border-border/20 bg-card/40 p-3.5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl opacity-30" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32 opacity-20" />
                  <Skeleton className="h-3 w-48 opacity-10" />
                </div>
              </div>
              <Skeleton className="h-8 w-32 rounded-lg opacity-20" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <CartItemSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className="animate-pulse space-y-4">
            <Skeleton className="h-[400px] w-full rounded-xl opacity-20" />
            <Skeleton className="h-[200px] w-full rounded-xl opacity-10" />
          </div>
        </div>
      ) : s.carts.length === 0 ? (
        <EmptyState
          variant="cart"
          title="Monte o carrinho perfeito para seu cliente"
          description="Crie carrinhos vinculados a empresas, adicione produtos do catálogo e gere orçamentos profissionais em segundos."
          action={{ label: 'Criar Primeiro Carrinho', onClick: () => s.setShowNewCart(true) }}
        />
      ) : s.activeCart ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {/* Cart header fundido (status Select óbvio + ações inline) */}
            <Card className="group/header relative flex flex-col justify-between gap-4 overflow-hidden border-border/40 p-4 shadow-sm sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative">
                  {s.activeCart.company_logo_url ? (
                    <img
                      src={s.activeCart.company_logo_url}
                      alt=""
                      className="h-12 w-12 flex-shrink-0 rounded-full border border-border/40 bg-background object-cover shadow-inner transition-transform duration-300 group-hover/header:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover/header:bg-primary/20">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background',
                      getStatusCfg(s.activeCart.status).color.split(' ')[0],
                    )}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="truncate font-display text-lg font-bold tracking-tight text-foreground/90">
                    {s.activeCart.company_name}
                  </h2>
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    {s.activeCart.company_location && (
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3 w-3 opacity-60" />
                        {s.activeCart.company_location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="h-3 w-3 opacity-60" />
                      Atualizado{' '}
                      {formatDistanceToNow(new Date(s.activeCart.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2.5">
                <Select
                  value={s.activeCart.status}
                  onValueChange={(v) =>
                    s.activeCart && s.updateCartStatus(s.activeCart.id, v as CartStatus)
                  }
                >
                  <SelectTrigger className="h-9 w-auto min-w-[170px] gap-2 rounded-xl border-border/40 bg-muted/20 text-xs font-bold transition-all hover:bg-muted/40">
                    <span
                      className={cn(
                        'inline-block h-2 w-2 rounded-full shadow-sm ring-2 ring-background',
                        getStatusCfg(s.activeCart.status).color.split(' ')[0],
                      )}
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl p-1">
                    {(
                      Object.entries(STATUS_CONFIG) as [
                        CartStatus,
                        (typeof STATUS_CONFIG)[CartStatus],
                      ][]
                    ).map(([key, cfg]) => (
                      <SelectItem key={key} value={key} className="rounded-lg py-2">
                        <span className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full shadow-sm',
                              cfg.color.split(' ')[0],
                            )}
                          />
                          <span className="font-medium">{cfg.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 rounded-xl px-3 text-xs font-bold text-destructive transition-all hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => s.setConfirmDeleteCart(true)}
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </Card>

            <FollowUpTimer createdAt={s.activeCart.created_at} status={s.activeCart.status} />

            {/* Notas sempre visíveis */}
            <div className="group/notes space-y-2 rounded-xl border border-border/30 bg-card/40 p-3">
              <label
                htmlFor="cart-notes"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70 transition-opacity group-hover/notes:opacity-100"
              >
                <FileText className="h-3 w-3 text-primary" /> Notas da negociação
              </label>
              <Textarea
                id="cart-notes"
                ref={notesRef}
                value={s.localCartNotes}
                onChange={(e) => s.handleCartNotesChange(e.target.value)}
                placeholder={notesPlaceholder}
                className="min-h-[90px] resize-y rounded-lg border-border/30 bg-background/50 text-sm transition-all focus:border-primary/40 focus:ring-primary/10"
                rows={3}
              />
            </div>

            {/* Produtos */}
            {s.activeCart.items.length === 0 ? (
              <CartEmptyStateSmart
                activeCart={s.activeCart}
                templates={s.templates.map(({ id, name, description, items }) => ({
                  id,
                  name,
                  description: description ?? undefined,
                  items,
                }))}
                otherCarts={s.otherCarts}
                onApplyTemplate={s.handleLoadTemplate}
                onDuplicateLast={handleDuplicateLast}
                onNavigateProducts={() => s.navigate('/produtos')}
              />
            ) : (
              <>
                {/* Toolbar de visualização */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.activeCart.items.length} {s.activeCart.items.length === 1 ? 'item' : 'itens'}
                  </span>
                  <div className="flex items-center gap-2">
                    {viewMode === 'table' && (
                      <CartTablePreferences
                        visibleColumns={visibleColumns}
                        setVisibleColumns={setVisibleColumns}
                        density={density}
                        setDensity={setDensity}
                      />
                    )}
                    <LayoutPopover
                      viewMode={viewMode}
                      setViewMode={setViewMode}
                      gridColumns={gridColumns}
                      setGridColumns={setGridColumns}
                    />
                  </div>
                </div>

                {viewMode === 'table' ? (
                  (() => {
                    const { sorted, start, pageItems, safePage, totalPages } = cartTableData;
                    const rowPad = density === 'compact' ? 'px-2 py-1' : 'px-3 py-2.5';
                    const renderSortHdr = (
                      key: SortKey,
                      label: string,
                      align: 'left' | 'right',
                    ) => (
                      // aria-sort on <th> + scope="col" (WCAG 1.3.1)
                      <th
                        scope="col"
                        aria-sort={
                          sortKey === key
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className={cn(
                          rowPad,
                          align === 'right' ? 'text-right' : 'text-left',
                          'font-semibold',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          aria-label={`Ordenar por ${label}${sortKey === key ? `, ${sortDir === 'asc' ? 'decrescente' : 'crescente'}` : ''}`}
                          className="inline-flex items-center gap-1 hover:text-primary"
                          data-testid={`cart-sort-${key}`}
                        >
                          {label}
                          <span className="text-[10px] opacity-70" aria-hidden="true">
                            {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                    );
                    return (
                      <div
                        className="overflow-x-auto rounded-xl border border-border/40 bg-card/40"
                        data-testid="cart-table"
                      >
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                            <tr>
                              {renderSortHdr('name', 'Produto', 'left')}
                              {visibleColumns.color && (
                                <th scope="col" className={cn(rowPad, 'text-left font-semibold')}>
                                  Cor
                                </th>
                              )}
                              <th scope="col" className={cn(rowPad, 'text-right font-semibold')}>
                                Qtd
                              </th>
                              {visibleColumns.price && renderSortHdr('price', 'Preço', 'right')}
                              {visibleColumns.total && renderSortHdr('total', 'Total', 'right')}
                              <th scope="col" className={cn(rowPad, 'text-right font-semibold')}>
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageItems.map((item) => {
                              const err = qtyErrors[item.id];
                              return (
                                <tr
                                  key={item.id}
                                  data-testid={`cart-row-${item.id}`}
                                  className="border-t border-border/30 transition-colors hover:bg-muted/20"
                                >
                                  <td className={rowPad}>
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={item.product_image_url || '/placeholder.svg'}
                                        alt=""
                                        className={cn(
                                          'flex-shrink-0 rounded-md border border-border/30 object-cover',
                                          density === 'compact' ? 'h-8 w-8' : 'h-10 w-10',
                                        )}
                                        loading="lazy"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => s.navigate(`/produto/${item.product_id}`)}
                                        className="line-clamp-2 text-left font-medium text-foreground hover:text-primary"
                                      >
                                        {item.product_name}
                                      </button>
                                    </div>
                                  </td>
                                  {visibleColumns.color && (
                                    <td className={rowPad}>
                                      {item.color_name ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                          {item.color_hex && (
                                            <span
                                              className="inline-block h-3 w-3 rounded-full border border-border/40"
                                              style={{ background: item.color_hex }}
                                            />
                                          )}
                                          {item.color_name}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground/60">—</span>
                                      )}
                                    </td>
                                  )}
                                  <td className={cn(rowPad, 'text-right align-top')}>
                                    <input
                                      type="number"
                                      min={1}
                                      max={999999}
                                      step={1}
                                      defaultValue={item.quantity}
                                      key={`${item.id}-${item.quantity}`}
                                      aria-label={`Quantidade de ${item.product_name}`}
                                      data-testid={`cart-qty-input-${item.id}`}
                                      aria-invalid={err ? true : undefined}
                                      aria-describedby={err ? `qty-err-${item.id}` : undefined}
                                      onChange={(e) =>
                                        safeUpdateQuantity(
                                          item.id,
                                          e.target.value,
                                          item.product_name,
                                        )
                                      }
                                      onBlur={(e) => {
                                        // Se valor inválido permaneceu, restaura ao último válido (não persiste lixo)
                                        if (qtyErrors[item.id]) {
                                          e.target.value = String(item.quantity);
                                          setRowError(item.id, null);
                                        }
                                      }}
                                      className={cn(
                                        'h-8 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums focus:outline-none',
                                        err
                                          ? 'border-destructive ring-1 ring-destructive/30 focus:border-destructive'
                                          : 'border-border/40 focus:border-primary/40',
                                      )}
                                    />
                                    {err && (
                                      <p
                                        id={`qty-err-${item.id}`}
                                        role="alert"
                                        data-testid={`cart-qty-error-${item.id}`}
                                        className="mt-1 text-[10px] font-medium text-destructive"
                                      >
                                        {err}
                                      </p>
                                    )}
                                  </td>
                                  {visibleColumns.price && (
                                    <td
                                      className={cn(
                                        rowPad,
                                        'text-right tabular-nums text-muted-foreground',
                                      )}
                                    >
                                      {formatCurrency(item.product_price)}
                                    </td>
                                  )}
                                  {visibleColumns.total && (
                                    <td
                                      className={cn(
                                        rowPad,
                                        'text-right font-semibold tabular-nums text-foreground',
                                      )}
                                      data-testid={`cart-row-total-${item.id}`}
                                    >
                                      {formatCurrency(item.product_price * item.quantity)}
                                    </td>
                                  )}
                                  <td className={cn(rowPad, 'text-right')}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() =>
                                        setPendingRemoveItem({
                                          id: item.id,
                                          name: item.product_name,
                                        })
                                      }
                                      aria-label="Remover item"
                                      data-testid={`cart-remove-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {/* Paginação */}
                        <div
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                          data-testid="cart-table-pagination"
                        >
                          <span>
                            {sorted.length === 0
                              ? '0 itens'
                              : `${start + 1}–${Math.min(start + pageSize, sorted.length)} de ${sorted.length}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1">
                              <span>Por página:</span>
                              <select
                                value={pageSize}
                                onChange={(e) => {
                                  setPageSize(Number(e.target.value));
                                  setPage(1);
                                }}
                                data-testid="cart-page-size"
                                className="h-7 rounded-md border border-border/40 bg-background px-1.5"
                              >
                                {[10, 25, 50, 100].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={safePage <= 1}
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              aria-label="Página anterior"
                              data-testid="cart-page-prev"
                            >
                              ‹
                            </Button>
                            <span className="tabular-nums" aria-live="polite" aria-atomic>
                              {safePage} / {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={safePage >= totalPages}
                              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                              aria-label="Próxima página"
                              data-testid="cart-page-next"
                            >
                              ›
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <DndContext
                    sensors={s.sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={s.handleDragEnd}
                  >
                    <SortableContext
                      items={s.activeCart.items.map((i) => i.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className={cn('grid gap-4', gridColsClass)}>
                        <AnimatePresence>
                          {s.activeCart.items.map((item, index) => (
                            <SortableCartItem
                              key={item.id}
                              item={item}
                              index={index}
                              otherCarts={s.otherCarts}
                              stockMap={s.stockMap}
                              onRemove={s.handleRemoveItem}
                              onUpdateQuantity={s.handleUpdateQuantity}
                              onUpdateNotes={s.updateItemNotes}
                              onMoveToCart={s.handleMoveItem}
                              onDuplicateToCart={s.handleDuplicateItem}
                              onNavigate={s.navigate}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          {s.activeCart.items.length > 0 && (
            <CartSidebar
              key={s.activeCart.id}
              cart={s.activeCart}
              otherCarts={s.otherCarts}
              cartSubtotal={s.cartSubtotal}
              cartTotalQty={s.cartTotalQty}
              cartAge={s.cartAge}
              weightVolume={s.weightVolume}
              allProducts={s.allProducts}
              isLoadingProducts={s.isLoadingProducts}
              templates={s.templates}
              canCreateCart={s.canCreateCart}
              onGenerateQuote={s.handleGenerateQuote}
              onShareCart={s.shareCartLink}
              onDuplicateCart={(id) => {
                if (s.canCreateCart) s.duplicateCart(id);
                else toast.error('Limite de 3 carrinhos atingido');
              }}
              onExportCSV={s.exportCartToCSV}
              onExportPDF={s.exportCartToPDF}
              onSaveTemplate={s.handleSaveTemplate}
              onLoadTemplate={s.handleLoadTemplate}
              onDeleteTemplate={s.deleteTemplate}
              onClear={() => s.setConfirmClearCart(true)}
              onNavigate={s.navigate}
              onSetActiveCartId={s.setActiveCartId}
              onFocusNotes={focusNotes}
            />
          )}
        </div>
      ) : null}

      {/* Mobile summary — só mostra quando há itens para gerar orçamento */}
      {s.activeCart && s.activeCart.items.length > 0 && (
        <MobileSummarySheet
          cart={s.activeCart}
          subtotal={s.cartSubtotal}
          totalQty={s.cartTotalQty}
          onGenerateQuote={() => s.activeCart && s.handleGenerateQuote(s.activeCart)}
        />
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={!!s.confirmQuoteCart}
        onOpenChange={(open) => {
          if (!open) s.setConfirmQuoteCart(null);
        }}
        variant="warning"
        title={`Gerar orçamento para ${s.confirmQuoteCart?.company_name}?`}
        description={`Os ${s.confirmQuoteCart?.items.length || 0} itens serão levados para um novo orçamento. O carrinho permanece salvo para você continuar ajustando.`}
        confirmLabel="Gerar Orçamento"
        cancelLabel="Cancelar"
        onConfirm={s.confirmGenerateQuote}
        testId="cart-confirm-dialog"
      />
      <DeleteConfirmDialog
        open={s.confirmDeleteCart}
        onOpenChange={s.setConfirmDeleteCart}
        entityName="carrinho"
        itemName={s.activeCart?.company_name}
        onConfirm={() => {
          if (s.activeCart) s.deleteCart(s.activeCart.id);
          s.setConfirmDeleteCart(false);
        }}
        testId="cart-delete-dialog"
      />
      <ConfirmDialog
        open={s.confirmClearCart}
        onOpenChange={s.setConfirmClearCart}
        variant="warning"
        title="Limpar todos os itens?"
        description={`${s.activeCart?.items.length || 0} itens serão removidos do carrinho de ${s.activeCart?.company_name}.`}
        confirmLabel="Limpar"
        cancelLabel="Cancelar"
        onConfirm={s.handleClearCart}
        testId="cart-clear-dialog"
      />
      <ConfirmDialog
        open={!!pendingRemoveItem}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveItem(null);
        }}
        variant="destructive"
        title="Remover item do carrinho?"
        description={
          pendingRemoveItem
            ? `O item "${pendingRemoveItem.name}" será removido. Você poderá desfazer pelo toast.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onConfirm={confirmRemoveItem}
        testId="cart-remove-item-dialog"
      />
    </div>
  );
}
