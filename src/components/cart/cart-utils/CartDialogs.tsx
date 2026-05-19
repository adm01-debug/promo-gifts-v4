/**
 * Cart dialog components — Save/Load templates, Compare
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Building2, Package, Trash2, Save, BookTemplate, Columns,
} from "lucide-react";
import { type CartTemplateItem, type SellerCart } from "@/hooks/products";
import { formatCurrency, getStatusCfg } from "../CartUtilComponents";

export function CompareCartsDialog({ carts }: { carts: SellerCart[] }) {
  if (carts.length < 2) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Columns className="h-3.5 w-3.5" />
          Comparar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Comparar Carrinhos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className={cn("grid gap-4", carts.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {carts.map(cart => {
              const subtotal = cart.items.reduce((s, i) => s + i.product_price * i.quantity, 0);
              const totalQty = cart.items.reduce((s, i) => s + i.quantity, 0);
              const statusCfg = getStatusCfg(cart.status);
              return (
                <Card key={cart.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {cart.company_logo_url ? (
                      <img src={cart.company_logo_url} alt="Logo da empresa" className="w-8 h-8 rounded-full object-cover bg-background border border-border/50" loading="lazy" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{cart.company_name}</p>
                      <Badge variant="outline" className={cn("text-[9px]", statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SKUs</span>
                      <span className="font-medium">{cart.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Qtd total</span>
                      <span className="font-medium">{totalQty.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/30 pt-1.5">
                      <span className="font-medium">Subtotal</span>
                      <span className="font-bold text-primary">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {cart.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg bg-muted/30">
                        {item.product_image_url ? (
                          <img src={item.product_image_url} alt="Produto" className="w-8 h-8 rounded object-contain bg-background" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Package className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{item.product_name}</p>
                          <p className="text-muted-foreground">{item.quantity}x {formatCurrency(item.product_price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function SaveTemplateDialog({ cart, onSave }: { cart: SellerCart; onSave: (name: string, desc: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 w-full">
          <Save className="h-3.5 w-3.5" />
          Salvar como Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Template de Carrinho</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder='Ex: "Kit Onboarding"' value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Descrição opcional..." value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          <p className="text-xs text-muted-foreground">{cart.items.length} itens serão salvos no template</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave(name.trim(), desc.trim());
              setOpen(false);
              setName("");
              setDesc("");
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoadTemplateDialog({
  templates,
  onLoad,
  onDelete,
}: {
  templates: { id: string; name: string; description: string | null; items: CartTemplateItem[]; created_at: string }[];
  onLoad: (items: CartTemplateItem[]) => void;
  onDelete: (id: string) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 w-full">
          <BookTemplate className="h-3.5 w-3.5" />
          Usar Template ({templates.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>Templates Salvos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2">
            {templates.map(t => (
              <Card key={t.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{t.items.length} itens</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onLoad(t.items)}>
                      Aplicar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => onDelete(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
