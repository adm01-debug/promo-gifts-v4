import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  TrendingDown,
  TrendingUp,
  Package,
  Crown,
  ArrowRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupplierComparison, type Product } from "@/hooks/products";
import { Skeleton } from "@/components/ui/skeleton";

interface SupplierComparisonModalProps {
  product?: Product | null;
  productId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierComparisonModal({
  product,
  productId,
  open,
  onOpenChange,
}: SupplierComparisonModalProps) {
  const navigate = useNavigate();
  const { data: comparison, isLoading } = useSupplierComparison(product ?? null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case "in-stock":
        return { label: "Em estoque", color: "text-success" };
      case "low-stock":
        return { label: "Estoque baixo", color: "text-warning" };
      case "out-of-stock":
        return { label: "Sem estoque", color: "text-destructive" };
      default:
        return { label: "Em estoque", color: "text-success" };
    }
  };

  if (isLoading || !comparison) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Comparador de Fornecedores
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { baseProduct, alternatives, lowestPrice, highestStock } = comparison;
  const baseIsLowest = baseProduct.price === lowestPrice;
  const baseIsBestStock = baseProduct.stock === highestStock;

  const allProducts = [
    {
      product: baseProduct,
      priceDiff: 0,
      priceDiffPercent: 0,
      stockAdvantage: false,
      isLowestPrice: baseIsLowest,
      isBestStock: baseIsBestStock,
      isBase: true,
    },
    ...alternatives.map((alt) => ({ ...alt, isBase: false })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Comparador de Fornecedores
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Comparando {allProducts.length} fornecedores para produtos similares
          </p>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-xs text-muted-foreground mb-1">Menor Preço</p>
              <p className="text-lg font-bold text-success">
                {formatCurrency(lowestPrice)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Maior Estoque</p>
              <p className="text-lg font-bold text-primary">
                {highestStock.toLocaleString("pt-BR")} un.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-1">Fornecedores</p>
              <p className="text-lg font-bold">{allProducts.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-1">
                Economia Máx.
              </p>
              <p className="text-lg font-bold text-success">
                {formatCurrency(
                  Math.max(...alternatives.map((a) => -a.priceDiff), 0)
                )}
              </p>
            </div>
          </div>

          {/* Comparison Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagem</TableHead>
                <TableHead>Produto / Fornecedor</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Variação</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-center">Mín.</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProducts.map(
                ({
                  product,
                  priceDiff,
                  priceDiffPercent,
                  isLowestPrice,
                  isBestStock,
                  isBase,
                }) => {
                  const status = getStockStatusLabel(product.stockStatus);

                  return (
                    <TableRow
                      key={product.id}
                      className={cn(
                        isBase && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                    >
                      <TableCell>
                        <div className="relative w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover transition-opacity duration-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                                (e.target as HTMLImageElement).className = "w-8 h-8 opacity-20 object-contain";
                              }}
                              loading="lazy" 
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground/30" />
                          )}
                          {isBase && (
                            <Badge
                              variant="default"
                              className="absolute -top-2 -left-2 text-[10px] px-1"
                            >
                              Atual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium line-clamp-1">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {product.supplier.name}
                            </Badge>
                            {isLowestPrice && (
                              <Badge
                                variant="default"
                                className="text-xs bg-success"
                              >
                                <Crown className="h-3 w-3 mr-1" />
                                Melhor Preço
                              </Badge>
                            )}
                            {isBestStock && !isLowestPrice && (
                              <Badge
                                variant="default"
                                className="text-xs bg-primary"
                              >
                                <Package className="h-3 w-3 mr-1" />
                                Melhor Estoque
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {product.sku}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "text-lg font-bold",
                            isLowestPrice ? "text-success" : "text-foreground"
                          )}
                        >
                          {formatCurrency(product.price)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {isBase ? (
                          <span className="text-muted-foreground">-</span>
                        ) : priceDiff > 0 ? (
                          <div className="flex items-center justify-center gap-1 text-destructive">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatPercent(priceDiffPercent)}
                            </span>
                          </div>
                        ) : priceDiff < 0 ? (
                          <div className="flex items-center justify-center gap-1 text-success">
                            <TrendingDown className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatPercent(priceDiffPercent)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Minus className="h-4 w-4" />
                            <span className="text-sm">Igual</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn("font-medium", status.color)}>
                            {status.label}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {product.stock.toLocaleString("pt-BR")} un.
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">
                          {product.minQuantity} un.
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={isBase ? "outline" : "default"}
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/produto/${product.id}`);
                          }}
                        >
                          {isBase ? "Ver" : "Trocar"}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }
              )}
            </TableBody>
          </Table>

          {/* Materials Comparison */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-medium mb-3">Materiais Comparados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allProducts.map(({ product, isBase }) => (
                <div
                  key={product.id}
                  className={cn(
                    "p-3 rounded-lg bg-background border",
                    isBase ? "border-primary" : "border-border"
                  )}
                >
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    {product.supplier.name}
                    {isBase && (
                      <Badge variant="secondary" className="text-xs">
                        Atual
                      </Badge>
                    )}
                  </p>
                  {Array.isArray(product.materials) && product.materials.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.materials.map((material) => (
                        <Badge
                          key={material}
                          variant="outline"
                          className="text-xs"
                        >
                          {material}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Colors Comparison */}
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-medium mb-3">Cores Disponíveis</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allProducts.map(({ product, isBase }) => (
                <div
                  key={product.id}
                  className={cn(
                    "p-3 rounded-lg bg-background border",
                    isBase ? "border-primary" : "border-border"
                  )}
                >
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    {product.supplier.name}
                    <span className="text-muted-foreground">
                      ({product.colors.length} cores)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {product.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-6 h-6 rounded-full border border-border"
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
