import { useState, useMemo } from 'react';
import {
  MessageCircle,
  Copy,
  Download,
  Check,
  Image as ImageIcon,
  Palette,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/ui';
import type { Product } from '@/hooks/products';
import { SharePreviewDialog } from './share/SharePreviewDialog';
import { ShareAllColorsDialog } from './share/ShareAllColorsDialog';
import { ShareKitDialog } from './share/ShareKitDialog';
import { usePhotoDownload } from './share/usePhotoDownload';
import { MESSAGE_TEMPLATES } from './share/MessageTemplates';

interface ShareActionsProps {
  product: Product;
  selectedPhotosCount?: number;
  selectedVariant?: {
    variantName?: string | null;
    colorHex?: string | null;
    thumbnailUrl?: string | null;
    variantImages?: string[] | null;
  } | null;
}

export function ShareActions({
  product,
  selectedPhotosCount = 0,
  selectedVariant,
}: ShareActionsProps) {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showKitComplete, setShowKitComplete] = useState(false);
  const [showKitItems, setShowKitItems] = useState(false);
  const [copied, setCopied] = useState(false);
  const { downloadPhotos, downloading } = usePhotoDownload();

  // Count photos considering selection
  const totalPhotosCount = useMemo(() => {
    const imagesArray = Array.isArray(product.images) ? product.images : [];

    // If we have a selected variant with specific images, use those + main product images
    const variantImages =
      selectedVariant?.variantImages && selectedVariant.variantImages.length > 0
        ? selectedVariant.variantImages
        : selectedVariant?.thumbnailUrl
          ? [selectedVariant.thumbnailUrl]
          : [];

    if (!product.colors || product.colors.length === 0) {
      const all = [...new Set([...variantImages, ...imagesArray])].filter(Boolean);
      return all.length > 0 ? all.length : 1;
    }

    const colorImageUrls = new Set<string>();
    product.colors.forEach((color) => {
      if (color.image) colorImageUrls.add(color.image);
      color.images?.forEach((img) => colorImageUrls.add(img));
    });

    const mainImages = imagesArray.filter((img) => !colorImageUrls.has(img));
    const combined = [...new Set([...variantImages, ...mainImages])].filter(Boolean);

    return combined.length > 0 ? combined.length : 1;
  }, [product.images, product.colors, selectedVariant]);

  const handleCopyDescription = async () => {
    const message = MESSAGE_TEMPLATES[1].generate(product); // informal default
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast({
      title: 'Copiado!',
      description: 'Descrição copiada para a área de transferência',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPhotos = () => {
    downloadPhotos(product.images, product.name);
  };

  const hasColors = product.colors && product.colors.length > 1;

  return (
    <>
      <div className="inline-flex rounded-md shadow-sm">
        <Button
          className="gap-2 rounded-r-none border-r border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowPreview(true)}
        >
          <MessageCircle className="h-4 w-4" />
          Enviar - WhatsApp
          <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {totalPhotosCount}
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-l-none bg-primary px-2 text-primary-foreground hover:bg-primary/90">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Opções de Envio</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setShowPreview(true)}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar Produto Simples
              <span className="ml-auto text-[10px] text-muted-foreground">
                {totalPhotosCount} foto{totalPhotosCount !== 1 ? 's' : ''}
              </span>
            </DropdownMenuItem>

            {hasColors && (
              <DropdownMenuItem onClick={() => setShowAllColors(true)}>
                <Palette className="mr-2 h-4 w-4" />
                Enviar Todas as Cores
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {product.colors.length}
                </span>
              </DropdownMenuItem>
            )}

            {product.isKit && (
              <>
                <DropdownMenuItem onClick={() => setShowKitComplete(true)}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Enviar KIT Completo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowKitItems(true)}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Enviar Itens Separados
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Compartilhar</DropdownMenuLabel>

            <DropdownMenuItem onClick={handleCopyDescription}>
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-success" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copiar Descrição
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleDownloadPhotos} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" />
              {downloading
                ? 'Baixando...'
                : `Download (${selectedPhotosCount || product.images.length} fotos)`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SharePreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        product={product}
        selectedVariant={selectedVariant}
      />

      {hasColors && (
        <ShareAllColorsDialog
          open={showAllColors}
          onOpenChange={setShowAllColors}
          product={product}
        />
      )}

      {product.isKit && (
        <>
          <ShareKitDialog
            open={showKitComplete}
            onOpenChange={setShowKitComplete}
            product={product}
            mode="complete"
          />
          <ShareKitDialog
            open={showKitItems}
            onOpenChange={setShowKitItems}
            product={product}
            mode="separate"
          />
        </>
      )}
    </>
  );
}
