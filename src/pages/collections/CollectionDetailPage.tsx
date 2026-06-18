import { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Trash2,
  Search,
  TrendingDown,
  FileText,
  ArrowUpDown,
  ArrowRight,
  CheckSquare,
  Settings2,
} from 'lucide-react';
import { m as motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { PageSEO } from '@/components/seo/PageSEO';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductTableView } from '@/components/products/ProductTableView';
import { ProductListItem } from '@/components/products/ProductListItem';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkSelectionBar } from '@/components/common/BulkSelectionBar';
import { CollectionDetailHeader } from '@/components/collections/CollectionDetailHeader';
import { SortableProductItem } from '@/components/collections/SortableProductItem';
import { ShareCollectionDialog } from '@/components/collections/ShareCollectionDialog';
import { CollectionPresentationLauncher } from '@/components/collections/CollectionPresentationLauncher';
import { CollectionsTrashView } from '@/components/collections/CollectionsTrashView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCollectionsContext } from '@/contexts/CollectionsContext';
import { useProductsContext } from '@/contexts/ProductsContext';
import { useExternalCollections, useExternalCollectionProducts } from '@/hooks/collections';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type SortOption = 'name' | 'sku' | 'added';
type ViewMode = 'grid' | 'list' | 'table';

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    collections,
    getCollectionProducts,
    getCollectionProductItems,
    removeProductFromCollection,
    reorderProducts,
    updateProductNotes,
    restoreFromTrash,
  } = useCollectionsContext();
  const { getProductsByIds, products: _cacheSignal } = useProductsContext();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { isInCompare, toggleCompare, canAddMore } = useComparisonStore();
  const [showPresentation, setShowPresentation] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('added');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionModeActive, setSelectionModeActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);
  const [manageMode, setManageMode] = useState(false);
  const [onlyDrops, setOnlyDrops] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'trash'>('products');
  const [trashCount, setTrashCount] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // --- Local collection lookup ---
  const localCollection = useMemo(() => collections.find((c) => c.id === id), [collections, id]);

  // --- External collection lookup ---
  const { data: externalCollections = [] } = useExternalCollections();
  const externalCollection = useMemo(() => {
    if (localCollection) return null;
    return externalCollections.find((c) => c.id === id) ?? null;
  }, [localCollection, externalCollections, id]);

  const isExternal = !!externalCollection;

  const { data: externalProductLinks = [], isLoading: isLoadingExternalProducts } =
    useExternalCollectionProducts(isExternal ? (id ?? null) : null);

  const externalProductIds = useMemo(
    () => externalProductLinks.map((link) => link.product_id),
    [externalProductLinks],
  );
  const externalProducts = useMemo(
    () => (isExternal ? getProductsByIds(externalProductIds) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isExternal, externalProductIds, getProductsByIds, _cacheSignal],
  );

  // --- Unified collection data ---
  const collection = useMemo(() => {
    if (localCollection) {
      return {
        id: localCollection.id,
        name: localCollection.name,
        description: localCollection.description,
        color: localCollection.color,
        icon: localCollection.icon,
        isFeatured: localCollection.isFeatured,
        updatedAt: localCollection.updatedAt,
        isExternal: false as const,
      };
    }
    if (externalCollection) {
      return {
        id: externalCollection.id,
        name: externalCollection.name,
        description: externalCollection.description || undefined,
        color: externalCollection.icon_color || '#3B82F6',
        icon: externalCollection.icon || '📁',
        isFeatured: externalCollection.is_featured ?? false,
        updatedAt: externalCollection.updated_at,
        isExternal: true as const,
      };
    }
    return null;
  }, [localCollection, externalCollection]);

  // --- Products ---
  const products = useMemo(() => {
    if (!id) return [];
    if (isExternal) return externalProducts;
    return getCollectionProducts(id);
  }, [id, isExternal, externalProducts, getCollectionProducts]);

  const collectionItems = useMemo(() => {
    if (!id || isExternal) return [];
    return getCollectionProductItems(id);
  }, [id, isExternal, getCollectionProductItems]);

  const variantMap = useMemo(() => {
    const map = new Map<
      string,
      { color_name?: string | null; color_hex?: string | null; thumbnail?: string | null }
    >();
    collectionItems.forEach((item) => {
      if (item.variant) map.set(item.productId, item.variant);
    });
    return map;
  }, [collectionItems]);

  const priceAtSaveMap = useMemo(() => {
    const map = new Map<string, number | null>();
    collectionItems.forEach((it) => map.set(it.productId, it.priceAtSave ?? null));
    return map;
  }, [collectionItems]);

  const addedAtMap = useMemo(() => {
    const map = new Map<string, string | null>();
    collectionItems.forEach((it) => map.set(it.productId, it.addedAt ?? null));
    return map;
  }, [collectionItems]);

  const notesMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    collectionItems.forEach((it) => map.set(it.productId, it.notes));
    return map;
  }, [collectionItems]);

  const isSelectionMode = selectionModeActive || selectedIds.size > 0;

  const toggleSelect = useCallback((pid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id)),
    );
  }, [products]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionModeActive(false);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    if (selectionModeActive) {
      setSelectedIds(new Set());
      setSelectionModeActive(false);
    } else {
      setSelectionModeActive(true);
    }
  }, [selectionModeActive]);

  const handleBulkRemove = useCallback(() => {
    if (!id || selectedIds.size === 0) return;
    selectedIds.forEach((pid) => removeProductFromCollection(id, pid));
    toast.success(`${selectedIds.size} produto(s) removido(s)`);
    setSelectedIds(new Set());
  }, [id, selectedIds, removeProductFromCollection]);

  const handleBulkQuote = useCallback(() => {
    if (!collection || selectedIds.size === 0) return;
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    navigate('/orcamentos/novo', {
      state: {
        fromCollection: collection.name,
        preloadProducts: selectedProducts.map((p) => ({
          product_id: p.id,
          product_name: p.name,
          product_sku: p.sku || null,
          product_image_url: p.images?.[0] || null,
          unit_price: p.price || 0,
          quantity: 1,
          color_name: variantMap.get(p.id)?.color_name || null,
          color_hex: variantMap.get(p.id)?.color_hex || null,
        })),
      },
    });
  }, [collection, selectedIds, products, variantMap, navigate]);

  // Filter + sort
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q),
      );
    }
    if (onlyDrops) {
      filtered = filtered.filter((p) => {
        const saved = priceAtSaveMap.get(p.id);
        if (!saved || !p.price) return false;
        return ((p.price - saved) / saved) * 100 <= -2;
      });
    }
    if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'sku')
      filtered = [...filtered].sort((a, b) => (a.sku ?? '').localeCompare(b.sku ?? ''));
    return filtered;
  }, [products, searchQuery, sortBy, onlyDrops, priceAtSaveMap]);

  const priceDropCount = useMemo(() => {
    let n = 0;
    products.forEach((p) => {
      const saved = priceAtSaveMap.get(p.id);
      if (saved && p.price && ((p.price - saved) / saved) * 100 <= -2) n++;
    });
    return n;
  }, [products, priceAtSaveMap]);

  const productsWithVariant = useMemo(() => {
    return filteredProducts.map((product) => {
      const variant = variantMap.get(product.id);
      if (variant?.thumbnail) return { ...product, images: [variant.thumbnail, ...product.images] };
      return product;
    });
  }, [filteredProducts, variantMap]);

  const updatedAgo = useMemo(() => {
    if (!collection?.updatedAt) return null;
    try {
      return formatDistanceToNow(new Date(collection.updatedAt), { addSuffix: true, locale: ptBR });
    } catch {
      return null;
    }
  }, [collection?.updatedAt]);

  // Loading state for external collections
  if (isExternal && isLoadingExternalProducts) {
    return (
      <div className="mx-auto w-full max-w-[1920px] space-y-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="py-16 text-center">
        <h2 className="mb-4 font-display text-xl font-semibold">Coleção não encontrada</h2>
        <Button onClick={() => navigate('/colecoes')}>Voltar para coleções</Button>
      </div>
    );
  }

  const handleRemoveFromCollection = (productId: string) => {
    removeProductFromCollection(collection.id, productId);
    setAnnouncement(`Produto removido da coleção ${collection.name}`);
    toast.success('Produto removido da coleção', {
      action: {
        label: 'Desfazer',
        onClick: async () => {
          const ok = await restoreFromTrash(collection.id, productId);
          if (ok) {
            setAnnouncement('Produto restaurado');
            toast.success('Produto restaurado');
          } else toast.error('Não foi possível restaurar');
        },
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredProducts.findIndex((p) => p.id === active.id);
    const newIndex = filteredProducts.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const ordered = arrayMove(
      filteredProducts.map((p) => p.id),
      oldIndex,
      newIndex,
    );
    reorderProducts(collection.id, ordered);
  };

  const handleCreateQuote = () => {
    const localCol = collections.find((c) => c.id === collection.id);
    navigate('/orcamentos/novo', {
      state: {
        fromCollection: collection.name,
        clientId: localCol?.clientId ?? null,
        clientName: localCol?.clientName ?? null,
        preloadProducts: products.map((p) => ({
          product_id: p.id,
          product_name: p.name,
          product_sku: p.sku,
          product_image_url: p.images?.[0] || null,
          unit_price: p.price || 0,
          quantity: 1,
          color_name: variantMap.get(p.id)?.color_name || null,
          color_hex: variantMap.get(p.id)?.color_hex || null,
        })),
      },
    });
  };

  const sortLabel = sortBy === 'name' ? 'Nome' : sortBy === 'sku' ? 'SKU' : 'Adicionados';

  return (
    <>
      <PageSEO
        title={`Coleção: ${collection.name}`}
        description={`Explore os produtos da coleção ${collection.name}.`}
        path={`/colecoes/${id}`}
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <CollectionDetailHeader
          collection={{ ...collection, clientName: localCollection?.clientName ?? null }}
          productCount={products.length}
          isLoading={isExternal && isLoadingExternalProducts}
          updatedAgo={updatedAgo}
          products={products}
          variantMap={variantMap}
          notesMap={notesMap}
          onBack={() => navigate('/colecoes')}
          onCreateQuote={handleCreateQuote}
          onPresent={() => setShowPresentation(true)}
          onShare={() => setShowShareDialog(true)}
          showShare={!isExternal}
        />

        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <BulkSelectionBar
          isActive={isSelectionMode}
          selectedCount={selectedIds.size}
          label={`${selectedIds.size} produto${selectedIds.size > 1 ? 's' : ''} selecionado${selectedIds.size > 1 ? 's' : ''}`}
          subtitle={`Da coleção "${collection.name}"`}
          totalCount={products.length}
          onSelectAll={toggleSelectAll}
          onClear={clearSelection}
          actions={
            <>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Button
                  size="default"
                  className="gap-2 font-semibold shadow-lg transition-shadow hover:shadow-xl"
                  onClick={handleBulkQuote}
                >
                  <FileText className="h-4 w-4" />
                  Orçamento ({selectedIds.size})
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                  onClick={handleBulkRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
              </motion.div>
            </>
          }
        />

        {/* Search + Sort toolbar */}
        {products.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar na coleção..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('added')}>
                  Ordem de adição
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name')}>Nome A-Z</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('sku')}>SKU</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!isExternal && (
              <>
                <Button
                  variant={isSelectionMode ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  onClick={toggleSelectionMode}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {isSelectionMode ? 'Selecionando' : 'Selecionar'}
                </Button>
                <Button
                  variant={manageMode ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  onClick={() => setManageMode((v) => !v)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {manageMode ? 'Gerenciando' : 'Gerenciar'}
                </Button>
                {priceDropCount > 0 && (
                  <Button
                    variant={onlyDrops ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => setOnlyDrops((v) => !v)}
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    Só com queda ({priceDropCount})
                  </Button>
                )}
              </>
            )}
            <div className="hidden sm:block">
              <LayoutPopover
                viewMode={viewMode}
                setViewMode={setViewMode}
                gridColumns={gridColumns}
                setGridColumns={setGridColumns}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredProducts.length === products.length
                ? `${products.length} produtos`
                : `${filteredProducts.length} de ${products.length}`}
            </p>
          </div>
        )}

        {/* Products + Trash tabs */}
        {!isExternal ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'products' | 'trash')}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="products" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Produtos ({products.length})
              </TabsTrigger>
              <TabsTrigger value="trash" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Lixeira{trashCount > 0 && ` (${trashCount})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              {products.length > 0 ? (
                filteredProducts.length > 0 ? (
                  manageMode ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={filteredProducts.map((p) => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {filteredProducts.map((p) => (
                            <SortableProductItem
                              key={p.id}
                              product={p}
                              variant={variantMap.get(p.id)}
                              priceAtSave={priceAtSaveMap.get(p.id)}
                              addedAt={addedAtMap.get(p.id)}
                              notes={notesMap.get(p.id)}
                              onNotesChange={(notes) =>
                                updateProductNotes(collection.id, p.id, notes)
                              }
                              isSelected={selectedIds.has(p.id)}
                              onToggleSelect={() => toggleSelect(p.id)}
                              onRemove={() => handleRemoveFromCollection(p.id)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : viewMode === 'table' ? (
                    <ProductTableView
                      products={productsWithVariant}
                      onProductClick={(productId) => navigate(`/produto/${productId}`)}
                      isFavorite={isFavorite}
                      onToggleFavorite={toggleFavorite}
                      isInCompare={isInCompare}
                      onToggleCompare={toggleCompare}
                      canAddToCompare={canAddMore}
                      selectionMode={isSelectionMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                  ) : viewMode === 'list' ? (
                    <div className="space-y-1.5">
                      {productsWithVariant.map((product) => (
                        <ProductListItem
                          key={product.id}
                          product={product}
                          onClick={() => navigate(`/produto/${product.id}`)}
                          isFavorited={isFavorite(product.id)}
                          onToggleFavorite={toggleFavorite}
                          isInCompare={isInCompare(product.id)}
                          onToggleCompare={toggleCompare}
                          canAddToCompare={canAddMore}
                        />
                      ))}
                    </div>
                  ) : (
                    <ProductGrid
                      products={productsWithVariant}
                      onProductClick={(productId) => navigate(`/produto/${productId}`)}
                      isFavorite={isFavorite}
                      onToggleFavorite={toggleFavorite}
                      isInCompare={isInCompare}
                      onToggleCompare={toggleCompare}
                      canAddToCompare={canAddMore}
                      columns={gridColumns}
                      selectionMode={isSelectionMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                  )
                ) : (
                  <div className="rounded-xl border-[1.5px] border-dashed border-primary/10 bg-muted/20 py-12 text-center">
                    <Search className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-1 font-display text-lg font-semibold">
                      Nenhum produto encontrado
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {onlyDrops
                        ? 'Nenhum produto com queda de preço'
                        : `Nenhum produto corresponde a "${searchQuery}"`}
                    </p>
                  </div>
                )
              ) : (
                <div className="rounded-xl border-[1.5px] border-dashed border-primary/10 bg-muted/20 py-16 text-center">
                  <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                  <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                    Coleção vazia
                  </h3>
                  <p className="mx-auto mb-6 max-w-md text-muted-foreground">
                    Adicione produtos a esta coleção clicando no ícone de pasta nos cards de produto
                  </p>
                  <Button onClick={() => navigate('/')}>Explorar produtos</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="trash">
              <CollectionsTrashView collectionId={collection.id} onCountChange={setTrashCount} />
            </TabsContent>
          </Tabs>
        ) : products.length > 0 ? (
          <div className="space-y-4">
            {viewMode === 'table' ? (
              <ProductTableView
                products={productsWithVariant}
                onProductClick={(productId) => navigate(`/produto/${productId}`)}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                isInCompare={isInCompare}
                onToggleCompare={toggleCompare}
                canAddToCompare={canAddMore}
              />
            ) : viewMode === 'list' ? (
              <div className="space-y-1.5">
                {productsWithVariant.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    onClick={() => navigate(`/produto/${product.id}`)}
                    isFavorited={isFavorite(product.id)}
                    onToggleFavorite={toggleFavorite}
                    isInCompare={isInCompare(product.id)}
                    onToggleCompare={toggleCompare}
                    canAddToCompare={canAddMore}
                  />
                ))}
              </div>
            ) : (
              <ProductGrid
                products={productsWithVariant}
                onProductClick={(productId) => navigate(`/produto/${productId}`)}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                isInCompare={isInCompare}
                onToggleCompare={toggleCompare}
                canAddToCompare={canAddMore}
                columns={gridColumns}
              />
            )}
          </div>
        ) : (
          <div className="rounded-xl border-[1.5px] border-dashed border-primary/10 bg-muted/20 py-16 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
              Nenhum produto nesta coleção
            </h3>
            <p className="mx-auto mb-6 max-w-md text-muted-foreground">
              Esta coleção do catálogo ainda não possui produtos vinculados.
            </p>
            <Button onClick={() => navigate('/colecoes')}>Voltar para coleções</Button>
          </div>
        )}
      </div>

      {showPresentation && products.length > 0 && (
        <CollectionPresentationLauncher
          products={products}
          collectionName={collection.name}
          onClose={() => setShowPresentation(false)}
        />
      )}

      {localCollection && (
        <ShareCollectionDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          collectionId={localCollection.id}
          collectionName={localCollection.name}
          shareToken={localCollection.shareToken}
          shareExpiresAt={localCollection.shareExpiresAt}
          isPublic={localCollection.isPublic}
        />
      )}
    </>
  );
}
