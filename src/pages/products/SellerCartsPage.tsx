/**
 * SellerCartsPage - Workspace de carrinhos do vendedor (Onda Excelência UX).
 * - Header compactado (Carrinhos · X · Y · R$ Z)
 * - Picker em Dialog (Recentes/Favoritas/Todas)
 * - Tabs ricas (status dot, contador colorido, +novo)
 * - Cart header fundido (status como toggle segmentado óbvio)
 * - Empty state inteligente (template / duplicar / catálogo)
 * - Notas sempre visíveis (textarea inline com debounce)
 * - Sidebar reorganizada (Hero pricing → Ação → Menu) + Health Checklist
 */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import type { ColumnCount } from '@/components/products/ColumnSelector';

import { type CartStatus } from '@/hooks/products';
import { SELLER_CART_LIMIT_REACHED_SHORT } from '@/hooks/products/useSellerCarts';
import {
  evaluateCartStatusTransition,
  EMPTY_CART_BLOCK_TITLE,
} from '@/lib/carts/status-transition-guard';
import { useAuth } from '@/contexts/AuthContext';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { CartEmptyStateSmart } from '@/components/cart/CartEmptyStateSmart';
import { SortableCartItem } from '@/components/cart/SortableCartItem';
import {
  getStatusCfg,
  STATUS_CONFIG,
  CartItemSkeleton,
  CompareCartsDialog,
  MobileSummarySheet,
  formatCurrency,
} from '@/components/cart/CartUtilComponents';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { DeleteConfirmDialog, ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Building2, Trash2, MapPin, FileText, ChevronLeft, CalendarClock, Loader2 } from 'lucide-react';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { startOfDay } from 'date-fns';
import { CartActionsMenu } from '@/pages/products/seller-carts/CartActionsMenu';
import { toast } from 'sonner';
import { useCrmCompany } from '@/hooks/crm/useCrmCompanies';
import { maskCnpj } from '@/utils/masks';
import { PageSEO } from '@/components/seo/PageSEO';
import { useSellerCartsPage } from '@/pages/products/seller-carts/useSellerCartsPage';
import { CartSidebar } from '@/pages/products/seller-carts/CartSidebar';
import { purgeOrphanCartPrefs } from '@/pages/products/seller-carts/purgeOrphanCartPrefs';
import {
  CART_VIEW_MODE_DEFAULT,
  loadCartViewMode,
  persistCartViewMode,
} from '@/pages/products/seller-carts/cartViewModePrefs';
import { emitCartViewModeEvent } from '@/pages/products/seller-carts/cartViewModeTelemetry';
import { useMidnightReset } from '@/pages/products/seller-carts/useMidnightReset';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

/**
 * Datepicker inline do prazo de envio do carrinho.
 * Delega ao `DatePickerField` compartilhado (variante compact) para manter
 * paridade visual com o design iOS Calendar do shadcn.
 *
 * Contrato preservado (testes/a11y):
 *  - id="cart-shipping-deadline"
 *  - data-testid="cart-shipping-deadline-input"
 *  - aria-invalid/aria-describedby quando há erro
 *  - value/onChange no formato ISO `YYYY-MM-DD` (null = vazio)
 */
interface ShippingDeadlinePickerProps {
  value: string | null;
  hasError: boolean;
  onChange: (value: string | null) => void;
}

function ShippingDeadlinePicker({ value, hasError, onChange }: ShippingDeadlinePickerProps) {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  return (
    <DatePickerField
      id="cart-shipping-deadline"
      data-testid="cart-shipping-deadline-input"
      variant="compact"
      aria-label="Prazo para envio"
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? 'cart-shipping-deadline-error' : undefined}
      value={value ?? ''}
      onChange={(next) => onChange(next === '' ? null : next)}
      minDate={today}
      placeholder="dd/mm/aaaa"
    />
  );
}



/**
 * Exibe o CNPJ da empresa vinculada ao carrinho ativo (busca no CRM).
 * Substitui as antigas linhas "ramo de atividade" e "atualizado há X dias".
 */
function CartCompanyCnpj({ companyId }: { companyId: string }) {
  const { data: company, isLoading } = useCrmCompany(companyId);
  // Durante o loading do CRM, ocultamos o subheader para não piscar um
  // placeholder que ainda pode virar CNPJ real. O Card mantém a altura via
  // padding + toggle de status, então nenhuma quebra de layout.
  if (isLoading) return null;

  const cnpj = company?.cnpj ? maskCnpj(company.cnpj) : null;
  const placeholder = 'CNPJ não informado';

  return (
    <div
      className="flex items-center gap-3 text-xs font-medium text-muted-foreground"
      data-testid="active-cart-meta"
    >
      <span
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap',
          cnpj ? 'font-mono' : 'italic opacity-70',
        )}
        data-testid="active-cart-cnpj"
        data-cnpj-state={cnpj ? 'present' : 'missing'}
        aria-label={cnpj ? `CNPJ ${cnpj}` : placeholder}
      >
        {cnpj ?? placeholder}
      </span>
    </div>
  );
}

/**
 * CartStatusSelect — Select compacto de status com tooltip, aria-label/aria-busy/aria-live
 * reforçados e feedback visual completo (spinner, toast de sucesso, toast de erro por
 * timeout, live-region para leitores de tela).
 *
 * Exportado para testes de integração.
 */
export function CartStatusSelect({
  currentStatus,
  onChange,
  /** Timeout (ms) para considerar a mutação falha se `currentStatus` não confirmar. */
  confirmTimeoutMs = 6000,
  /** Se o carrinho está vazio — bloqueia a transição para `pronto_orcamento`. */
  isEmpty = false,
}: {
  currentStatus: CartStatus;
  onChange: (next: CartStatus) => void;
  confirmTimeoutMs?: number;
  isEmpty?: boolean;
}) {
  const [pending, setPending] = useState<CartStatus | null>(null);
  const [liveMessage, setLiveMessage] = useState<string>('');
  // Fallback SSOT: garante que valores legados/inesperados não quebrem o render.
  const currentCfg = getStatusCfg(currentStatus);
  const displayKey = pending ?? currentStatus;
  const displayCfg = getStatusCfg(displayKey);
  const isPending = pending !== null && pending !== currentStatus;

  // Sucesso: quando o status real do carrinho alcança o valor pendente.
  useEffect(() => {
    if (pending && currentStatus === pending) {
      const label = getStatusCfg(pending).label;
      toast.success(`Status atualizado para "${label}"`);
      setLiveMessage(`Status atualizado para ${label}.`);
      setPending(null);
    }
  }, [currentStatus, pending]);

  // Falha: se depois de `confirmTimeoutMs` o status ainda não bateu, tratamos como erro.
  // Depender de `pending` (identidade do alvo) — não do boolean `isPending` — garante
  // que o timer reinicia quando o alvo muda, sem manter um timer órfão do alvo anterior.
  useEffect(() => {
    if (pending === null || pending === currentStatus) return;
    const targetLabel = getStatusCfg(pending).label;
    const timer = window.setTimeout(() => {
      setLiveMessage(`Não foi possível atualizar o status para ${targetLabel}. Tente novamente.`);
      toast.error('Não foi possível atualizar o status', {
        description: 'A mudança não foi confirmada. Verifique sua conexão e tente novamente.',
      });
      setPending(null);
    }, Math.max(0, confirmTimeoutMs));
    return () => window.clearTimeout(timer);
  }, [pending, currentStatus, confirmTimeoutMs]);

  const ariaLabel = isPending
    ? `Atualizando status do carrinho para ${getStatusCfg(pending!).label}. Aguarde.`
    : `Status atual do carrinho: ${currentCfg.label}. Clique para alterar.`;

  return (
    <>
      <Select
        value={displayKey}
        onValueChange={(next) => {
          const nextKey = next as CartStatus;
          if (nextKey === currentStatus || isPending) return;
          const decision = evaluateCartStatusTransition({
            nextStatus: nextKey,
            itemCount: isEmpty ? 0 : 1,
          });
          if (!decision.allowed) {
            toast.error(EMPTY_CART_BLOCK_TITLE, { description: decision.message });
            setLiveMessage(
              'Não é possível marcar o carrinho como pronto para orçamento: ele está vazio.',
            );
            return;
          }
          setLiveMessage(`Atualizando status para ${STATUS_CONFIG[nextKey].label}.`);
          setPending(nextKey);
          onChange(nextKey);
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger
              aria-label={ariaLabel}
              aria-busy={isPending}
              aria-disabled={isPending}
              data-testid="cart-status-select"
              data-status={displayKey}
              data-pending={isPending ? 'true' : 'false'}
              className="h-9 w-auto min-w-[128px] gap-1.5 whitespace-nowrap rounded-full border-border/50 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring/60 aria-busy:opacity-80"
            >
              {isPending ? (
                <Loader2
                  data-testid="cart-status-spinner"
                  aria-hidden="true"
                  className="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                    displayKey === 'pronto_orcamento' ? 'bg-neon-green' : 'bg-neon-blue',
                  )}
                />
              )}
              <SelectValue aria-label={displayCfg.label}>
                <span className="truncate">{displayCfg.label}</span>
              </SelectValue>
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {isPending
              ? `Atualizando para ${STATUS_CONFIG[pending!].label}…`
              : `Status atual: ${currentCfg.label}. Clique para alterar.`}
          </TooltipContent>
        </Tooltip>
        <SelectContent align="start">
          {(
            Object.entries(STATUS_CONFIG) as [
              CartStatus,
              (typeof STATUS_CONFIG)[CartStatus],
            ][]
          ).map(([key, cfg]) => {
            const disabled = key === 'pronto_orcamento' && isEmpty;
            return (
              <SelectItem
                key={key}
                value={key}
                disabled={disabled}
                className="text-xs"
                data-testid={`cart-status-option-${key}`}
                data-disabled-empty={disabled ? 'true' : undefined}
                aria-label={
                  disabled
                    ? `${cfg.label} — indisponível: adicione produtos ao carrinho primeiro`
                    : cfg.label
                }
              >
                {cfg.label}
                {disabled && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    (carrinho vazio)
                  </span>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Live region para leitores de tela — anuncia início, sucesso e falha. */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="cart-status-live"
      >
        {liveMessage}
      </span>
    </>
  );
}






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
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>(CART_VIEW_MODE_DEFAULT);
  const [gridColumns, setGridColumns] = useState<ColumnCount>(3);

  // Tabela: padding fixo confortável (colunas/densidade customizáveis removidas).
  const rowPad = 'px-3 py-2.5';

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

    // Limpeza de chaves órfãs do antigo popover "Colunas / Densidade"
    // (removido em 2026-07). Ver `purgeOrphanCartPrefs` + testes.
    purgeOrphanCartPrefs();

    // Regra: no primeiro acesso do dia (timezone local) o viewMode reseta
    // para "list"; após o usuário alterar, mantém a escolha durante o dia.
    // Emite telemetria `daily_reset` quando o reset ocorre.
    // Ver `cartViewModePrefs.ts` — SSOT com testes.
    const { viewMode: nextViewMode } = loadCartViewMode(uid, { emit: emitCartViewModeEvent });
    setViewMode(nextViewMode);

    const gc = Number(localStorage.getItem(ns('cart-grid-columns')));
    if ([3, 4, 5, 6, 8].includes(gc)) setGridColumns(gc as ColumnCount);

    const sk = localStorage.getItem(ns('cart-table-sort-key'));
    if (sk === 'name' || sk === 'price' || sk === 'total') setSortKey(sk as SortKey);

    const sd = localStorage.getItem(ns('cart-table-sort-dir'));
    if (sd === 'asc' || sd === 'desc') setSortDir(sd as SortDir);

    const ps = Number(localStorage.getItem(ns('cart-table-page-size')));
    if ([10, 25, 50, 100].includes(ps)) setPageSize(ps);
  }, [uid]);

  // Persiste preferências (com telemetria `change` on-diff) por user.
  useEffect(() => {
    if (!uid) return;
    persistCartViewMode(uid, viewMode, { emit: emitCartViewModeEvent });
  }, [viewMode, uid]);

  // Reset automático ao virar a meia-noite local — sem reload.
  useMidnightReset(
    () => {
      if (!uid) return;
      const { viewMode: reloaded } = loadCartViewMode(uid, { emit: emitCartViewModeEvent });
      setViewMode(reloaded);
    },
    { enabled: !!uid },
  );
  useEffect(() => {
    if (!uid) return;
    localStorage.setItem(`cart-grid-columns:${uid}`, String(gridColumns));
  }, [gridColumns, uid]);
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
      {/* Voltar para a lista (Tela 1) */}
      <button
        type="button"
        onClick={() => s.navigate('/carrinhos')}
        className="-mb-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" /> Voltar aos carrinhos
      </button>
      {/* Header removido por solicitação do PO (2026-07-09). */}
      {/* Botão "Novo Carrinho" acessível via Ctrl+K / picker; título via <title>. */}

      {/* Picker em Dialog */}
      {/* BUG-4 FIX: navega para /carrinhos/:id após criar, sincronizando a URL */}
      <CartCompanyPickerDialog
        open={s.showNewCart}
        onOpenChange={s.setShowNewCart}
        onCreated={(cartId) => {
          s.setShowNewCart(false);
          if (cartId) s.navigate(`/carrinhos/${cartId}`);
        }}
      />


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
        <>
        {/* Cart header fundido — sem card, direto no fundo da página */}
        <div
          data-testid="active-cart-header"
          className="group/header relative flex flex-col justify-between gap-4 py-2 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 items-center gap-4">
            {s.activeCart.company_logo_url ? (
              <img
                src={s.activeCart.company_logo_url}
                alt=""
                className="h-12 w-12 flex-shrink-0 rounded-full border border-border/40 bg-background object-cover shadow-inner transition-transform duration-300 group-hover/header:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover/header:bg-primary/20">
                <Building2 aria-hidden="true" className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2
                data-testid="active-cart-company-name"
                className="truncate font-display text-lg font-bold tracking-tight text-foreground/90"
              >
                {s.activeCart.company_name}
              </h2>
              <div className="leading-none">
                <CartCompanyCnpj companyId={s.activeCart.company_id} />
              </div>
            </div>
          </div>
          <div
            data-testid="cart-shipping-deadline-block"
            className="flex min-w-0 flex-col items-start justify-center gap-1 sm:flex-1 sm:pl-4"
          >
            <label
              htmlFor="cart-shipping-deadline"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              Prazo p/ envio
            </label>
            <div className="inline-flex flex-wrap items-center gap-1.5">
              <ShippingDeadlinePicker
                value={s.shippingDeadlineDraft ?? null}
                hasError={!!s.shippingDeadlineError}
                onChange={(v) => s.handleShippingDeadlineChange(v)}
              />

              {s.shippingDeadlineBadge && !s.shippingDeadlineError && (
                <span
                  role="status"
                  aria-label={`Status do prazo: ${s.shippingDeadlineBadge.label}`}
                  data-testid="cart-shipping-deadline-badge"
                  data-status={s.shippingDeadlineBadge.status}
                  className={cn(
                    'status-chip-glow inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    s.shippingDeadlineBadge.className,
                  )}
                >
                  {s.shippingDeadlineBadge.label}
                </span>
              )}
              {s.shippingDeadlineError && (
                <span
                  id="cart-shipping-deadline-error"
                  role="alert"
                  data-testid="cart-shipping-deadline-error"
                  className="text-[10px] font-medium text-destructive"
                >
                  {s.shippingDeadlineError}
                </span>
              )}
            </div>
          </div>
          <div
            data-testid="cart-header-actions"
            className="flex w-full flex-shrink-0 flex-wrap items-center content-end justify-end gap-1.5 sm:ml-auto sm:w-auto sm:gap-2 md:gap-2.5 lg:gap-3"
          >
            <CartStatusSelect
              currentStatus={(s.activeCart?.status ?? 'em_separacao') as CartStatus}
              isEmpty={(s.activeCart?.items.length ?? 0) === 0}
              onChange={(next) => {
                if (s.activeCart) s.updateCartStatus(s.activeCart.id, next);
              }}
            />
            <CartActionsMenu
              canGenerateQuote={s.activeCart.items.length > 0}
              onGenerateQuote={() => {
                if (s.activeCart) s.handleGenerateQuote(s.activeCart);
              }}
              onDelete={() => s.setConfirmDeleteCart(true)}
            />
            {s.activeCart.items.length > 0 && (
              <LayoutPopover
                viewMode={viewMode}
                setViewMode={setViewMode}
                gridColumns={gridColumns}
                setGridColumns={setGridColumns}
              />
            )}
          </div>
        </div>



        <div className="grid w-full grid-cols-1 gap-6">

          <div className="min-w-0 space-y-4">





            {/* Produtos */}
            {s.activeCart.items.length === 0 ? (
              <CartEmptyStateSmart
                activeCart={s.activeCart}
                otherCarts={s.otherCarts}
                onDuplicateLast={handleDuplicateLast}
                onNavigateProducts={() => s.navigate('/produtos')}
              />

            ) : (
              <>

                {viewMode === 'table' ? (
                  (() => {
                    const { sorted, start, pageItems, safePage, totalPages } = cartTableData;
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
                        <table className="w-full min-w-[720px] text-sm">
                          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                            <tr>
                              {renderSortHdr('name', 'Produto', 'left')}
                              <th scope="col" className={cn(rowPad, 'text-left font-semibold')}>
                                Cor
                              </th>
                              <th scope="col" className={cn(rowPad, 'text-right font-semibold')}>
                                Qtd
                              </th>
                              {renderSortHdr('price', 'Preço', 'right')}
                              {renderSortHdr('total', 'Total', 'right')}
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
                                        className="h-10 w-10 flex-shrink-0 rounded-md border border-border/30 object-cover"
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
                                  <td
                                    className={cn(
                                      rowPad,
                                      'text-right tabular-nums text-muted-foreground',
                                    )}
                                  >
                                    {formatCurrency(item.product_price)}
                                  </td>
                                  <td
                                    className={cn(
                                      rowPad,
                                      'text-right font-semibold tabular-nums text-foreground',
                                    )}
                                    data-testid={`cart-row-total-${item.id}`}
                                  >
                                    {formatCurrency(item.product_price * item.quantity)}
                                  </td>
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
                                      <Trash2 aria-hidden="true" className="h-4 w-4" />
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
                              variant={viewMode === 'list' ? 'row' : 'card'}
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
              cartSubtotal={s.cartSubtotal}
              cartTotalQty={s.cartTotalQty}
              weightVolume={s.weightVolume}
              templates={s.templates}
              canCreateCart={s.canCreateCart}
              onGenerateQuote={s.handleGenerateQuote}
              onShareCart={s.shareCartLink}
              onDuplicateCart={(id) => {
                if (s.canCreateCart) s.duplicateCart(id);
                else toast.error(SELLER_CART_LIMIT_REACHED_SHORT);
              }}
              onExportCSV={s.exportCartToCSV}
              onExportPDF={s.exportCartToPDF}
              onSaveTemplate={s.handleSaveTemplate}
              onLoadTemplate={s.handleLoadTemplate}
              onDeleteTemplate={s.deleteTemplate}
              onClear={() => s.setConfirmClearCart(true)}
              onNavigate={s.navigate}
              onFocusNotes={focusNotes}
            />
          )}
        </div>
        {/* Notas da negociação — rodapé full-width (Mudança 03).
            🔒 Interno: seller_carts.notes NUNCA é enviado ao cliente
            (não vai para /orcamento-publico, PDF, e-mail ou sync CRM).
            RLS: seller_id = auth.uid(). */}
        <div
          className="group/notes space-y-2 rounded-xl border border-border/30 bg-card/40 p-3.5"
          data-testid="cart-notes-internal-block"
        >
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="cart-notes"
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-opacity group-hover/notes:opacity-100"
            >
              <FileText aria-hidden="true" className="h-3.5 w-3.5 text-primary" /> Notas da negociação
            </label>
            <span
              data-testid="cart-notes-internal-badge"
              title="Estas notas são visíveis apenas para você. Não são enviadas ao cliente, ao orçamento público, ao PDF nem ao CRM."
              className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              <span aria-hidden="true">🔒</span> Interno — não visível ao cliente
            </span>
          </div>
          <Textarea
            id="cart-notes"
            ref={notesRef}
            value={s.localCartNotes}
            onChange={(e) => s.handleCartNotesChange(e.target.value)}
            placeholder={notesPlaceholder}
            aria-describedby="cart-notes-internal-hint"
            className="min-h-[88px] resize-y rounded-lg border-border/30 bg-background/50 text-sm transition-all focus:border-primary/40 focus:ring-primary/10"
            rows={3}
          />
          <p
            id="cart-notes-internal-hint"
            className="text-[10px] leading-snug text-muted-foreground/80"
          >
            Uso interno para a sua negociação. O cliente <strong>não</strong> vê este conteúdo em nenhum lugar.
          </p>
        </div>
        </>
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
            ? `O item "${pendingRemoveItem.name}" será removido — você pode desfazer por até 8 segundos após a confirmação.`
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
