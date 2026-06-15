/**
 * CartsListPage — Workspace: lista de carrinhos abertos do vendedor.
 *
 * Grid de cards (estilo Kanban de Orçamentos): logo do cliente, status,
 * nº de itens, valor, tempo desde última atualização. Clique no card →
 * /carrinhos/:cartId (detalhe completo já existente).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, Clock, MapPin, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {carts.map((cart) => (
            <CartCard
              key={cart.id}
              cart={cart}
              onOpen={() => navigate(`/carrinhos/${cart.id}`)}
            />
          ))}
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

interface CartCardProps {
  cart: SellerCart;
  onOpen: () => void;
}

function CartCard({ cart, onOpen }: CartCardProps) {
  const statusCfg = getStatusCfg(cart.status);
  const subtotal = cart.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
  const itemCount = cart.items.length;
  const updated = formatDistanceToNow(new Date(cart.updated_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
      data-testid={`cart-card-${cart.id}`}
      className="group relative cursor-pointer overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start gap-3">
        <AvatarLogo
          name={cart.company_name}
          logoUrl={cart.company_logo_url}
          size="xl"
          className="ring-1 ring-border"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold leading-tight">{cart.company_name}</h3>
          {cart.company_location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{cart.company_location}</span>
            </p>
          )}
          <span
            className={cn(
              'mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              statusCfg.color,
            )}
          >
            {statusCfg.label}
          </span>
        </div>
        <div className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
          {itemCount}
        </div>
      </div>

      {cart.notes && (
        <p className="mt-3 line-clamp-2 flex items-start gap-1.5 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{cart.notes}</span>
        </p>
      )}

      <div className="mt-3 flex items-end justify-between border-t border-border/40 pt-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
            Valor
          </span>
          <span className="font-display text-lg font-bold leading-none">
            {formatCurrency(subtotal)}
          </span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {updated}
        </span>
      </div>
    </Card>
  );
}
