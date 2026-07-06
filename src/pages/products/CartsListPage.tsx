/**
 * CartsListPage — Workspace: lista de carrinhos abertos do vendedor.
 *
 * Layout em tabela (estilo Orçamentos): logo do cliente + nome, status,
 * itens, valor, data de atualização. Clique na linha → /carrinhos/:cartId.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ArrowRight, Search, X, CheckSquare, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSEO } from '@/components/seo/PageSEO';
import { CompanyListAvatar } from '@/components/shared/CompanyListAvatar';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { formatCurrency, getStatusCfg, STATUS_CONFIG } from '@/components/cart/CartUtilComponents';
import { cn } from '@/lib/utils';
import { maskCnpj } from '@/utils/masks';
import { useCrmCompanies } from '@/hooks/crm/useCrmCompanies';
import type { SellerCart, CartStatus } from '@/hooks/products';


type StatusFilter = CartStatus | 'all';
type SortKey = 'items-desc' | 'recent' | 'value-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Mais recente' },
  { value: 'value-desc', label: 'Maior valor' },
  { value: 'items-desc', label: 'Mais itens' },
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
  const { carts, isLoading, deleteCart } = useSellerCartContext();
  const { data: crmCompanies } = useCrmCompanies();
  const cnpjByCompanyId = useMemo(() => {
    const map = new Map<string, string>();
    (crmCompanies ?? []).forEach((c) => {
      if (c.id && c.cnpj) map.set(c.id, c.cnpj);
    });
    return map;
  }, [crmCompanies]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
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

  const filteredCarts = useMemo(() => {
    const q = fold(query.trim());
    let out = carts.filter((c) => {
      const matchesStatus = statusFilter === 'all' || (c.status ?? 'em_separacao') === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return fold(c.company_name ?? '').includes(q) || fold(c.company_location ?? '').includes(q);
    });
    out = [...out].sort((a, b) => {
      if (sort === 'value-desc') return cartSubtotal(b) - cartSubtotal(a);
      if (sort === 'items-desc') return b.items.length - a.items.length;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return out;
  }, [carts, query, statusFilter, sort]);

  const totals = useMemo(() => {
    const totalValue = filteredCarts.reduce((acc, c) => acc + cartSubtotal(c), 0);
    const totalItems = filteredCarts.reduce((acc, c) => acc + c.items.length, 0);
    return { totalValue, totalItems, count: filteredCarts.length };
  }, [filteredCarts]);

  const hasActiveFilters = query.trim() !== '' || statusFilter !== 'all';

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

  const confirmBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    ids.forEach((id) => deleteCart(id));
    toast.success(
      ids.length === 1
        ? 'Carrinho excluído.'
        : `${ids.length} carrinhos excluídos.`,
    );
    setBulkDeleteOpen(false);
    clearSelection();
  }, [selectedIds, deleteCart, clearSelection]);

  return (
    <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            data-testid="page-title-carrinhos"
            className="flex items-center gap-2 font-display text-2xl font-bold text-foreground lg:text-3xl"
          >
            <ShoppingCart aria-hidden="true" className="h-7 w-7" />
            Carrinhos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totals.count} {totals.count === 1 ? 'carrinho' : 'carrinhos'} · {totals.totalItems}{' '}
            {totals.totalItems === 1 ? 'item' : 'itens'} ·{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(totals.totalValue)}
            </span>
          </p>
        </div>
        <Button
          onClick={() => setPickerOpen(true)}
          data-testid="carts-list-new"
          aria-label="Criar novo carrinho"
          className="gap-2"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Novo carrinho
        </Button>
      </header>

      {/* Toolbar: busca + chips de status + ordenação (padrão Orçamentos) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por empresa…"
            aria-label="Buscar carrinhos por empresa"
            data-testid="carts-list-search"
            className="h-9 pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              className="h-9 w-[170px]"
              data-testid="carts-list-sort"
              aria-label="Ordenar carrinhos"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectionMode && selectedCount > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              data-testid="carts-bulk-delete-top"
              aria-label={`Excluir ${selectedCount} ${selectedCount === 1 ? 'carrinho' : 'carrinhos'}`}
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
            aria-label={
              selectionMode
                ? `Cancelar seleção${selectedCount > 0 ? ` (${selectedCount})` : ''}`
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : carts.length === 0 ? (
        <EmptyState
          variant="cart"
          title="Nenhum carrinho aberto"
          description="Crie um carrinho para começar a montar uma proposta para um cliente."
        >
          <Button onClick={() => setPickerOpen(true)} className="gap-2">
            <Plus aria-hidden="true" className="h-4 w-4" /> Novo carrinho
          </Button>
        </EmptyState>
      ) : filteredCarts.length === 0 ? (
        <EmptyState
          variant="cart"
          title="Nenhum carrinho encontrado"
          description="Ajuste a busca ou os filtros para ver mais carrinhos."
        >
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
            }}
            disabled={!hasActiveFilters}
            className="gap-2"
          >
            <X aria-hidden="true" className="h-4 w-4" /> Limpar filtros
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-primary/10 hover:bg-primary/10">
                  <TableHead className="w-[90px] px-4">Status</TableHead>
                  <TableHead className="w-[320px] min-w-[260px] px-4">Empresa</TableHead>
                  <TableHead className="min-w-[180px] px-4">Ramo de Atividade</TableHead>
                  <TableHead className="w-[90px] px-4 text-center">Itens</TableHead>
                  <TableHead className="w-[130px] px-4 text-right">Valor</TableHead>
                  <TableHead className="w-[170px] px-4">Atualizado</TableHead>
                  <TableHead className="w-[90px] px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCarts.map((cart) => (
                  <CartRow
                    key={cart.id}
                    cart={cart}
                    cnpj={cnpjByCompanyId.get(cart.company_id) ?? null}
                    onOpen={() => navigate(`/carrinhos/${cart.id}`)}
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
  onOpen: () => void;
}

function CartRow({ cart, cnpj, onOpen }: CartRowProps) {
  const statusCfg = getStatusCfg(cart.status);
  const subtotal = cart.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
  const itemCount = cart.items.length;
  const updatedAt = new Date(cart.updated_at);

  const handleKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <TableRow
      role="button"
      tabIndex={0}
      aria-label={`Abrir carrinho de ${cart.company_name}`}
      onClick={onOpen}
      onKeyDown={handleKey}
      data-testid={`cart-row-${cart.id}`}
      className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
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
              <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground">
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
      <TableCell className="px-4 align-middle text-xs text-muted-foreground">
        <div className="whitespace-nowrap">
          {format(updatedAt, 'dd/MM/yyyy', { locale: ptBR })}
        </div>
        <div className="whitespace-nowrap text-[10px] opacity-70">
          {formatDistanceToNow(updatedAt, { addSuffix: true, locale: ptBR })}
        </div>
      </TableCell>
      <TableCell className="px-4 align-middle" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpen}
          data-testid={`cart-row-open-${cart.id}`}
          className="gap-1"
        >
          Abrir
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
