import { useState, useCallback, useMemo, useEffect } from 'react';
import { MessageCircle, Send, Eye, Pencil } from 'lucide-react';
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
import type { Product } from '@/hooks/products';
import { PhotoSelector } from './PhotoSelector';
import { ShareContactSelector, type ShareContactSelection } from './ShareContactSelector';
import { MESSAGE_TEMPLATES, type TemplateKey } from './MessageTemplates';
import { WhatsAppPreview } from './WhatsAppPreview';
import { openWhatsAppShare } from './whatsapp';
import { cn } from '@/lib/utils';

interface SelectedVariantInfo {
  variantName?: string | null;
  colorHex?: string | null;
  thumbnailUrl?: string | null;
}

interface SharePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  selectedVariant?: SelectedVariantInfo | null;
}

export function SharePreviewDialog({
  open,
  onOpenChange,
  product,
  selectedVariant,
}: SharePreviewDialogProps) {
  const { toast } = useToast();
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('informal');
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [contactSelection, setContactSelection] = useState<ShareContactSelection | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Filter out color-specific images — keep only main product photos
  const mainImages = useMemo(() => {
    const preferredImages: string[] = [];

    if (selectedVariant?.thumbnailUrl) {
      preferredImages.push(selectedVariant.thumbnailUrl);
    }

    if (!product.colors || product.colors.length === 0) {
      preferredImages.push(...product.images);
      return Array.from(new Set(preferredImages));
    }

    const colorImageUrls = new Set<string>();
    product.colors.forEach((color) => {
      if (color.image) colorImageUrls.add(color.image);
      color.images?.forEach((img) => colorImageUrls.add(img));
    });

    const filtered = product.images.filter((img) => !colorImageUrls.has(img));
    preferredImages.push(
      ...(filtered.length > 0 ? filtered : product.images[0] ? [product.images[0]] : []),
    );

    return Array.from(new Set(preferredImages));
  }, [product.images, product.colors, selectedVariant?.thumbnailUrl]);

  const [selectedImages, setSelectedImages] = useState<Set<number>>(
    () => new Set(mainImages.map((_, i) => i)),
  );

  // Reset selected images when the available images change (e.g. different variant)
  useEffect(() => {
    setSelectedImages(new Set(mainImages.map((_, i) => i)));
  }, [mainImages]);

  const currentTemplate =
    MESSAGE_TEMPLATES.find((t) => t.key === activeTemplate) ?? MESSAGE_TEMPLATES[0];
  const defaultMessage = useMemo(() => {
    const baseMessage = currentTemplate.generate(product);

    if (!selectedVariant?.variantName) {
      return baseMessage;
    }

    return `${baseMessage}\n\n🎨 Cor/variação: ${selectedVariant.variantName}`;
  }, [currentTemplate, product, selectedVariant?.variantName]);

  const message = customMessage ?? defaultMessage;

  const handleToggleImage = useCallback((idx: number) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        if (next.size > 1) next.delete(idx); // keep at least 1
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedImages(new Set(mainImages.map((_, i) => i)));
  }, [mainImages]);

  const handleDeselectAll = useCallback(() => {
    setSelectedImages(new Set([0])); // keep first
  }, []);

  const handleTemplateChange = (key: TemplateKey) => {
    setActiveTemplate(key);
    setCustomMessage(null);
  };

  const handleSend = () => {
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
        description: 'Verifique se popups estão permitidos no navegador.',
        variant: 'destructive',
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[64vh] overflow-y-auto sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            Enviar Produto
            {selectedVariant?.variantName && (
              <span className="ml-1 inline-flex items-center gap-1.5">
                {selectedVariant.colorHex && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-border/50"
                    style={{ backgroundColor: selectedVariant.colorHex }}
                  />
                )}
                <span className="text-xs font-normal text-muted-foreground">
                  — {selectedVariant.variantName}
                </span>
              </span>
            )}
          </DialogTitle>
          <DialogDescription>Selecione fotos, modelo de mensagem e contato</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo selector */}
          <PhotoSelector
            images={mainImages}
            selectedImages={selectedImages}
            onToggle={handleToggleImage}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />

          {/* Template selector */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Modelo de mensagem</span>
            <div className="flex gap-1.5">
              {MESSAGE_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTemplateChange(t.key)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    activeTemplate === t.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                  )}
                  title={t.description}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Edit / Preview toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Mensagem</span>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                previewMode
                  ? 'bg-[hsl(142,40%,28%)] text-primary-foreground'
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
                images={mainImages}
                selectedImages={selectedImages}
                contactName={contactSelection?.contactName}
              />
            ) : (
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <Textarea
                  value={message}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="min-h-[160px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
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
            <Button
              className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
              Enviar - WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
