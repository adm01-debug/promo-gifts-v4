import { useState, useMemo } from 'react';
import { Layers, Send, Package, Eye, Pencil, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/ui';
import type { Product, KitComponent } from '@/types/product-catalog';
import { ShareContactSelector, type ShareContactSelection } from './ShareContactSelector';
import { WhatsAppPreview } from './WhatsAppPreview';
import { openWhatsAppShare } from './whatsapp';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

interface ShareKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  mode: 'complete' | 'separate';
}

export function generateKitCompleteMessage(product: Product) {
  const itemsList = product.kitItems
    ?.map((item, i) => `${i + 1}. ${item.productName} (${item.quantity} un)`)
    .join('\n');

  return `🎁 *COMPOSIÇÃO DO KIT* 🎁

*${product.name}*
SKU: ${product.sku}

${product.description ?? ''}

📋 *Componentes do Kit:*
${itemsList || 'Consultar itens'}

💰 Investimento: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}/un
📦 Qtd mínima: ${product.minQuantity} kits
${product.stockStatus === 'in-stock' ? '✅ Pronta entrega' : '⚠️ Consultar prazo'}

Promo Brindes - Brindes com Excelência!`;
}

export function generateItemMessage(product: Product, item: KitComponent) {
  return `📦 *ITEM DO KIT* 📦

*${item.productName}*
Parte do Kit: ${product.name}

${item.description ?? ''}
${item.material ? `🧵 Material: ${item.material}` : ''}
${item.weightG ? `⚖️ Peso: ${item.weightG}g` : ''}

💰 Kit completo a partir de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}/un
📦 Qtd mínima: ${product.minQuantity} kits

Promo Brindes - Brindes com Excelência!`;
}

export function ShareKitDialog({ open, onOpenChange, product, mode }: ShareKitDialogProps) {
  const { toast } = useToast();
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [contactSelection, setContactSelection] = useState<ShareContactSelection | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  const kitItems = useMemo(() => product.kitItems ?? [], [product.kitItems]);

  const activeItem = useMemo(() => {
    if (mode === 'separate' && selectedItemIndex !== null) {
      return kitItems[selectedItemIndex];
    }
    return null;
  }, [mode, selectedItemIndex, kitItems]);

  const message = useMemo(() => {
    if (customMessage) return customMessage;
    if (mode === 'complete') return generateKitCompleteMessage(product);
    if (activeItem) return generateItemMessage(product, activeItem);
    return '';
  }, [customMessage, mode, product, activeItem]);

  const allImages = useMemo(() => {
    if (mode === 'complete') {
      const images: string[] = [];
      const mainImg = product.images?.[0] || product.image_url;
      if (mainImg) images.push(mainImg);

      kitItems.forEach((item) => {
        if (item.imageUrl) images.push(item.imageUrl);
      });
      return Array.from(new Set(images.filter(Boolean) as string[]));
    } else if (activeItem) {
      const images = [activeItem.imageUrl].filter(Boolean) as string[];
      if (images.length === 0 && (product.images?.[0] || product.image_url)) {
        images.push((product.images?.[0] || product.image_url) as string);
      }
      return images;
    }
    return [];
  }, [mode, product.images, product.image_url, kitItems, activeItem]);

  const imageIndices = useMemo(() => new Set(allImages.map((_, i) => i)), [allImages]);

  const phoneError = useMemo(() => {
    if (!contactSelection?.contactPhone) return null;
    const digits = contactSelection.contactPhone.replace(/\D/g, '');
    if (digits.length < 10) return 'Telefone muito curto (mínimo 10 dígitos)';
    if (digits.length > 13) return 'Telefone muito longo';
    return null;
  }, [contactSelection?.contactPhone]);

  const handleSend = () => {
    if (phoneError) {
      toast({
        title: 'Telefone inválido',
        description: phoneError,
        variant: 'destructive',
      });
      return;
    }

    const target = contactSelection?.contactName || contactSelection?.companyName || 'destinatário';
    const { opened } = openWhatsAppShare({
      message,
      phone: contactSelection?.contactPhone,
    });

    if (opened) {
      toast({
        title: 'WhatsApp aberto',
        description: `Mensagem preparada para ${target}`,
      });
    } else {
      toast({
        title: 'Não foi possível abrir o WhatsApp',
        description: 'Verifique se popups estão permitidos.',
        variant: 'destructive',
      });
    }
    if (mode === 'complete') onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {mode === 'complete' ? 'Enviar KIT Completo' : 'Enviar Itens Separados'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'complete'
              ? 'Envia a descrição do kit com a lista de todos os componentes'
              : 'Selecione um item do kit para enviar individualmente'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'separate' && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Selecione o item</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {kitItems.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedItemIndex(index);
                      setCustomMessage(null);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-2 transition-all',
                      selectedItemIndex === index
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/50',
                    )}
                  >
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
                      {item.imageUrl ? (
                        <OptimizedImage
                          src={getCdnUrl(item.imageUrl, 'thumbnail')}
                          alt={item.productName}
                          className="object-cover"
                          containerClassName="h-full w-full"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground/30" />
                      )}
                      {selectedItemIndex === index && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight">
                      {item.productName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(mode === 'complete' || activeItem) && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Mensagem</span>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    previewMode
                      ? 'bg-primary/20 text-primary'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                  )}
                >
                  {previewMode ? (
                    <>
                      <Pencil className="h-3 w-3" /> Editar
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Preview
                    </>
                  )}
                </button>
              </div>

              <div key={previewMode ? 'preview' : 'edit'} className="animate-fade-in">
                {previewMode ? (
                  <WhatsAppPreview
                    message={message}
                    images={allImages}
                    selectedImages={imageIndices}
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Destinatário</span>
                  {phoneError && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" /> {phoneError}
                    </span>
                  )}
                </div>
                <ShareContactSelector selection={contactSelection} onSelect={setContactSelection} />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSend}
                  disabled={!!phoneError}
                >
                  <Send className="h-4 w-4" />
                  Enviar WhatsApp
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
