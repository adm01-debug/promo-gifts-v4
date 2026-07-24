import { useState } from 'react';
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
import { Package, Loader2, Search } from 'lucide-react';
import type { Product, ProductGroup } from './usePersonalizationData';

interface ProductSelectorProps {
  products: Product[] | undefined;
  productsLoading: boolean;
  productGroups: ProductGroup[] | undefined;
  allMemberships: { product_id: string; product_group_id: string }[] | undefined;
  selectedProduct: string | null;
  onSelectProduct: (id: string) => void;
}

export function ProductSelector({
  products,
  productsLoading,
  productGroups,
  allMemberships,
  selectedProduct,
  onSelectProduct,
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts =
    products?.filter((product) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchesName = product.name.toLowerCase().includes(query);
      const matchesSku = product.sku.toLowerCase().includes(query);
      const membership = allMemberships?.find((m) => m.product_id === product.id);
      const group = membership
        ? productGroups?.find((g) => g.id === membership.product_group_id)
        : null;
      const matchesGroup =
        group?.group_name.toLowerCase().includes(query) ||
        group?.group_code.toLowerCase().includes(query);
      return matchesName || matchesSku || matchesGroup;
    }) ?? [];

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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedProduct || ''} onValueChange={onSelectProduct}>
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
            {filteredProducts.length} de {products?.length || 0} produtos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
