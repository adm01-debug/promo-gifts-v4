import { useState, useCallback, useMemo } from 'react';
import { Palette, Send, Check, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/ui';
import type { Product, ProductColor } from '@/hooks/products';
import { ShareContactSelector, type ShareContactSelection } from './ShareContactSelector';
import { WhatsAppPreview } from './WhatsAppPreview';
import { openWhatsAppShare } from './whatsapp';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

interface ShareAllColorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
}

function generateColorMessage(product: Product, selectedColors: ProductColor[]) {
  const colorList = selectedColors.map((c, i) => `${i + 1}. ${c.name}`).join('\n');

  return `🎨 *CATÁLOGO DE CORES* 🎨

*${product.name}*
SKU: ${product.sku}

${product.description ?? ''}

📋 *${selectedColors.length} cores selecionadas:*
${colorList}

💰 A partir de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}/un
📦 Qtd mínima: ${product.minQuantity} un
${product.stockStatus === 'in-stock' ? '✅ Pronta entrega' : '⚠️ Consultar prazo'}

👆 Cada cor acompanha foto ilustrativa.

Promo Brindes - Brindes com Excelência!`;
}

export function ShareAllColorsDialog({ open, onOpenChange, product }: ShareAllColorsDialogProps) {
  const { toast } = useToast();
  const [selectedColorIds, setSelectedColorIds] = useState<Set<number>>(
    () => new Set(product.colors.map((_, i) => i)),
  );
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [contactSelection, setContactSelection] = useState<ShareContactSelection | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const selectedColors = useMemo(
    () => product.colors.filter((_, i) => selectedColorIds.has(i)),
    [product.colors, selectedColorIds],
  );

  const message = customMessage ?? generateColorMessage(product, selectedColors);

  // Collect representative images from selected colors for WhatsApp preview
  const allColorImages = useMemo(() => {
    return selectedColors.map((c) => c.image || c.images?.[0] || product.images[0]).filter(Boolean);
  }, [selectedColors, product.images]);

  const allColorImageIndices = useMemo(
    () => new Set(allColorImages.map((_, i) => i)),
    [allColorImages],
  );

  const handleToggleColor = useCallback((idx: number) => {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        if (next.size > 1) next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
    setCustomMessage(null); // regenerate
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedColorIds(new Set(product.colors.map((_, i) => i)));
    setCustomMessage(null);
  }, [product.colors]);

  const handleDeselectAll = useCallback(() => {
    setSelectedColorIds(new Set([0]));
    setCustomMessage(null);
  }, []);

  const handleSend = () => {
    const target = contactSelection?.contactName || contactSelection?.companyName || 'destinatário';

    const { opened } = openWhatsAppShare({
      message,
      phone: contactSelection?.contactPhone,
    });

    if (opened) {
      toast({
        title: 'WhatsApp aberto',
        description: `Catálogo de cores preparado para ${target}`,
      });
    } else {
      toast({
        title: 'Não foi possível abrir o WhatsApp',
        description: 'Verifique se popups estão permitidos no navegador.',
        variant: 'destructive',
      });
    }
    onOpenChange(false);
  };

  // Group colors by group name
  const groupedColors = useMemo(() => {
    const groups = new Map<string, { color: ProductColor; index: number }[]>();
    product.colors.forEach((color, index) => {
      const group = color.group || 'Outras';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)?.push({ color, index });
    });
    return groups;
  }, [product.colors]);

  const allSelected = selectedColorIds.size === product.colors.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Enviar Todas as Cores
          </DialogTitle>
          <DialogDescription>
            Selecione as cores para enviar com fotos individuais ao cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Color grid header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedColorIds.size} de {product.colors.length} cores selecionadas
            </span>
            <button
              type="button"
              onClick={allSelected ? handleDeselectAll : handleSelectAll}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
          </div>

          {/* Color grid by group */}
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-3 pr-2">
              {[...groupedColors.entries()].map(([groupName, items]) => (
                <div key={groupName}>
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupName}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {items.map(({ color, index }) => {
                      const isSelected = selectedColorIds.has(index);
                      const thumb = color.image || color.images?.[0] || product.images[0];
                      const imgCount = color.images?.length || (color.image ? 1 : 0);

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleToggleColor(index)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all',
                            isSelected
                              ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                              : 'border-transparent bg-secondary/30 opacity-60 hover:bg-secondary/60 hover:opacity-100',
                          )}
                        >
                          {/* Color thumbnail */}
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                            <OptimizedImage
                              src={getCdnUrl(thumb, 'thumbnail')}
                              alt={color.name}
                              className="object-cover"
                              containerClassName="h-full w-full"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                <Check className="h-4 w-4 text-primary" />
                              </div>
                            )}
                          </div>

                          {/* Color info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="h-3 w-3 shrink-0 rounded-full border border-border"
                                style={{ backgroundColor: color.hex || '#ccc' }}
                              />
                              <span className="truncate text-xs font-medium">{color.name}</span>
                            </div>
                            {imgCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {imgCount} foto{imgCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Edit / Preview toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Mensagem</span>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                previewMode
                  ? 'bg-[hsl(153,18%,18%)] text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
            >
              {previewMode ? (
                <>
                  <Pencil className="h-3 w-3" />
                  Editar
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Preview WhatsApp
                </>
              )}
            </button>
          </div>

          <div key={previewMode ? 'preview' : 'edit'} className="animate-fade-in">
            {previewMode ? (
              <WhatsAppPreview
                message={message}
                images={allColorImages}
                selectedImages={allColorImageIndices}
                contactName={contactSelection?.contactName}
              />
            ) : (
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <Textarea
                  value={message}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="min-h-[140px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
                />
              </div>
            )}
          </div>

          {/* Contact selector */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Destinatário</span>
            <ShareContactSelector selection={contactSelection} onSelect={setContactSelection} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSend}>
              <Send className="h-4 w-4" />
              Enviar {selectedColors.length} cores
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
