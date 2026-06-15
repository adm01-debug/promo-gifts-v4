/**
 * CartsListPage — Workspace: lista de carrinhos abertos do vendedor.
 *
 * Layout em tabela (estilo Orçamentos): logo do cliente + nome, status,
 * itens, valor, data de atualização. Clique na linha → /carrinhos/:cartId.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { AvatarLogo } from '@/components/shared/AvatarLogo';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { formatCurrency, getStatusCfg } from '@/components/cart/CartUtilComponents';
import { cn } from '@/lib/utils';
import type { SellerCart } from '@/hooks/products';

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
  const { carts, isLoading, canCreateCart } = useSellerCartContext();
  const [pickerOpen, setPickerOpen] = useState(false);

  const totals = useMemo(() => {
    const totalValue = carts.reduce(
      (acc, c) => acc + c.items.reduce((s, i) => s + i.product_price * i.quantity, 0),
      0,
    );
    const totalItems = carts.reduce((acc, c) => acc + c.items.length, 0);
    return { totalValue, totalItems, count: carts.length };
  }, [carts]);

  return (
    <div className="mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            data-testid="page-title-carrinhos"
            className="font-display text-3xl font-bold tracking-tight"
          >
            Carrinhos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totals.count} {totals.count === 1 ? 'carrinho aberto' : 'carrinhos abertos'} ·{' '}
            {totals.totalItems} {totals.totalItems === 1 ? 'item' : 'itens'} ·{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(totals.totalValue)}
            </span>
          </p>
        </div>
        <Button
          onClick={() => setPickerOpen(true)}
          disabled={!canCreateCart}
          data-testid="carts-list-new"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo carrinho
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : carts.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhum carrinho aberto"
          description="Crie um carrinho para começar a montar uma proposta para um cliente."
          action={
            <Button onClick={() => setPickerOpen(true)} disabled={!canCreateCart} className="gap-2">
              <Plus className="h-4 w-4" /> Novo carrinho
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10 hover:bg-primary/10">
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="w-[120px] text-center">Itens</TableHead>
                <TableHead className="w-[160px] text-right">Valor</TableHead>
                <TableHead className="w-[200px]">Atualizado</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carts.map((cart) => (
                <CartRow
                  key={cart.id}
                  cart={cart}
                  onOpen={() => navigate(`/carrinhos/${cart.id}`)}
                />
              ))}
            </TableBody>
          </Table>
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

interface CartRowProps {
  cart: SellerCart;
  onOpen: () => void;
}

function CartRow({ cart, onOpen }: CartRowProps) {
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
      onClick={onOpen}
      onKeyDown={handleKey}
      data-testid={`cart-row-${cart.id}`}
      className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
    >
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            statusCfg.color,
          )}
        >
          {statusCfg.label}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3 min-w-0">
          <AvatarLogo
            name={cart.company_name}
            logoUrl={cart.company_logo_url}
            size="md"
            className="ring-1 ring-border"
          />
          <div className="min-w-0">
            <div className="truncate font-semibold">{cart.company_name}</div>
            {cart.company_location && (
              <div className="truncate text-xs text-muted-foreground">{cart.company_location}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-bold text-primary">
          {itemCount}
        </span>
      </TableCell>
      <TableCell className="text-right font-display font-bold">
        {formatCurrency(subtotal)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <div>{format(updatedAt, 'dd/MM/yyyy', { locale: ptBR })}</div>
        <div className="text-[10px] opacity-70">
          {formatDistanceToNow(updatedAt, { addSuffix: true, locale: ptBR })}
        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpen}
          data-testid={`cart-row-open-${cart.id}`}
          className="gap-1"
        >
          Abrir
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
