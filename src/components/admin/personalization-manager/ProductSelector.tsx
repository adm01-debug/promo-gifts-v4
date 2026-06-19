import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Search, Loader2 } from 'lucide-react';
import type { Product, ProductGroup } from './types';

interface ProductSelectorProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedProduct: string | null;
  setSelectedProduct: (id: string) => void;
  productsLoading: boolean;
  filteredProducts: Product[];
  totalProducts: number;
  allMemberships?: Array<{ product_id: string; product_group_id: string }>;
  productGroups?: ProductGroup[];
}

export function ProductSelector({
  searchQuery,
  setSearchQuery,
  selectedProduct,
  setSelectedProduct,
  productsLoading,
  filteredProducts,
  totalProducts,
  allMemberships,
  productGroups,
}: ProductSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Personalização por Produto
        </CardTitle>
        <CardDescription>
          Configure regras específicas de personalização para cada produto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou grupo..."
            data-testid="admin-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedProduct ?? ''} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Selecione um produto..." />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {productsLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              filteredProducts.map((product) => {
                const membership = allMemberships?.find((m) => m.product_id === product.id);
                const group = membership
                  ? productGroups?.find((g) => g.id === membership.product_group_id)
                  : null;
                return (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex items-center gap-2">
                      <span>{product.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        ({product.sku})
                      </span>
                      {group && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          {group.group_code}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
        {searchQuery && (
          <p className="text-xs text-muted-foreground">
            {filteredProducts.length} de {totalProducts} produtos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
