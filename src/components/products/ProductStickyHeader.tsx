import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Heart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickAddToQuote } from "./QuickAddToQuote";
import { BulkVariantWizard } from "@/components/catalog/BulkVariantWizard";
import { PriceFreshnessBadge } from "./PriceFreshnessBadge";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/products";

interface ProductStickyHeaderProps {
  productId: string;
  productName: string;
  productSku: string;
  productPrice: number;
  productImage: string;
  minQuantity: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  product?: Product;
}

export function ProductStickyHeader({
  productId,
  productName,
  productSku,
  productPrice,
  productImage,
  minQuantity,
  isFavorite,
  onToggleFavorite,
  product,
}: ProductStickyHeaderProps) {
  const [visible, setVisible] = useState(false);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  // Build a minimal Product object for the wizard if not provided
  const wizardProduct: Product = product || {
    id: productId,
    name: productName,
    sku: productSku,
    price: productPrice,
    images: productImage ? [productImage] : [],
    minQuantity,
  } as Product;

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            data-testid="product-sticky-header"
            className="fixed top-0 right-0 z-50 hidden md:block bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
            style={{ left: "var(--header-left, 0px)" }}
          >
            <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center gap-4">
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0 border border-border">
                <img
                  src={productImage}
                  alt={productName}
                  className="w-full h-full object-contain" loading="lazy" />
              </div>

              {/* Name */}
              <h2 className="font-display text-sm font-semibold text-foreground truncate max-w-[300px] lg:max-w-[500px]">
                {productName}
              </h2>

              {/* Price */}
              <span className="text-sm font-bold text-foreground whitespace-nowrap ml-auto flex items-center gap-2">
                {formatPrice(productPrice)}<span className="text-muted-foreground font-normal">/un</span>
                <PriceFreshnessBadge
                  priceUpdatedAt={product?.priceUpdatedAt}
                  thresholdDays={product?.priceFreshnessThresholdDays}
                  variant="compact"
                />
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={onToggleFavorite}
                  data-testid="product-favorite"
                  aria-pressed={isFavorite}
                 aria-label="Favoritar"><Heart className={cn("h-4 w-4", isFavorite && "fill-destructive text-destructive")} />
                </Button>

                <QuickAddToQuote
                  productId={productId}
                  productName={productName}
                  productSku={productSku}
                  productPrice={productPrice}
                  minQuantity={minQuantity}
                  variant="button"
                  buttonSize="sm"
                  labelOverride="Carrinho"
                  iconOverride="cart"
                  className="h-9 rounded-full px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                />

                <Button
                  size="sm"
                  className="h-9 rounded-full px-5 bg-success hover:bg-success/90 text-success-foreground font-medium text-sm gap-1.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  onClick={() => setQuoteWizardOpen(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Orçamento
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkVariantWizard
        open={quoteWizardOpen}
        onOpenChange={setQuoteWizardOpen}
        products={[wizardProduct]}
        mode="quote"
        onComplete={(selections) => {
          const s = selections[0];
          const v = s?.variant;
          const params = new URLSearchParams({
            product_id: productId,
            product_name: productName,
            product_sku: productSku || '',
            product_price: String(productPrice),
            product_image: v?.selected_thumbnail || productImage || '',
            min_quantity: String(minQuantity),
          });
          if (v?.color_name) params.set('color_name', v.color_name);
          if (v?.color_hex) params.set('color_hex', v.color_hex);
          if (v?.size_code) params.set('size_code', v.size_code);
          navigate(`/orcamentos/novo?${params.toString()}`);
        }}
      />
    </>
  );
}
