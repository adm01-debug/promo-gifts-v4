/**
 * CartHeaderActions — ações do header do carrinho ativo:
 * CTA primário "Gerar Orçamento". Os antigos "Gerenciar Carrinho"
 * e "Ver Orçamentos" foram removidos.
 */
import { useState } from 'react';
import { type CartTemplateItem, type SellerCart } from '@/hooks/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { ArrowRight, Trash2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

interface CartHeaderActionsProps {
  cart: SellerCart;
  templates: {
    id: string;
    name: string;
    description?: string | null;
    items: CartTemplateItem[];
    created_at?: string;
  }[];
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
}

export function CartHeaderActions({
  cart,
  templates,
  canCreateCart: _canCreateCart,
  onGenerateQuote,
  onShareCart: _onShareCart,
  onDuplicateCart: _onDuplicateCart,
  onExportCSV: _onExportCSV,
  onExportPDF: _onExportPDF,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onClear: _onClear,
  onNavigate: _onNavigate,
}: CartHeaderActionsProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');

  const isCartValid = Array.isArray(cart.items) && cart.items.length > 0;

  return (
    <>
      <Button
        data-testid="cart-checkout-cta"
        disabled={!isCartValid}
        aria-disabled={!isCartValid}
        title={
          isCartValid
            ? 'Gerar Orçamento a partir deste carrinho'
            : 'Adicione itens ao carrinho antes de gerar um orçamento'
        }
        className="group/cta h-9 gap-2 rounded-xl bg-success px-4 text-xs font-bold text-success-foreground shadow-lg shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-xl hover:shadow-success/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100"
        onClick={() => {
          if (!isCartValid) return;
          onGenerateQuote(cart);
        }}
      >
        Gerar Orçamento
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-hover/cta:translate-x-1"
        />
      </Button>

      {/* Save Template */}
      <Dialog
        open={saveOpen}
        onOpenChange={(open) => {
          setSaveOpen(open);
          if (!open) {
            setTplName('');
            setTplDesc('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Template de Carrinho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="tpl-name" className="text-sm font-medium">
                Nome do template
              </label>
              <Input
                id="tpl-name"
                placeholder='Ex: "Kit Onboarding"'
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tpl-desc" className="text-sm font-medium text-muted-foreground">
                Descrição <span className="font-normal">(opcional)</span>
              </label>
              <Textarea
                id="tpl-desc"
                placeholder="Descreva o propósito deste template..."
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                rows={2}
              />
            </div>
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

      {/* Load Template */}
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
                          aria-label={`Excluir template ${t.name}`}
                          className="h-7 text-xs text-destructive"
                          onClick={() => onDeleteTemplate.mutate(t.id)}
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" />
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
    </>
  );
}
