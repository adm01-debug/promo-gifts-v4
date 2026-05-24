import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, FolderOpen, Package,
  Search, Star, FolderHeart,
  FileText, CheckSquare, X, Sparkles, ArrowRight,
} from "lucide-react";
import { CollectionGridCard } from "@/components/collections/CollectionGridCard";
import { CollectionListItem } from "@/components/collections/CollectionListItem";
import { CollectionTableView } from "@/components/collections/CollectionTableView";
import { ExternalCollectionTableView } from "@/components/collections/ExternalCollectionTableView";
import { CollectionFormDialog } from "@/components/collections/CollectionFormDialog";
import { ExternalCollectionCard } from "@/components/collections/ExternalCollectionCard";
import { CollectionsHeatmap } from "@/components/collections/CollectionsHeatmap";
import { CollectionsEmptyStateSmart } from "@/components/collections/CollectionsEmptyStateSmart";
import { useCollectionsGlobalShortcuts } from "@/hooks/favorites";
import { PageSEO } from "@/components/seo/PageSEO";
import { Button } from "@/components/ui/button";
import { LayoutPopover } from "@/components/products/LayoutPopover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCollectionsPageState } from "@/pages/collections/useCollectionsPageState";

function relativeTime(dateStr: string | undefined) {
  if (!dateStr) return null;
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
}

export default function CollectionsPage() {
  useCollectionsGlobalShortcuts();
  const state = useCollectionsPageState();

  const {
    localCollections, externalCollections, externalProductCounts, isLoadingExternal,
    getCollectionProducts, defaultColors, defaultIcons,
    isCreateOpen, setIsCreateOpen, editingCollection, setEditingCollection,
    deleteConfirm, setDeleteConfirm, searchQuery, setSearchQuery,
    viewMode, setViewMode, gridColumns, setGridColumns,
    selectedCollectionIds, hintDismissed, setHintDismissed,
    formData, setFormData, isSelectionMode,
    toggleSelectCollection, selectAllLocal, clearSelection,
    createCollection, handleCreate, handleUpdate, handleDelete, handleClone, openEdit,
    handleSendSelectedToQuote, resetForm, updateCollection,
    selectedSummary, totalProducts, totalCollections,
    gridClasses, filteredExternal, filteredLocal, navigate,
  } = state;

  return (
      <>
        <PageSEO title="Coleções" description="Organize seus produtos favoritos em coleções personalizadas." path="/colecoes" />
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: FolderHeart, value: totalCollections, label: "Total Coleções", color: "text-primary" },
              { icon: FolderOpen, value: externalCollections.length, label: "Coleções Catálogo", color: "text-blue-500" },
              { icon: Star, value: localCollections.length, label: "Minhas Coleções", color: "text-amber-500" },
              { icon: Package, value: totalProducts, label: "Produtos", color: "text-emerald-500" },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, type: "spring", stiffness: 400, damping: 25 }}
                className="stat-card flex items-center gap-3 group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-default"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <Button size="sm" className="h-8 px-3 text-xs" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Nova Coleção
            </Button>
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar coleções..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <CollectionsHeatmap />
              {localCollections.length > 0 && (
                <Button
                  size="sm"
                  variant={isSelectionMode ? "default" : "outline"}
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => {
                    if (isSelectionMode) {
                      clearSelection();
                    } else {
                      toggleSelectCollection(localCollections[0].id);
                    }
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {isSelectionMode ? "Selecionando" : "Selecionar"}
                </Button>
              )}
              <LayoutPopover viewMode={viewMode} setViewMode={setViewMode} gridColumns={gridColumns} setGridColumns={setGridColumns} />
            </div>
          </div>

          {/* Selection Action Bar */}
          <AnimatePresence>
            {isSelectionMode && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-30 rounded-xl overflow-hidden"
              >
                <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-2 border-primary/30 backdrop-blur-xl rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <motion.div
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 600, damping: 25 }}
                      >
                        <span className="font-display font-bold text-lg">{selectedCollectionIds.size}</span>
                      </motion.div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-foreground">
                          {selectedCollectionIds.size} coleção{selectedCollectionIds.size > 1 ? "ões" : ""} selecionada{selectedCollectionIds.size > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {selectedSummary.uniqueProductCount > 0 ? (
                            <>
                              <Package className="h-3 w-3 inline mr-1" />
                              {selectedSummary.uniqueProductCount} produto{selectedSummary.uniqueProductCount > 1 ? "s" : ""} únicos
                              {selectedSummary.names.length <= 3 && <> · {selectedSummary.names.join(", ")}</>}
                            </>
                          ) : "Nenhum produto nas coleções selecionadas"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCollectionIds.size < localCollections.length && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                          <Button size="sm" variant="ghost" onClick={selectAllLocal} className="gap-1.5 text-xs">
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Selecionar Todas</span>
                          </Button>
                        </motion.div>
                      )}
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                        <Button size="default" className="gap-2 font-semibold shadow-lg hover:shadow-xl transition-shadow" onClick={handleSendSelectedToQuote} disabled={selectedSummary.uniqueProductCount === 0}>
                          <FileText className="h-4 w-4" />
                          Criar Orçamento
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                        <Button size="sm" variant="outline" onClick={clearSelection} className="gap-1.5 text-xs hover:text-destructive hover:border-destructive/50 transition-colors">
                          <X className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint bar */}
          <AnimatePresence>
            {!isSelectionMode && !hintDismissed && localCollections.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/40 border border-border/50"
              >
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">Dica:</span> Selecione coleções marcando o checkbox nos cards para enviar todos os produtos para um orçamento de uma vez.
                </p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setHintDismissed(true)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personal Collections */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderHeart className="h-4 w-4 text-primary" />
              <h2 data-testid="page-title-colecoes" className="font-display text-lg font-semibold">Minhas Coleções</h2>
              <Badge variant="secondary" className="text-xs">{localCollections.length}</Badge>
            </div>

            {filteredLocal.length > 0 ? (
              viewMode === "table" ? (
                <CollectionTableView
                  collections={filteredLocal}
                  getCollectionProducts={getCollectionProducts}
                  selectedCollectionIds={selectedCollectionIds}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={(id) => toggleSelectCollection(id)}
                  onNavigate={(id) => navigate(`/colecoes/${id}`)}
                  onEdit={(col) => openEdit(col)}
                  onClone={(col) => handleClone(col)}
                  onToggleFeatured={(col) => updateCollection(col.id, { isFeatured: !col.isFeatured })}
                  onDelete={(id) => setDeleteConfirm(id)}
                  relativeTime={relativeTime}
                />
              ) : (
                <div className={gridClasses}>
                  {filteredLocal.map((collection, idx) => {
                    const products = getCollectionProducts(collection.id);
                    const updatedAgo = relativeTime(collection.updatedAt);
                    const isSelected = selectedCollectionIds.has(collection.id);
                    const sharedProps = {
                      collection,
                      isSelected,
                      onToggleSelect: () => toggleSelectCollection(collection.id),
                      onNavigate: () => navigate(`/colecoes/${collection.id}`),
                      onEdit: () => openEdit(collection),
                      onClone: () => handleClone(collection),
                      onToggleFeatured: () => {
                        updateCollection(collection.id, { isFeatured: !collection.isFeatured });
                      },
                      onDelete: () => setDeleteConfirm(collection.id),
                      updatedAgo,
                      index: idx,
                    };

                    if (viewMode === "list") {
                      return <CollectionListItem key={collection.id} previewImage={products[0]?.images?.[0]} {...sharedProps} />;
                    }
                    return <CollectionGridCard key={collection.id} products={products} isSelectionMode={isSelectionMode} {...sharedProps} />;
                  })}
                </div>
              )
            ) : localCollections.length > 0 && searchQuery ? (
              <div className="text-center py-12 bg-muted/20 rounded-xl border-[1.5px] border-dashed border-primary/10">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-1">Nenhuma coleção encontrada</h3>
                <p className="text-muted-foreground text-sm">Nenhuma coleção corresponde a "{searchQuery}"</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <CollectionsEmptyStateSmart onAddProduct={() => setIsCreateOpen(true)} />
              </motion.div>
            )}
          </div>

          {/* External Collections */}
          {(externalCollections.length > 0 || isLoadingExternal) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Coleções do Catálogo</h2>
              </div>
              {isLoadingExternal ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
                </div>
              ) : (
                viewMode === "table" ? (
                  <ExternalCollectionTableView
                    collections={filteredExternal}
                    productCounts={externalProductCounts}
                    onNavigate={(id) => navigate(`/colecoes/${id}`)}
                    onDuplicate={(col) => {
                      createCollection(col.name, col.description || undefined, col.color || defaultColors[0], col.icon || defaultIcons[0]);
                    }}
                  />
                ) : (
                  <div className={gridClasses}>
                    {filteredExternal.map((collection, idx) => (
                      <ExternalCollectionCard
                        key={collection.id}
                        collection={collection}
                        productCount={externalProductCounts?.get(collection.id)}
                        viewMode={viewMode === "list" ? "list" : "grid"}
                        onNavigate={() => navigate(`/colecoes/${collection.id}`)}
                        onDuplicate={() => {
                          createCollection(collection.name, collection.description || undefined, collection.color || defaultColors[0], collection.icon || defaultIcons[0]);
                        }}
                        index={idx}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <CollectionFormDialog
          open={isCreateOpen || !!editingCollection}
          isEditing={!!editingCollection}
          formData={formData}
          onFormChange={setFormData}
          onSubmit={editingCollection ? handleUpdate : handleCreate}
          onClose={() => { setIsCreateOpen(false); setEditingCollection(null); resetForm(); }}
          defaultColors={defaultColors}
          defaultIcons={defaultIcons}
        />

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir coleção?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Os produtos não serão excluídos, apenas removidos desta coleção.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
  );
}
