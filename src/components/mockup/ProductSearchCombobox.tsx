import * as React from "react";
import Fuse from "fuse.js";
import { Check, ChevronsUpDown, Package, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/common";
import { createProductFuseOptions, rankProductSearchResults } from "@/utils/product-search";

interface Product {
  id: string;
  name: string;
  sku: string;
  images?: unknown;
  primary_image_url?: string | null;
  og_image_url?: string | null;
}

interface ProductSearchComboboxProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelect: (product: Product | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ProductSearchCombobox({
  products,
  selectedProduct,
  onSelect,
  disabled = false,
  placeholder = "Buscar produto...",
  className,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const fuse = React.useMemo(() => new Fuse(products, createProductFuseOptions<Product>()), [products]);

  const filteredProducts = React.useMemo(() => {
    setIsSearching(false);
    if (!debouncedSearch.trim() || debouncedSearch.trim().length < 2) return products;
    return rankProductSearchResults(products, debouncedSearch.trim(), fuse);
  }, [products, debouncedSearch, fuse]);

  // Show searching indicator when typing
  React.useEffect(() => {
    if (search !== debouncedSearch) {
      setIsSearching(true);
    }
  }, [search, debouncedSearch]);

  const getProductImage = (product: Product): string | null => {
    // Prioridade: og_image_url > primary_image_url > images[0]
    if (product.og_image_url) return product.og_image_url;
    if (product.primary_image_url) return product.primary_image_url;
    if (!product.images) return null;
    const images = Array.isArray(product.images) ? product.images : [];
    return images.length > 0 ? String(images[0]) : null;
  };

  const handleSelect = (product: Product) => {
    onSelect(product);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid="mockup-product-combobox-trigger"
          className={cn(
            "w-full justify-between h-auto min-h-[42px] py-2 px-3 font-normal",
            !selectedProduct && "text-muted-foreground",
            className
          )}
        >
          {selectedProduct ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Product thumbnail */}
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted overflow-hidden">
                {getProductImage(selectedProduct) ? (
                  <img
                    src={getProductImage(selectedProduct)!}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Product info */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedProduct.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  SKU: {selectedProduct.sku}
                </p>
              </div>

              {/* Clear button */}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleClear}
               aria-label="Fechar"><X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={-42}>
        <Command shouldFilter={false}>
          <CommandInput
            data-testid="mockup-product-search-input"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-[400px]">
            {isSearching ? (
              <div className="py-6 text-center">
                <Loader2 className="h-6 w-6 mx-auto mb-2 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Buscando...</p>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-6 text-center">
                    <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum produto encontrado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tente buscar por nome ou SKU
                    </p>
                  </div>
                </CommandEmpty>

            <CommandGroup
              heading={
                search
                  ? `${filteredProducts.length} produto(s) encontrado(s)`
                  : "Produtos recentes"
              }
            >
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  data-testid={`mockup-product-option-${product.id}`}
                  onSelect={() => handleSelect(product)}
                  className="flex items-center gap-3 py-2"
                >
                  {/* Checkbox indicator */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center",
                      selectedProduct?.id === product.id
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {selectedProduct?.id === product.id && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>

                  {/* Product thumbnail */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-md bg-muted overflow-hidden">
                    {getProductImage(product) ? (
                      <img
                        src={getProductImage(product)!}
                        alt={product.name}
                        className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {product.sku}
                      </Badge>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
