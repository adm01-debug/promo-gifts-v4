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
import { useCallback, useMemo, useRef } from 'react';

import { type CartStatus, type CartTemplateItem } from '@/hooks/products';
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

export default function SellerCartsPage() {
  return (
    <>
      <PageSEO
        title="Carrinhos"
        description="Gerencie carrinhos de seleção de produtos para seus clientes."
        path="/carrinhos"
        noIndex
      />
      <SellerCartsContent />
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

  // Stable rotating placeholder per cart
  const notesPlaceholder = useMemo(() => {
    if (!s.activeCart) return NOTES_PLACEHOLDERS[0];
    const seed = s.activeCart.id.charCodeAt(0) % NOTES_PLACEHOLDERS.length;
    return NOTES_PLACEHOLDERS[seed];
  }, [s.activeCart]);

  const handleDuplicateLast = useCallback(
    (sourceCart: typeof s.activeCart) => {
      if (!sourceCart) return;
      sourceCart.items.forEach((i) => {
        // re-uses the addToActiveCart through handleLoadTemplate-like flow
        s.handleLoadTemplate([
          {
            product_id: i.product_id,
            product_name: i.product_name,
            product_sku: i.product_sku || undefined,
            product_image_url: i.product_image_url || undefined,
            product_price: i.product_price,
            quantity: i.quantity,
            color_name: i.color_name || undefined,
            color_hex: i.color_hex || undefined,
          },
        ]);
      });
    },
    [s],
  );

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
          {s.canCreateCart && (
            <Button
              onClick={() => s.setShowNewCart(true)}
              size="sm"
              className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Carrinho
            </Button>
          )}
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
              {[...Array(6)].map((_, i) => (
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
            <Card
              className="group/header relative flex flex-col justify-between gap-4 overflow-hidden border-border/40 p-4 shadow-sm sm:flex-row sm:items-center"
              style={
                s.companyAccentColor
                  ? { borderLeft: `4px solid ${s.companyAccentColor}` }
                  : undefined
              }
            >
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

            <FollowUpTimer createdAt={s.activeCart.created_at} />

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
                templates={
                  s.templates as {
                    id: string;
                    name: string;
                    description?: string;
                    items: CartTemplateItem[];
                  }[]
                }
                otherCarts={s.otherCarts}
                onApplyTemplate={s.handleLoadTemplate}
                onDuplicateLast={handleDuplicateLast}
                onNavigateProducts={() => s.navigate('/produtos')}
              />
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {s.activeCart.items.map((item, index) => (
                        <SortableCartItem
                          key={item.id}
                          item={item}
                          index={index}
                          otherCarts={s.otherCarts}
                          companyAccentColor={s.companyAccentColor}
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
          </div>

          {/* Sidebar */}
          {s.activeCart.items.length > 0 && (
            <CartSidebar
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

      {/* Mobile summary */}
      {s.activeCart && (
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
        description={`Os ${s.confirmQuoteCart?.items.length || 0} itens serão transferidos para um novo orçamento e o carrinho será removido.`}
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
    </div>
  );
}
