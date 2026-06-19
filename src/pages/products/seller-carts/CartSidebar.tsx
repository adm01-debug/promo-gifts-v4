/**
 * CartSidebar — Summary panel reorganized in 3 zones:
 * 1) Hero Pricing (subtotal grande + peso/volume)
 * 2) Ação primária (Gerar Orçamento)
 * 3) Mais ações (DropdownMenu) + Health Checklist + Outros carrinhos
 */
import { useState } from 'react';
import type { CartTemplateItem, SellerCart, Product } from '@/hooks/products';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatCurrency,
  getStatusCfg,
  SmartSuggestions,
  ActionHistoryPanel,
} from '@/components/cart/CartUtilComponents';
import { CartHealthChecklist } from '@/components/cart/CartHealthChecklist';
import { CartActionsMenu } from '@/components/cart/CartActionsMenu';
import { cn } from '@/lib/utils';
import { ArrowRight, Weight, Box, Building2, Sparkles, Trash2, Package } from 'lucide-react';
import { m as motion } from 'framer-motion';
import type { UseMutationResult } from '@tanstack/react-query';

interface CartSidebarProps {
  cart: SellerCart;
  otherCarts: SellerCart[];
  cartSubtotal: number;
  cartTotalQty: number;
  cartAge: number;
  weightVolume: { weightKg: number; volumeM3: number; volumeCm3: number } | null;
  allProducts: Product[];
  isLoadingProducts?: boolean;
  templates: Array<{
    id: string;
    name: string;
    description?: string | null;
    items: CartTemplateItem[];
    created_at?: string;
  }>;
  canCreateCart: boolean;
  onGenerateQuote: (cart: SellerCart) => void;
  onShareCart: (cartId: string) => void;
  onDuplicateCart: (cartId: string) => void;
  onExportCSV: (cart: SellerCart) => void;
  onExportPDF: (cart: SellerCart) => void;
  onSaveTemplate: (name: string, description: string) => void;
  onLoadTemplate: (items: CartTemplateItem[]) => void;
  onDeleteTemplate: UseMutationResult<void, Error, string>;
  onClear: () => void;
  onNavigate: (path: string) => void;
  onSetActiveCartId: (id: string) => void;
  onFocusNotes?: () => void;
}

export function CartSidebar({
  cart,
  otherCarts,
  cartSubtotal,
  cartTotalQty,
  cartAge,
  weightVolume,
  allProducts,
  isLoadingProducts,
  templates,
  canCreateCart,
  onGenerateQuote,
  onShareCart,
  onDuplicateCart,
  onExportCSV,
  onExportPDF,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onClear,
  onNavigate,
  onSetActiveCartId,
  onFocusNotes,
}: CartSidebarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');

  return (
    <div className="hidden space-y-4 md:block xl:sticky xl:top-20 xl:self-start">
      {/* ZONE 1 — Hero Pricing */}
      <Card className="group/hero relative space-y-5 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-background p-5 shadow-md">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-colors group-hover/hero:bg-primary/10" />

        <div className="relative z-10 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground opacity-70">
            Subtotal do Carrinho
          </p>
          <div className="flex items-baseline gap-1">
            <motion.p
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={cartSubtotal}
              className="font-display text-3xl font-black tabular-nums leading-none tracking-tight text-primary"
            >
              {formatCurrency(cartSubtotal)}
            </motion.p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3 border-t border-primary/10 pt-4 text-xs">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Package className="h-3 w-3 opacity-60" /> SKUs
            </p>
            <p className="text-sm font-bold tabular-nums">{cart.items.length}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
              Qtd. total
            </p>
            <p className="text-sm font-bold tabular-nums">{cartTotalQty.toLocaleString('pt-BR')}</p>
          </div>
          {weightVolume && weightVolume.weightKg > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Weight className="h-3 w-3 opacity-60" /> Peso
              </p>
              <p className="text-sm font-bold tabular-nums">
                {weightVolume.weightKg >= 1
                  ? `${weightVolume.weightKg.toFixed(1)}kg`
                  : `${(weightVolume.weightKg * 1000).toFixed(0)}g`}
              </p>
            </div>
          )}
          {weightVolume && weightVolume.volumeCm3 > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Box className="h-3 w-3 opacity-60" /> Volume
              </p>
              <p className="text-sm font-bold tabular-nums">
                {weightVolume.volumeM3 >= 0.001
                  ? `${weightVolume.volumeM3.toFixed(3)}m³`
                  : `${weightVolume.volumeCm3.toLocaleString('pt-BR')}cm³`}
              </p>
            </div>
          )}
        </div>

        {/* ZONE 2 — Ação primária */}
        <div className="relative z-10 pt-1">
          <Button
            data-testid="cart-checkout-cta"
            className="group/cta h-12 w-full gap-2.5 rounded-xl bg-success font-bold text-success-foreground shadow-lg shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-xl hover:shadow-success/30 active:scale-[0.98]"
            onClick={() => onGenerateQuote(cart)}
          >
            Gerar Orçamento
            <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-1" />
          </Button>
        </div>

        {/* ZONE 3 — Menu de ações secundárias */}
        <CartActionsMenu
          onShare={() => onShareCart(cart.id)}
          onDuplicate={() => onDuplicateCart(cart.id)}
          onExportCSV={() => onExportCSV(cart)}
          onExportPDF={() => onExportPDF(cart)}
          onSaveTemplate={() => setSaveOpen(true)}
          onLoadTemplate={() => setLoadOpen(true)}
          onAddProducts={() => onNavigate('/produtos')}
          onClear={onClear}
          canDuplicate={canCreateCart}
        />
      </Card>

      {/* Health Checklist (substitui o Score) */}
      <CartHealthChecklist
        cart={cart}
        cartSubtotal={cartSubtotal}
        onFocusNotes={onFocusNotes}
        onAddProducts={() => onNavigate('/produtos')}
      />

      {/* Insights compactos */}
      <Card className="space-y-3 border-border/30 p-4 shadow-sm">
        <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 fill-warning/20 text-warning" /> Inteligência de Vendas
        </h4>
        <SmartSuggestions cart={cart} allProducts={allProducts} isLoading={isLoadingProducts} />
        <ActionHistoryPanel cartId={cart.id} />
        {cartAge >= 3 && (
          <p className="rounded-lg border border-warning/10 bg-warning/5 px-2.5 py-1.5 text-[10px] text-warning">
            ⏰ Carrinho há {cartAge} dias — considere fazer follow-up!
          </p>
        )}
      </Card>

      {/* Outros carrinhos */}
      {otherCarts.length > 0 && (
        <Card className="space-y-3 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outros Carrinhos
          </h4>
          {otherCarts.map((c) => (
            <button
              key={c.id}
              onClick={() => onSetActiveCartId(c.id)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-border/30 p-2.5 text-left transition-all hover:border-border/60 hover:bg-muted/20"
            >
              {c.company_logo_url ? (
                <img
                  src={c.company_logo_url}
                  alt=""
                  className="h-8 w-8 rounded-full border border-border/50 bg-background object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{c.company_name}</p>
                <p className="text-[10px] text-muted-foreground">{c.items.length} itens</p>
              </div>
              <Badge
                variant="outline"
                className={cn('px-1.5 text-[9px]', getStatusCfg(c.status).color)}
              >
                {getStatusCfg(c.status).label}
              </Badge>
            </button>
          ))}
        </Card>
      )}

      {/* Save Template (controlled) */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Template de Carrinho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder='Ex: "Kit Onboarding"'
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
            />
            <Textarea
              placeholder="Descrição opcional..."
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              {cart.items.length} itens serão salvos no template
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!tplName.trim()}
              onClick={() => {
                onSaveTemplate(tplName.trim(), tplDesc.trim());
                setSaveOpen(false);
                setTplName('');
                setTplDesc('');
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template (controlled) */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-h-[70vh] max-w-md">
          <DialogHeader>
            <DialogTitle>Templates Salvos</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            {templates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum template salvo ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.name}</p>
                        {t.description && (
                          <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t.items.length} itens
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            onLoadTemplate(t.items);
                            setLoadOpen(false);
                          }}
                        >
                          Aplicar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => onDeleteTemplate.mutate(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
