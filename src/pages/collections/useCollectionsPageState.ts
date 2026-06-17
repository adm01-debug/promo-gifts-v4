/**
 * State management hook for CollectionsPage.
 * Extracts all state, handlers, and computed values from the page component.
 */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionsContext } from '@/contexts/CollectionsContext';
import {
  useExternalCollectionsManager,
  useExternalCollectionProductCounts,
} from '@/hooks/collections';
import { toast } from 'sonner';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import type { ViewMode } from '@/hooks/products';

export function useCollectionsPageState() {
  const navigate = useNavigate();

  const {
    collections: localCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    addProductToCollection,
    getCollectionProducts,
    defaultColors,
    defaultIcons,
  } = useCollectionsContext();

  const { collections: externalCollections, isLoading: isLoadingExternal } =
    useExternalCollectionsManager();

  const externalCollectionIds = useMemo(
    () => externalCollections.map((c) => c.id),
    [externalCollections],
  );
  const { data: externalProductCounts } = useExternalCollectionProductCounts(externalCollectionIds);

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [hintDismissed, setHintDismissed] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    color: string;
    icon: string;
    clientId?: string | null;
    clientName?: string | null;
  }>({
    name: '',
    description: '',
    color: defaultColors[0],
    icon: defaultIcons[0],
    clientId: null,
    clientName: null,
  });

  const isSelectionMode = selectedCollectionIds.size > 0;

  // Selection handlers
  const toggleSelectCollection = useCallback((id: string) => {
    setSelectedCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllLocal = useCallback(() => {
    setSelectedCollectionIds(new Set(localCollections.map((c) => c.id)));
  }, [localCollections]);

  const clearSelection = useCallback(() => setSelectedCollectionIds(new Set()), []);

  const selectedSummary = useMemo(() => {
    const names: string[] = [];
    const productIds = new Set<string>();
    selectedCollectionIds.forEach((colId) => {
      const col = localCollections.find((c) => c.id === colId);
      if (!col) return;
      names.push(col.name);
      getCollectionProducts(colId).forEach((p) => productIds.add(p.id));
    });
    return { names, uniqueProductCount: productIds.size };
  }, [selectedCollectionIds, localCollections, getCollectionProducts]);

  // CRUD handlers
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      color: defaultColors[0],
      icon: defaultIcons[0],
      clientId: null,
      clientName: null,
    });
  }, [defaultColors, defaultIcons]);

  const handleCreate = useCallback(() => {
    if (!formData.name.trim()) return;
    createCollection(
      formData.name,
      formData.description,
      formData.color,
      formData.icon,
      formData.clientId,
      formData.clientName,
    );
    toast.success(`Coleção "${formData.name}" criada`);
    setIsCreateOpen(false);
    resetForm();
  }, [formData, createCollection, resetForm]);

  const handleUpdate = useCallback(() => {
    if (!editingCollection || !formData.name.trim()) return;
    updateCollection(editingCollection, {
      name: formData.name,
      description: formData.description,
      color: formData.color,
      icon: formData.icon,
      clientId: formData.clientId ?? null,
      clientName: formData.clientName ?? null,
    });
    toast.success('Coleção atualizada');
    setEditingCollection(null);
    resetForm();
  }, [editingCollection, formData, updateCollection, resetForm]);

  const handleDelete = useCallback(() => {
    if (!deleteConfirm) return;
    const collection = localCollections.find((c) => c.id === deleteConfirm);
    deleteCollection(deleteConfirm);
    toast.success(`Coleção "${collection?.name}" excluída`);
    setDeleteConfirm(null);
  }, [deleteConfirm, localCollections, deleteCollection]);

  const handleClone = useCallback(
    (collection: (typeof localCollections)[0]) => {
      const cloned = createCollection(
        `${collection.name} (cópia)`,
        collection.description,
        collection.color,
        collection.icon,
      );
      const items = collection.productItems ?? [];
      if (items.length > 0) {
        setTimeout(() => {
          items.forEach((item) => addProductToCollection(cloned.id, item.productId, item.variant));
        }, 300);
      }
      toast.success(`Coleção "${collection.name}" duplicada com ${items.length} produtos`);
    },
    [createCollection, addProductToCollection],
  );

  const openEdit = useCallback((collection: (typeof localCollections)[0]) => {
    setFormData({
      name: collection.name,
      description: collection.description ?? '',
      color: collection.color,
      icon: collection.icon,
      clientId: collection.clientId ?? null,
      clientName: collection.clientName ?? null,
    });
    setEditingCollection(collection.id);
  }, []);

  const handleSendSelectedToQuote = useCallback(() => {
    const allProducts: Array<{
      product_id: string;
      product_name: string;
      product_sku: string | null;
      product_image_url: string | null;
      unit_price: number;
      quantity: number;
    }> = [];
    const collectionNames: string[] = [];

    selectedCollectionIds.forEach((colId) => {
      const col = localCollections.find((c) => c.id === colId);
      if (!col) return;
      collectionNames.push(col.name);
      getCollectionProducts(colId).forEach((p) => {
        if (!allProducts.some((x) => x.product_id === p.id)) {
          allProducts.push({
            product_id: p.id,
            product_name: p.name,
            product_sku: p.sku || null,
            product_image_url: p.images?.[0] || null,
            unit_price: p.price || 0,
            quantity: 1,
          });
        }
      });
    });

    if (allProducts.length === 0) {
      toast.error('As coleções selecionadas não possuem produtos');
      return;
    }

    navigate('/orcamentos/novo', {
      state: { fromCollection: collectionNames.join(', '), preloadProducts: allProducts },
    });
  }, [selectedCollectionIds, localCollections, getCollectionProducts, navigate]);

  // Computed values
  const totalProducts = useMemo(
    () => localCollections.reduce((acc, col) => acc + col.productIds.length, 0),
    [localCollections],
  );
  const totalCollections = localCollections.length + externalCollections.length;

  const gridClasses = useMemo(() => {
    if (viewMode === 'list') return 'flex flex-col gap-2';
    if (viewMode === 'table') return '';
    const colMap: Record<ColumnCount, string> = {
      3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
      4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
      5: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4',
      6: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3',
      8: 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3',
    };
    return colMap[gridColumns] || colMap[4];
  }, [viewMode, gridColumns]);

  const filteredExternal = useMemo(() => {
    if (!searchQuery.trim()) return externalCollections;
    // FIX 2026-06-15 (collections-search-accent): NFD strip.
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const q = norm(searchQuery.trim());
    return externalCollections.filter(
      (c) => norm(c.name).includes(q) || (c.description && norm(c.description).includes(q)),
    );
  }, [externalCollections, searchQuery]);

  const filteredLocal = useMemo(() => {
    if (!searchQuery.trim()) return localCollections;
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const q = norm(searchQuery.trim());
    return localCollections.filter(
      (c) => norm(c.name).includes(q) || (c.description && norm(c.description).includes(q)),
    );
  }, [localCollections, searchQuery]);

  return {
    // Collections data
    localCollections,
    externalCollections,
    externalProductCounts,
    isLoadingExternal,
    getCollectionProducts,
    defaultColors,
    defaultIcons,

    // UI state
    isCreateOpen,
    setIsCreateOpen,
    editingCollection,
    setEditingCollection,
    deleteConfirm,
    setDeleteConfirm,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    gridColumns,
    setGridColumns,
    selectedCollectionIds,
    hintDismissed,
    setHintDismissed,
    formData,
    setFormData,
    isSelectionMode,

    // Handlers
    toggleSelectCollection,
    selectAllLocal,
    clearSelection,
    createCollection,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleClone,
    openEdit,
    handleSendSelectedToQuote,
    resetForm,
    updateCollection,

    // Computed
    selectedSummary,
    totalProducts,
    totalCollections,
    gridClasses,
    filteredExternal,
    filteredLocal,

    // Navigation
    navigate,
  };
}
