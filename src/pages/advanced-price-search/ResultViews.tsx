import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { type ProductWithCalculatedPrice, formatCurrency } from './types';

export function ProductCardResult({
  product,
  quantity,
}: {
  product: ProductWithCalculatedPrice;
  quantity: number;
}) {
  const { priceBreakdown, matchingTechnique } = product;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group">
      <Card className="overflow-hidden border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
        <div className="relative aspect-square bg-muted/30">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-contain p-4"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          {matchingTechnique && (
            <Badge className="absolute right-2 top-2 bg-primary/90">
              {matchingTechnique.technique_name || matchingTechnique.customization_type_name}
            </Badge>
          )}
        </div>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="line-clamp-2 font-display text-sm font-semibold transition-colors group-hover:text-primary">
              {product.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">SKU: {product.sku}</p>
          </div>
          {product.colors && product.colors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.colors.slice(0, 6).map((color, idx) => (
                <div
                  key={idx}
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: color.hex || '#ccc' }}
                  title={color.name}
                />
              ))}
              {product.colors.length > 6 && (
                <span className="text-xs text-muted-foreground">+{product.colors.length - 6}</span>
              )}
            </div>
          )}
          <div className="space-y-1 border-t border-border/50 pt-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Produto:</span>
              <span>{formatCurrency(priceBreakdown.productPrice)}</span>
            </div>
            {priceBreakdown.customizationPrice > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Personalização:</span>
                <span>{formatCurrency(priceBreakdown.customizationPrice)}</span>
              </div>
            )}
            {priceBreakdown.setupPrice > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Setup (÷{quantity}):</span>
                <span>{formatCurrency(priceBreakdown.setupPrice / quantity)}</span>
              </div>
            )}
            {priceBreakdown.handlingPrice > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Manuseio:</span>
                <span>{formatCurrency(priceBreakdown.handlingPrice)}</span>
              </div>
            )}
          </div>
          <div className="-mx-4 -mb-4 flex items-end justify-between border-t border-primary/20 bg-primary/5 px-4 py-2 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Preço unitário</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(priceBreakdown.totalPerUnit)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{quantity} un.</p>
              <p className="text-sm font-medium">
                {formatCurrency(priceBreakdown.totalPerUnit * quantity)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ProductTableResult({
  products,
  quantity,
}: {
  products: ProductWithCalculatedPrice[];
  quantity: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left text-sm font-medium">Produto</th>
              <th className="p-3 text-left text-sm font-medium">SKU</th>
              <th className="p-3 text-left text-sm font-medium">Técnica</th>
              <th className="p-3 text-right text-sm font-medium">Produto</th>
              <th className="p-3 text-right text-sm font-medium">Gravação</th>
              <th className="p-3 text-right text-sm font-medium">Setup</th>
              <th className="p-3 text-right text-sm font-medium">Unit. Final</th>
              <th className="p-3 text-right text-sm font-medium">Total ({quantity})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((product) => (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-10 w-10 rounded object-contain"
                        loading="lazy"
                      />
                    )}
                    <span className="line-clamp-1 max-w-[200px] text-sm font-medium">
                      {product.name}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{product.sku}</td>
                <td className="p-3">
                  {product.matchingTechnique && (
                    <Badge variant="outline" className="text-xs">
                      {product.matchingTechnique.technique_name ||
                        product.matchingTechnique.customization_type_name}
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-right text-sm">
                  {formatCurrency(product.priceBreakdown.productPrice)}
                </td>
                <td className="p-3 text-right text-sm">
                  {formatCurrency(product.priceBreakdown.customizationPrice)}
                </td>
                <td className="p-3 text-right text-sm text-muted-foreground">
                  {formatCurrency(product.priceBreakdown.setupPrice / quantity)}
                </td>
                <td className="p-3 text-right">
                  <span className="font-semibold text-primary">
                    {formatCurrency(product.priceBreakdown.totalPerUnit)}
                  </span>
                </td>
                <td className="p-3 text-right font-medium">
                  {formatCurrency(product.priceBreakdown.totalPerUnit * quantity)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductListResult({
  products,
  quantity,
}: {
  products: ProductWithCalculatedPrice[];
  quantity: number;
}) {
  return (
    <div className="space-y-3">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-bold text-primary">{index + 1}</span>
                </div>
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted/50">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="line-clamp-1 text-sm font-medium">{product.name}</h4>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                  {product.matchingTechnique && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {product.matchingTechnique.technique_name ||
                        product.matchingTechnique.customization_type_name}
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(product.priceBreakdown.totalPerUnit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total: {formatCurrency(product.priceBreakdown.totalPerUnit * quantity)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
