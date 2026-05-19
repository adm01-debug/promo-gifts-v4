/**
 * CartSidebar — Summary panel reorganized in 3 zones:
 * 1) Hero Pricing (subtotal grande + peso/volume)
 * 2) Ação primária (Gerar Orçamento)
 * 3) Mais ações (DropdownMenu) + Health Checklist + Outros carrinhos
 */
import { useState } from "react";
import { type SellerCart } from "@/hooks/products";
import { type CartTemplateItem } from "@/hooks/products";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  formatCurrency, getStatusCfg, SmartSuggestions, ActionHistoryPanel,
} from "@/components/cart/CartUtilComponents";
import { CartHealthChecklist } from "@/components/cart/CartHealthChecklist";
import { CartActionsMenu } from "@/components/cart/CartActionsMenu";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Weight, Box, Building2, Sparkles, Trash2, Package,
} from "lucide-react";
import { motion } from "framer-motion";
import type { UseMutationResult } from "@tanstack/react-query";

interface CartSidebarProps {
  cart: SellerCart;
  otherCarts: SellerCart[];
  cartSubtotal: number;
  cartTotalQty: number;
  cartAge: number;
  weightVolume: { weightKg: number; volumeM3: number; volumeCm3: number } | null;
  allProducts: unknown[];
  isLoadingProducts?: boolean;
  templates: { id: string; name: string; description?: string | null; items: CartTemplateItem[]; created_at?: string }[];
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
  cart, otherCarts, cartSubtotal, cartTotalQty, cartAge, weightVolume,
  allProducts, isLoadingProducts, templates, canCreateCart,
  onGenerateQuote, onShareCart, onDuplicateCart, onExportCSV, onExportPDF,
  onSaveTemplate, onLoadTemplate, onDeleteTemplate, onClear, onNavigate, onSetActiveCartId,
  onFocusNotes,
}: CartSidebarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");

  return (
    <div className="hidden md:block xl:sticky xl:top-20 xl:self-start space-y-4">
      {/* ZONE 1 — Hero Pricing */}
      <Card className="p-5 space-y-5 border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-background relative overflow-hidden group/hero shadow-md">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover/hero:bg-primary/10 transition-colors" />
        
        <div className="space-y-1 relative z-10">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] opacity-70">Subtotal do Carrinho</p>
          <div className="flex items-baseline gap-1">
            <motion.p 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={cartSubtotal}
              className="text-3xl font-display font-black text-primary tabular-nums leading-none tracking-tight"
            >
              {formatCurrency(cartSubtotal)}
            </motion.p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs pt-4 border-t border-primary/10 relative z-10">
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium flex items-center gap-1.5"><Package className="h-3 w-3 opacity-60" /> SKUs</p>
            <p className="font-bold text-sm tabular-nums">{cart.items.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium flex items-center gap-1.5">Qtd. total</p>
            <p className="font-bold text-sm tabular-nums">{cartTotalQty.toLocaleString("pt-BR")}</p>
          </div>
          {weightVolume && weightVolume.weightKg > 0 && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium flex items-center gap-1.5"><Weight className="h-3 w-3 opacity-60" /> Peso</p>
              <p className="font-bold text-sm tabular-nums">
                {weightVolume.weightKg >= 1
                  ? `${weightVolume.weightKg.toFixed(1)}kg`
                  : `${(weightVolume.weightKg * 1000).toFixed(0)}g`}
              </p>
            </div>
          )}
          {weightVolume && weightVolume.volumeCm3 > 0 && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium flex items-center gap-1.5"><Box className="h-3 w-3 opacity-60" /> Volume</p>
              <p className="font-bold text-sm tabular-nums">
                {weightVolume.volumeM3 >= 0.001
                  ? `${weightVolume.volumeM3.toFixed(3)}m³`
                  : `${weightVolume.volumeCm3.toLocaleString("pt-BR")}cm³`}
              </p>
            </div>
          )}
        </div>

        {/* ZONE 2 — Ação primária */}
        <div className="relative z-10 pt-1">
          <Button
            data-testid="cart-checkout-cta"
            className="w-full gap-2.5 h-12 font-bold bg-success hover:bg-success/90 text-success-foreground rounded-xl shadow-lg shadow-success/20 hover:shadow-xl hover:shadow-success/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group/cta"
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
          onAddProducts={() => onNavigate("/produtos")}
          onClear={onClear}
          canDuplicate={canCreateCart}
        />
      </Card>

      {/* Health Checklist (substitui o Score) */}
      <CartHealthChecklist
        cart={cart}
        cartSubtotal={cartSubtotal}
        onFocusNotes={onFocusNotes}
        onAddProducts={() => onNavigate("/produtos")}
      />

      {/* Insights compactos */}
      <Card className="p-4 space-y-3 border-border/30 shadow-sm">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-warning fill-warning/20" /> Inteligência de Vendas
        </h4>
        <SmartSuggestions cart={cart} allProducts={allProducts} isLoading={isLoadingProducts} />
        <ActionHistoryPanel cartId={cart.id} />
        {cartAge >= 3 && (
          <p className="text-[10px] text-warning bg-warning/5 rounded-lg px-2.5 py-1.5 border border-warning/10">
            ⏰ Carrinho há {cartAge} dias — considere fazer follow-up!
          </p>
        )}
      </Card>

      {/* Outros carrinhos */}
      {otherCarts.length > 0 && (
        <Card className="p-4 space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outros Carrinhos</h4>
          {otherCarts.map(c => (
            <button
              key={c.id}
              onClick={() => onSetActiveCartId(c.id)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-border/30 hover:border-border/60 hover:bg-muted/20 transition-all text-left"
            >
              {c.company_logo_url ? (
                <img src={c.company_logo_url} alt="" className="w-8 h-8 rounded-full object-cover bg-background border border-border/50" loading="lazy" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{c.company_name}</p>
                <p className="text-[10px] text-muted-foreground">{c.items.length} itens</p>
              </div>
              <Badge variant="outline" className={cn("text-[9px] px-1.5", getStatusCfg(c.status).color)}>
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
            <Input placeholder='Ex: "Kit Onboarding"' value={tplName} onChange={(e) => setTplName(e.target.value)} />
            <Textarea placeholder="Descrição opcional..." value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} rows={2} />
            <p className="text-xs text-muted-foreground">{cart.items.length} itens serão salvos no template</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancelar</Button>
            <Button
              disabled={!tplName.trim()}
              onClick={() => {
                onSaveTemplate(tplName.trim(), tplDesc.trim());
                setSaveOpen(false); setTplName(""); setTplDesc("");
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template (controlled) */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-md max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Templates Salvos</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum template salvo ainda.</p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{t.items.length} itens</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { onLoadTemplate(t.items); setLoadOpen(false); }}>
                          Aplicar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => onDeleteTemplate.mutate(t.id)}>
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
