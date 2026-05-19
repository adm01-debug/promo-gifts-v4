/**
 * EnhancedProductCard - Card de produto melhorado com hover preview e ações rápidas
 * Inclui preview expandido, quick-add e badges de urgência
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Eye,
  Share2,
  GitCompare,
  ShoppingCart,
  Package,
  Star,
  Sparkles,
  Clock,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/products";
import { PriceFreshnessBadge } from "./PriceFreshnessBadge";

interface EnhancedProductCardProps {
  product: Product;
  onClick?: () => void;
  onQuickAdd?: (product: Product, quantity: number) => void;
  onToggleFavorite?: (productId: string) => void;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  onShare?: (product: Product) => void;
  onQuickView?: (product: Product) => void;
  isFavorited?: boolean;
  isInCompare?: boolean;
  canAddToCompare?: boolean;
  showUrgencyBadge?: boolean;
  urgencyType?: "limited-stock" | "trending" | "ending-soon";
  urgencyText?: string;
}

export function EnhancedProductCard({
  product,
  onClick,
  onQuickAdd,
  onToggleFavorite,
  onToggleCompare,
  onShare,
  onQuickView,
  isFavorited = false,
  isInCompare = false,
  canAddToCompare = true,
  showUrgencyBadge = false,
  urgencyType = "limited-stock",
  urgencyText,
}: EnhancedProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [quickAddQuantity, setQuickAddQuantity] = useState(1);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Mostrar preview após 500ms de hover
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPreview(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const getUrgencyBadge = () => {
    if (!showUrgencyBadge) return null;

    const configs = {
      "limited-stock": {
        icon: <Package className="h-3 w-3" />,
        text: urgencyText || "Estoque limitado",
        className: "bg-destructive/90 text-destructive-foreground",
      },
      trending: {
        icon: <TrendingUp className="h-3 w-3" />,
        text: urgencyText || "Em alta",
        className: "bg-primary/90 text-primary-foreground",
      },
      "ending-soon": {
        icon: <Clock className="h-3 w-3" />,
        text: urgencyText || "Termina em breve",
        className: "bg-warning/90 text-warning-foreground",
      },
    };

    const config = configs[urgencyType];

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-md",
          config.className
        )}
      >
        {config.icon}
        <span>{config.text}</span>
      </motion.div>
    );
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-card border border-border/50",
        "transition-all duration-300 ease-out cursor-pointer",
        "hover:border-primary/30 hover:shadow-2xl hover:-translate-y-1",
        isHovered && "ring-2 ring-primary/20"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Urgency Badge */}
      {getUrgencyBadge()}

      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden product-img-container">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted/30" />
        )}

        <motion.img
          src={product.images[0]}
          alt={product.name}
          className={cn(
            "w-full h-full object-contain transition-all duration-700 ease-out",
            imageLoaded ? "opacity-100 blur-0 scale-100" : "opacity-40 blur-md scale-105"
          )}
          animate={{
            scale: isHovered ? 1.05 : 1,
          }}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Gradient overlay on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Featured badge */}
        {product.featured && (
          <Badge className="absolute top-3 right-3 z-10 bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-3 w-3 mr-1" />
            Destaque
          </Badge>
        )}

        {/* Quick Actions - Always visible on mobile, hover on desktop */}
        <div
          className={cn(
            "absolute right-3 top-12 flex flex-col gap-2 z-20",
            "transition-all duration-300",
            "opacity-100 md:opacity-0",
            "md:group-hover:opacity-100 md:group-hover:translate-x-0 md:translate-x-4"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon" aria-label="Favoritar"
                data-testid="product-card-favorite"
                aria-pressed={isFavorited}
                className={cn(
                  "h-10 w-10 rounded-full bg-card/95 backdrop-blur-md shadow-md",
                  "hover:scale-110 transition-all",
                  isFavorited && "bg-destructive/10 border-destructive/30"
                )}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onToggleFavorite?.(product.id);
                }}
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    isFavorited && "fill-destructive text-destructive"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon" aria-label="GitCompare"
                className={cn(
                  "h-10 w-10 rounded-full bg-card/95 backdrop-blur-md shadow-md",
                  "hover:scale-110 transition-all",
                  isInCompare && "bg-primary/10 border-primary/30"
                )}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onToggleCompare?.(product.id);
                }}
                disabled={!isInCompare && !canAddToCompare}
              >
                <GitCompare
                  className={cn("h-4 w-4", isInCompare && "text-primary")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isInCompare ? "Remover da comparação" : "Comparar"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon" aria-label="Visualizar"
                className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-md shadow-md hover:scale-110 transition-all"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onQuickView?.(product);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Visualização rápida</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon" aria-label="Compartilhar"
                className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-md shadow-md hover:scale-110 transition-all"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onShare?.(product);
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Compartilhar</TooltipContent>
          </Tooltip>
        </div>

        {/* Quick Add to Quote - Bottom overlay on hover */}
        <AnimatePresence>
          {isHovered && onQuickAdd && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 p-4 z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md rounded-full p-2 shadow-xl border border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setQuickAddQuantity(Math.max(1, quickAddQuantity - 1))}
                  aria-label="Diminuir quantidade"
                >
                  -
                </Button>
                <span className="w-8 text-center font-medium text-sm">
                  {quickAddQuantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setQuickAddQuantity(quickAddQuantity + 1)}
                  aria-label="Aumentar quantidade"
                >
                  +
                </Button>
                <Button
                  data-testid="product-card-quick-add"
                  size="sm"
                  className="flex-1 rounded-full gap-2"
                  onClick={() => onQuickAdd(product, quickAddQuantity)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color variations preview */}
        {product.colors?.length > 0 && (
          <motion.div
            className={cn(
              "absolute bottom-4 left-4 z-10",
              "transition-all duration-300",
              isHovered ? "opacity-0" : "opacity-100"
            )}
          >
            <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-full px-2 py-1">
              {product.colors.slice(0, 4).map((color: { hex: string }, idx: number) => (
                <div
                  key={idx}
                  className="w-4 h-4 rounded-full border-2 border-card shadow-sm"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  +{product.colors.length - 4}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Supplier */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-[10px]">
            {product.supplier?.name || "Fornecedor"}
          </Badge>
          {product.rating && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-warning text-warning" />
              {product.rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Name */}
        <h3
          data-testid="product-card-name"
          data-product-name={product.name}
          className="font-display font-medium text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors"
        >
          {product.name}
        </h3>

        {/* Price */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">A partir de</p>
            <span className="text-lg font-bold inline-flex items-center gap-1.5">
              {formatPrice(product.price)}
              <PriceFreshnessBadge
                priceUpdatedAt={product.priceUpdatedAt}
                thresholdDays={product.priceFreshnessThresholdDays}
                variant="icon-only"
              />
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Package className="h-3 w-3" />
            {product.stock?.toLocaleString("pt-BR")} un
          </div>
        </div>

        {/* View More Indicator */}
        <motion.div
          className="flex items-center justify-center gap-1 text-xs text-primary pt-2 border-t border-border/50"
          animate={{ x: isHovered ? 5 : 0 }}
        >
          Ver detalhes
          <ChevronRight className="h-3 w-3" />
        </motion.div>
      </div>

      {/* Hover Preview Popup */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="absolute left-full top-0 ml-4 w-72 bg-card rounded-xl shadow-xl border z-50 overflow-hidden"
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">{product.name}</h4>
              
              <p className="text-xs text-muted-foreground line-clamp-3">
                {product.description}
              </p>

              {Array.isArray(product.materials) && product.materials.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {product.materials.slice(0, 3).map((material: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[10px]">
                      {material}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Mín. pedido</p>
                  <p className="font-medium">{product.minQuantity || 1} un</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prazo</p>
                  <p className="font-medium">Consultar</p>
                </div>
              </div>

              <Button className="w-full" size="sm">
                Ver produto completo
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
