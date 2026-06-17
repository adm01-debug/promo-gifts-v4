/**
 * VariantStockRowActions — Replica as 7 ações do ProductCard do Catálogo na
 * tabela de Estoque (uma linha = uma variação SKU).
 *
 * Ordem (esquerda → direita): Copiar SKU · Carrinho · Orçamento · Coleção ·
 * Favoritar · Comparar · Visualizar · Compartilhar.
 *
 * Como cada linha já representa um SKU específico, dispensamos o
 * VariantPickerDialog do catálogo e aplicamos a ação direto na variação.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  FileText,
  FolderPlus,
  Heart,
  GitCompare,
  Eye,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { QuickAddToQuote } from '@/components/products/QuickAddToQuote';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

interface VariantStockRowActionsProps {
  product: ProductStockSummary;
  variant: VariantStock;
}

export function VariantStockRowActions({ product, variant }: VariantStockRowActionsProps) {
  const navigate = useNavigate();
  const [collectionOpen, setCollectionOpen] = useState(false);

  const isFavorite = useFavoritesStore((s) => s.isFavorite(product.productId));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const isInCompare = useComparisonStore((s) => s.isInCompare(product.productId, variant.variantId));
  const addToCompare = useComparisonStore((s) => s.addToCompare);
  const removeFromCompare = useComparisonStore((s) => s.removeFromCompare);

  const variantInfo = {
    color_name: variant.colorName,
    color_hex: variant.colorHex,
    size_code: variant.sizeCode,
    variant_id: variant.variantId,
    thumbnail: variant.imageUrl ?? product.productImageUrl,
  };

  const productUrl = `${window.location.origin}/produto/${product.productId}`;

  const handleCopySku = () => {
    void navigator.clipboard
      ?.writeText(variant.variantSku)
      .then(() => toast.success(`SKU ${variant.variantSku} copiado`))
      .catch(() => {});
  };

  const handleQuote = () => {
    const params = new URLSearchParams({
      product_id: product.productId,
      product_name: product.productName,
      product_sku: variant.variantSku,
      variant_id: variant.variantId,
      min_quantity: String(variant.minStock || 1),
    });
    if (variant.colorName) params.set('color_name', variant.colorName);
    if (variant.colorHex) params.set('color_hex', variant.colorHex);
    if (variant.sizeCode) params.set('size_code', variant.sizeCode);
    if (variant.imageUrl) params.set('product_image', variant.imageUrl);
    navigate(`/orcamentos/novo?${params.toString()}`);
  };

  const handleFavorite = () => {
    if (isFavorite) {
      removeFavorite(product.productId);
      toast.success(`"${product.productName}" removido dos favoritos`);
    } else {
      addFavorite(product.productId, variantInfo);
      toast.success(
        `"${product.productName}" favoritado${variant.colorName ? ` — ${variant.colorName}` : ''}`,
      );
    }
  };

  const handleCompare = () => {
    if (isInCompare) {
      removeFromCompare(product.productId, variant.variantId);
      toast.success(`"${product.productName}" removido da comparação`);
      return;
    }
    const ok = addToCompare(product.productId, variantInfo);
    if (!ok) {
      toast.error('Limite de 4 produtos para comparação atingido');
    } else {
      toast.success(
        `"${product.productName}" adicionado à comparação${variant.colorName ? ` — ${variant.colorName}` : ''}`,
      );
    }
  };

  const handleView = () => navigate(`/produto/${product.productId}`);

  const handleShare = async () => {
    const shareData = {
      title: product.productName,
      text: `${product.productName}${variant.colorName ? ` — ${variant.colorName}` : ''}`,
      url: productUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fallback abaixo
      }
    }
    try {
      await navigator.clipboard?.writeText(productUrl);
      toast.success('Link do produto copiado');
    } catch {
      toast.error('Não foi possível compartilhar');
    }
  };

  return (
    <>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconAction label={`Copiar SKU ${variant.variantSku}`} icon={Copy} onClick={handleCopySku} />

        {/* Carrinho — usa fluxo padrão do QuickAddToQuote (variante-aware). */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <QuickAddToQuote
                productId={product.productId}
                productName={product.productName}
                productSku={variant.variantSku}
                productImageUrl={variant.imageUrl ?? product.productImageUrl ?? undefined}
                minQuantity={variant.minStock || 1}
                variant="icon"
                className="h-7 w-7"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>Adicionar ao carrinho</TooltipContent>
        </Tooltip>

        <IconAction label="Orçamento" icon={FileText} onClick={handleQuote} />
        <IconAction label="Coleção" icon={FolderPlus} onClick={() => setCollectionOpen(true)} />
        <IconAction
          label={isFavorite ? 'Remover favorito' : 'Favoritar'}
          icon={Heart}
          onClick={handleFavorite}
          active={isFavorite}
          iconClassName={isFavorite ? 'fill-destructive text-destructive' : undefined}
          ariaPressed={isFavorite}
        />
        <IconAction
          label={isInCompare ? 'Remover da comparação' : 'Comparar'}
          icon={GitCompare}
          onClick={handleCompare}
          active={isInCompare}
          iconClassName={isInCompare ? 'text-primary' : undefined}
          ariaPressed={isInCompare}
        />
        <IconAction label="Visualizar produto" icon={Eye} onClick={handleView} />
        <IconAction label="Compartilhar" icon={Share2} onClick={handleShare} />
      </div>

      <AddToCollectionModal
        open={collectionOpen}
        onOpenChange={setCollectionOpen}
        productId={product.productId}
        productName={product.productName}
        variant={{
          color_name: variant.colorName,
          color_hex: variant.colorHex,
          size_code: variant.sizeCode,
          variant_id: variant.variantId,
          thumbnail: variant.imageUrl ?? product.productImageUrl,
        }}
      />
    </>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  active,
  iconClassName,
  ariaPressed,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  iconClassName?: string;
  ariaPressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', active && 'bg-muted/60')}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label={label}
          aria-pressed={ariaPressed}
        >
          <Icon className={cn('h-3 w-3', iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
