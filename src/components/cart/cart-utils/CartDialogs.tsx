/**
 * Cart dialog components — Save/Load templates, Compare
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Building2, Package, Trash2, Save, BookTemplate, Columns } from 'lucide-react';
import { type CartTemplateItem, type SellerCart } from '@/hooks/products';
import { formatCurrency, getStatusCfg } from '../CartUtilComponents';

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
      <DialogContent className="max-h-[80vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Comparar Carrinhos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className={cn('grid gap-4', carts.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {carts.map((cart) => {
              const subtotal = cart.items.reduce(
                (s, i) => s + (Number(i.product_price) || 0) * (Number(i.quantity) || 0),
                0,
              );
              const totalQty = cart.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
              const statusCfg = getStatusCfg(cart.status);
              return (
                <Card key={cart.id} className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    {cart.company_logo_url ? (
                      <img
                        src={cart.company_logo_url}
                        alt={`Logo de ${cart.company_name}`}
                        className="h-8 w-8 rounded-full border border-border/50 bg-background object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{cart.company_name}</p>
                      <Badge variant="outline" className={cn('text-[9px]', statusCfg.color)}>
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
                      <span className="font-medium">{totalQty.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/30 pt-1.5">
                      <span className="font-medium">Subtotal</span>
                      <span className="font-bold text-primary">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {cart.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg bg-muted/30 p-1.5 text-xs"
                      >
                        {item.product_image_url ? (
                          <img
                            src={item.product_image_url}
                            alt={item.product_name}
                            className="h-8 w-8 rounded bg-background object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                            <Package className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.product_name}</p>
                          <p className="text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.product_price)}
                          </p>
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

export function SaveTemplateDialog({
  cart,
  onSave,
}: {
  cart: SellerCart;
  onSave: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
          <Save className="h-3.5 w-3.5" />
          Salvar como Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Template de Carrinho</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="dlg-tpl-name" className="text-sm font-medium">
              Nome do template
            </label>
            <Input
              id="dlg-tpl-name"
              placeholder='Ex: "Kit Onboarding"'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dlg-tpl-desc" className="text-sm font-medium text-muted-foreground">
              Descrição <span className="font-normal">(opcional)</span>
            </label>
            <Textarea
              id="dlg-tpl-desc"
              placeholder="Descreva o propósito deste template..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {cart.items.length} itens serão salvos no template
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave(name.trim(), desc.trim());
              setOpen(false);
              setName('');
              setDesc('');
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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
  templates: {
    id: string;
    name: string;
    description: string | null;
    items: CartTemplateItem[];
    created_at: string;
  }[];
  onLoad: (items: CartTemplateItem[]) => void;
  onDelete: (id: string) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
          <BookTemplate className="h-3.5 w-3.5" />
          Usar Template ({templates.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[70vh] max-w-md">
        <DialogHeader>
          <DialogTitle>Templates Salvos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2">
            {templates.map((t) => (
              <Card key={t.id} className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">{t.items.length} itens</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onLoad(t.items)}
                    >
                      Aplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Excluir template ${t.name}`}
                      className="h-7 text-xs text-destructive"
                      onClick={() => onDelete(t.id)}
                    >
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
