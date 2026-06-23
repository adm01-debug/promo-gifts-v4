/**
 * CartHeaderButton - Ícone de carrinho no header com popover de resumo
 * Melhorado com skeletons de carregamento e UX de acesso rápido (Onda 10/10)
 *
 * FIX 2026-06-12: usa useSellerCartContextSafe (null-guard) para evitar
 * 26.787 crashes por contexto ausente em Suspense fallbacks / HMR.
 *
 * FIX 2026-06-14: o fallback do null-guard agora NAVEGA para /carrinhos ao
 * clicar (antes era um botão inerte que "engolia" o clique). Assim o ícone do
 * carrinho nunca fica morto, mesmo se o Provider não estiver montado acima.
 * O rodapé "Gerar Orçamento" usa handoff de pré-preenchimento (navega para
 * /orcamentos/novo com state.fromCart) em vez da RPC fn_convert_cart_to_quote
 * (removida do banco), e é protegido por guard de activeCart.
 */

import {
  ShoppingCart,
  Trash2,
  Plus,
  Building2,
  Package,
  X,
  ArrowRight,
  Eraser,
  Minus,
  Eye,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSellerCartContextSafe } from '@/contexts/SellerCartContext';
import { CartCompanyPicker } from './CartCompanyPicker';
import { PriceLabel } from './CartUtilComponents';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { showUndoToast } from '@/utils/undoToast';
import { useState, useEffect } from 'react';

export function CartHeaderButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Listen for FAB "open cart" event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-seller-cart', handler);
    return () => window.removeEventListener('open-seller-cart', handler);
  }, []);

  // Keyboard shortcut: Alt+O to toggle cart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // SAFE context hook — retorna null em vez de lançar erro quando o Provider está ausente.
  // Resolve 21.664 unhandled_error + 5.123 React_Boundary_Error em frontend_telemetry.
  const cartContext = useSellerCartContextSafe();

  // Null-guard: context temporariamente ausente (Suspense fallback, HMR, concurrent recovery,
  // ou Provider fora da árvore). Em vez de um botão inerte, o ícone NAVEGA para a página de
  // carrinhos — garante que o clique no carrinho do header nunca fique morto.
  if (!cartContext) {
    return (
      <Button
        variant="ghost"
        size="icon"
        data-testid="cart-trigger-fallback"
        className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
        aria-label="Abrir carrinhos"
        onClick={() => navigate('/carrinhos')}
      >
        <ShoppingCart aria-hidden="true" className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </Button>
    );
  }

  const {
    carts,
    activeCart,
    activeCartId,
    isLoading,
    totalItems,
    canCreateCart,
    setActiveCartId,
    deleteCart,
    removeItem,
    updateItemQuantity,
    clearCart,
    restoreItems,
  } = cartContext;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="cart-trigger"
                className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
                aria-label={
                  totalItems > 0
                    ? `Carrinho — ${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`
                    : 'Carrinho vazio'
                }
                aria-expanded={open}
              >
                <ShoppingCart aria-hidden="true" className="h-[17px] w-[17px]" strokeWidth={1.75} />
                {totalItems > 0 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground shadow-sm animate-in zoom-in-50"
                  >
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent className="border-border bg-card">
          Carrinho de Orçamentos{' '}
          <kbd className="text-tooltip ml-1.5 rounded bg-muted px-1 py-0.5 font-mono">Alt+O</kbd>
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        data-testid="cart-drawer"
        className="w-[420px] overflow-hidden rounded-xl border-border/50 p-0 shadow-xl"
        align="end"
        sideOffset={8}
        onCloseAutoFocus={() => {
          setShowPicker(false);
          setPendingDeleteId(null);
        }}
      >
        {showPicker ? (
          <div className="animate-fade-in p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">Novo Carrinho</h3>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar"
                className="h-6 w-6"
                onClick={() => setShowPicker(false)}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CartCompanyPicker
              onCreated={() => setShowPicker(false)}
              onCancel={() => setShowPicker(false)}
            />
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/5 px-4 pb-3 pt-4">
              <div className="flex items-center gap-2.5">
                <div
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 shadow-inner"
                >
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-display text-[13px] font-bold leading-tight">
                    Meus Carrinhos
                  </h3>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                      {carts.length}/3
                    </span>
                    <span className="text-[10px] text-muted-foreground opacity-30">|</span>
                    <button
                      type="button"
                      aria-label="Ver todos os carrinhos"
                      className="text-[10px] font-bold text-primary underline-offset-2 transition-colors hover:text-primary/80 hover:underline"
                      onClick={() => {
                        setOpen(false);
                        navigate('/carrinhos');
                      }}
                    >
                      Ver todos
                    </button>
                  </div>
                </div>
              </div>
              {canCreateCart && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-3 text-[11px] font-bold text-primary transition-all hover:scale-105 hover:bg-primary/10 active:scale-95"
                  onClick={() => setShowPicker(true)}
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Novo
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 2 }, (_, i) => (
                  <div
                    key={i}
                    className="animate-pulse space-y-4 rounded-xl border border-border/40 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-1/2" />
                        <Skeleton className="h-2.5 w-1/3" />
                      </div>
                    </div>
                    {i === 0 && (
                      <div className="space-y-2.5 border-t border-border/20 pt-2">
                        {Array.from({ length: 2 }, (_el, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <div className="flex-1 space-y-1.5">
                              <Skeleton className="h-2.5 w-3/4" />
                              <Skeleton className="h-2 w-1/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : carts.length === 0 ? (
              <div className="px-4 pb-5 pt-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30">
                  <Package aria-hidden="true" className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="mb-1 text-sm font-medium">Nenhum carrinho</p>
                <p className="mx-auto mb-4 max-w-[220px] text-xs text-muted-foreground">
                  Crie um carrinho vinculado a uma empresa para coletar produtos
                </p>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-lg text-xs"
                  onClick={() => setShowPicker(true)}
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Criar Carrinho
                </Button>
              </div>
            ) : (
              <>
                <ScrollArea data-testid="cart-popover-scroll" className="h-[min(60vh,440px)]">
                  <div className="space-y-2 p-3">
                    {carts.map((cart) => {
                      const isActive = cart.id === activeCartId;
                      return (
                        <div
                          key={cart.id}
                          className={cn(
                            'group rounded-xl border transition-all duration-200',
                            isActive
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border/40 hover:border-border/60 hover:bg-muted/30',
                          )}
                        >
                          {/* Cart header */}
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <button
                              type="button"
                              aria-label={`Selecionar carrinho de ${cart.company_name}`}
                              aria-pressed={isActive}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                              onClick={() => {
                                setPendingDeleteId(null);
                                setActiveCartId(cart.id);
                              }}
                            >
                              {cart.company_logo_url ? (
                                <img
                                  src={cart.company_logo_url}
                                  alt={`Logo de ${cart.company_name}`}
                                  className="h-9 w-9 flex-shrink-0 rounded-full border border-border/50 bg-background object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div
                                  className={cn(
                                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                                    isActive
                                      ? 'bg-primary/15 text-primary'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  <Building2 aria-hidden="true" className="h-4 w-4" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    'truncate text-[13px] font-semibold leading-tight',
                                    isActive && 'text-primary',
                                  )}
                                >
                                  {cart.company_name}
                                </p>
                                {cart.company_location && (
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {cart.company_location}
                                  </p>
                                )}
                              </div>
                            </button>

                            <div className="flex flex-shrink-0 items-center gap-1.5">
                              {cart.items.length > 0 && (
                                <span
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                                    isActive
                                      ? 'bg-primary/15 text-primary'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {cart.items.length} {cart.items.length === 1 ? 'item' : 'itens'}
                                </span>
                              )}
                              {/* Limpar carrinho — com undo toast */}
                              {isActive && cart.items.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={`Limpar itens do carrinho de ${cart.company_name}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const snapshot = cart.items.map((item) => ({
                                          product_id: item.product_id,
                                          product_name: item.product_name,
                                          product_sku: item.product_sku || undefined,
                                          product_image_url: item.product_image_url || undefined,
                                          product_price: item.product_price,
                                          quantity: item.quantity,
                                          color_name: item.color_name || undefined,
                                          color_hex: item.color_hex || undefined,
                                          notes: item.notes ?? undefined,
                                          sort_order: item.sort_order ?? undefined,
                                        }));
                                        try {
                                          await clearCart(cart.id);
                                          showUndoToast({
                                            title: 'Carrinho limpo',
                                            description: `${snapshot.length} ${snapshot.length === 1 ? 'item removido' : 'itens removidos'}`,
                                            onUndo: () => restoreItems(cart.id, snapshot),
                                          });
                                        } catch {
                                          // clearCart already shows its own error toast
                                        }
                                      }}
                                    >
                                      <Eraser aria-hidden="true" className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Limpar itens</TooltipContent>
                                </Tooltip>
                              )}
                              {/* Excluir carrinho — dois cliques para confirmar */}
                              {pendingDeleteId === cart.id ? (
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    aria-label={`Confirmar exclusão do carrinho de ${cart.company_name}`}
                                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-destructive transition-colors hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCart(cart.id);
                                      setPendingDeleteId(null);
                                    }}
                                  >
                                    Excluir
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Cancelar exclusão do carrinho de ${cart.company_name}`}
                                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted/60"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingDeleteId(null);
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={`Excluir carrinho de ${cart.company_name}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                                      style={{ opacity: isActive ? 1 : undefined }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDeleteId(cart.id);
                                      }}
                                    >
                                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Excluir carrinho</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>

                          {/* Items list — only for active cart */}
                          {isActive && cart.items.length > 0 && (
                            <div className="space-y-1.5 border-t border-border/30 px-3 py-2">
                              {cart.items.slice(0, 5).map((item) => (
                                <div
                                  key={item.id}
                                  className="group/item relative flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-background/60"
                                >
                                  <div className="group/img relative flex-shrink-0">
                                    {item.product_image_url ? (
                                      <img
                                        src={item.product_image_url}
                                        alt={item.product_name}
                                        className="mt-0.5 h-9 w-9 rounded-lg border border-border/30 bg-background object-contain p-0.5 transition-transform group-hover/img:scale-110"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40">
                                        <Package
                                          aria-hidden="true"
                                          className="h-3.5 w-3.5 text-muted-foreground/50"
                                        />
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/produto/${item.product_id}`);
                                        setOpen(false);
                                      }}
                                      aria-label={`Ver produto ${item.product_name}`}
                                      className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary/10 opacity-0 transition-opacity group-hover/img:opacity-100"
                                    >
                                      <Eye aria-hidden="true" className="h-3 w-3 text-primary" />
                                    </button>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <button
                                      type="button"
                                      className="line-clamp-2 min-h-0 w-full cursor-pointer text-left text-[11px] font-medium leading-tight text-foreground/90 transition-colors hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/produto/${item.product_id}`);
                                        setOpen(false);
                                      }}
                                      aria-label={`Ver produto ${item.product_name}`}
                                    >
                                      {item.product_name}
                                    </button>
                                    {item.color_name && (
                                      <div className="mt-1 flex items-center gap-1.5 opacity-80">
                                        <div
                                          className="h-2 w-2 rounded-full border border-border/40"
                                          style={{
                                            backgroundColor: item.color_hex || 'transparent',
                                          }}
                                        />
                                        <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                          {item.color_name}
                                        </span>
                                      </div>
                                    )}
                                    {/* Price + Qty stepper row */}
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <PriceLabel
                                        label="Unitário"
                                        value={item.product_price}
                                        isPrimary
                                        className="flex-row items-center gap-1.5 space-y-0 text-[10px]"
                                      />
                                      {/* Qty stepper */}
                                      <div className="flex items-center gap-0 overflow-hidden rounded-md border border-border/50">
                                        <button
                                          type="button"
                                          aria-label={
                                            item.quantity <= 1
                                              ? `Remover ${item.product_name}`
                                              : `Diminuir quantidade de ${item.product_name}`
                                          }
                                          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.quantity <= 1) {
                                              removeItem(item.id);
                                            } else {
                                              updateItemQuantity(item.id, item.quantity - 1);
                                            }
                                          }}
                                        >
                                          {item.quantity <= 1 ? (
                                            <Trash2
                                              aria-hidden="true"
                                              className="h-3 w-3 text-destructive"
                                            />
                                          ) : (
                                            <Minus aria-hidden="true" className="h-3 w-3" />
                                          )}
                                        </button>
                                        <span className="flex h-6 min-w-[28px] items-center justify-center border-x border-border/30 bg-muted/20 text-[11px] font-bold tabular-nums">
                                          {item.quantity}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`Aumentar quantidade de ${item.product_name}`}
                                          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                          disabled={item.quantity >= 999999}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.quantity >= 999999) return;
                                            updateItemQuantity(item.id, item.quantity + 1);
                                          }}
                                        >
                                          <Plus aria-hidden="true" className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Subtotal vertical for quick scanning */}
                                  <PriceLabel
                                    label="Total"
                                    value={item.product_price * item.quantity}
                                    className="min-w-[60px] items-end"
                                  />

                                  {/* Remove button */}
                                  <button
                                    type="button"
                                    aria-label={`Remover ${item.product_name} do carrinho`}
                                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/item:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeItem(item.id);
                                    }}
                                  >
                                    <X aria-hidden="true" className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              {cart.items.length > 5 && (
                                <p className="py-1 text-center text-[10px] text-muted-foreground">
                                  +{cart.items.length - 5} mais itens
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* CTA Footer with subtotal */}
                {activeCart &&
                  activeCart.items.length > 0 &&
                  (() => {
                    const subtotal = activeCart.items.reduce(
                      (sum, item) =>
                        sum + (Number(item.product_price) || 0) * (Number(item.quantity) || 0),
                      0,
                    );
                    return (
                      <div data-testid="cart-popover-footer" className="space-y-2 border-t border-border/40 p-3">
                        {/* Subtotal */}
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs text-muted-foreground">
                            Subtotal ({activeCart.items.length}{' '}
                            {activeCart.items.length === 1 ? 'item' : 'itens'})
                          </span>
                          <span className="text-sm font-bold tabular-nums text-foreground">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                        <Button
                          className="h-10 w-full gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          onClick={() => {
                            if (!activeCart) return;
                            setOpen(false);
                            // Handoff de pré-preenchimento: leva os itens do carrinho para o
                            // builder de orçamento SEM persistir nada (a RPC eager foi removida).
                            navigate('/orcamentos/novo', {
                              state: {
                                fromCart: true,
                                companyId: activeCart.company_id,
                                companyName: activeCart.company_name,
                                companyLocation: activeCart.company_location ?? null,
                                items: activeCart.items.map((item) => ({
                                  product_id: item.product_id,
                                  product_name: item.product_name,
                                  product_image_url: item.product_image_url ?? null,
                                  quantity: item.quantity,
                                  unit_price: item.product_price,
                                  color_name: item.color_name ?? null,
                                  color_hex: item.color_hex ?? null,
                                })),
                              },
                            });
                          }}
                        >
                          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                          Gerar Orçamento
                        </Button>
                      </div>
                    );
                  })()}
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
