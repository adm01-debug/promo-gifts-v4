import { useState, useMemo } from "react";
import {
  MessageCircle,
  Copy,
  Download,
  Check,
  Image as ImageIcon,
  Palette,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/ui";
import type { Product } from "@/hooks/products";
import { SharePreviewDialog } from "./share/SharePreviewDialog";
import { ShareAllColorsDialog } from "./share/ShareAllColorsDialog";
import { usePhotoDownload } from "./share/usePhotoDownload";
import { MESSAGE_TEMPLATES } from "./share/MessageTemplates";

interface ShareActionsProps {
  product: Product;
  selectedPhotosCount?: number;
  selectedVariant?: { variantName?: string | null; colorHex?: string | null; thumbnailUrl?: string | null } | null;
}

export function ShareActions({ product, selectedPhotosCount = 0, selectedVariant }: ShareActionsProps) {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [copied, setCopied] = useState(false);
  const { downloadPhotos, downloading } = usePhotoDownload();

  // Count main product images (excluding color-specific ones)
  const mainPhotosCount = useMemo(() => {
    if (!product.colors || product.colors.length === 0) return product.images.length;
    const colorImageUrls = new Set<string>();
    product.colors.forEach((color) => {
      if (color.image) colorImageUrls.add(color.image);
      color.images?.forEach((img) => colorImageUrls.add(img));
    });
    const filtered = product.images.filter((img) => !colorImageUrls.has(img));
    return filtered.length > 0 ? filtered.length : 1;
  }, [product.images, product.colors]);

  const handleCopyDescription = async () => {
    const message = MESSAGE_TEMPLATES[1].generate(product); // informal default
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "Descrição copiada para a área de transferência",
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
          className="gap-2 rounded-r-none border-r border-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => setShowPreview(true)}
        >
          <MessageCircle className="h-4 w-4" />
          Enviar - WhatsApp
          <span className="bg-primary-foreground/20 text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {mainPhotosCount}
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-l-none px-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Opções de Envio</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setShowPreview(true)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar Produto Simples
              <span className="ml-auto text-[10px] text-muted-foreground">
                {mainPhotosCount} foto{mainPhotosCount !== 1 ? "s" : ""}
              </span>
            </DropdownMenuItem>

            {hasColors && (
              <DropdownMenuItem onClick={() => setShowAllColors(true)}>
                <Palette className="h-4 w-4 mr-2" />
                Enviar Todas as Cores
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {product.colors.length}
                </span>
              </DropdownMenuItem>
            )}

            {product.isKit && (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    toast({
                      title: "KIT Completo",
                      description: "Preparando fotos do kit montado...",
                    });
                  }}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Enviar KIT Completo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    toast({
                      title: "Itens do KIT",
                      description: "Preparando fotos individuais dos itens...",
                    });
                  }}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Enviar Itens Separados
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Compartilhar</DropdownMenuLabel>

            <DropdownMenuItem onClick={handleCopyDescription}>
              {copied ? (
                <Check className="h-4 w-4 mr-2 text-success" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copiar Descrição
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleDownloadPhotos} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />
              {downloading
                ? "Baixando..."
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
    </>
  );
}
