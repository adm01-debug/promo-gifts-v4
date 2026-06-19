/**
 * Gerenciador de Produtos - CRUD completo com Auditoria e Paginação
 * Refatorado: lógica extraída para useProductsManager hook.
 */
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Package,
  ImageIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Power,
  PowerOff,
  Boxes,
} from 'lucide-react';
import { BulkImportDialog } from './products/BulkImportDialog';
import { cn } from '@/lib/utils';
import { m as motion } from 'framer-motion';
import { ProductFiltersBar } from './products/ProductFiltersBar';
import { useProductsManager } from './products/useProductsManager';

export function ProductsManager() {
  const s = useProductsManager();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            Gerenciador de Produtos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre, edite e gerencie os produtos do catálogo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => s.fetchProducts()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => s.setIsImportOpen(true)}
            className="gap-2"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
          <Button
            size="sm"
            onClick={s.openCreateForm}
            data-testid="admin-create-btn"
            className="gap-2 bg-primary shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total',
            value: s.totalCount?.toLocaleString() ?? '—',
            valueClass: '',
            icon: <Package className="h-5 w-5 text-primary" />,
            iconBg: 'bg-primary/10',
          },
          {
            label: 'Ativos',
            value: s.stats.active,
            valueClass: 'text-primary',
            icon: <div className="h-3 w-3 rounded-full bg-primary" />,
            iconBg: 'bg-primary/10',
          },
          {
            label: 'Sem Estoque',
            value: s.stats.noStock,
            valueClass: 'text-warning dark:text-warning',
            icon: <div className="h-3 w-3 rounded-full bg-warning" />,
            iconBg: 'bg-warning/10',
          },
          {
            label: 'Preço Médio',
            value: `R$ ${s.stats.avgPrice.toFixed(0)}`,
            valueClass: '',
            icon: <span className="text-sm font-bold text-primary">$</span>,
            iconBg: 'bg-primary/10',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.08, ease: 'easeOut' }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm transition-shadow duration-200 hover:border-border/70 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className={cn('mt-1 text-2xl font-bold tabular-nums', stat.valueClass)}>
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      stat.iconBg,
                    )}
                  >
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="border-border/40">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou categoria..."
                value={s.searchTerm}
                data-testid="admin-search-input"
                onChange={(e) => s.setSearchTerm(e.target.value)}
                className="h-10 bg-background pl-10"
              />
              {s.searchTerm && (
                <button
                  aria-label="Fechar"
                  onClick={() => s.setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <ProductFiltersBar filters={s.advancedFilters} onChange={s.handleFiltersChange} />
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {s.selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={s.selectedIds.size === s.products.length}
                onCheckedChange={s.toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {s.selectedIds.size} produto(s) selecionado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => s.setSelectedIds(new Set())}
              >
                Limpar seleção
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                disabled={s.isBulkUpdating}
                onClick={() => s.handleBulkToggleActive(true)}
              >
                {s.isBulkUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )}
                Ativar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                disabled={s.isBulkUpdating}
                onClick={() => s.handleBulkToggleActive(false)}
              >
                {s.isBulkUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PowerOff className="h-3.5 w-3.5" />
                )}
                Desativar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-border/40">
        <CardContent className="p-0">
          {s.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando produtos...</p>
              </div>
            </div>
          ) : s.products.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Package className="mx-auto mb-4 h-14 w-14 opacity-30" />
              <p className="font-medium">Nenhum produto encontrado</p>
              <p className="mt-1 text-sm">Tente ajustar os filtros ou o termo de busca</p>
            </div>
          ) : (
            <div data-testid="admin-table" className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={s.selectedIds.size > 0 && s.selectedIds.size === s.products.length}
                        onCheckedChange={s.toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-14">Foto</TableHead>
                    <TableHead className="w-28">SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-28 text-right">Preço</TableHead>
                    <TableHead className="w-24 text-center">Estoque</TableHead>
                    <TableHead className="w-24 text-center">Status</TableHead>
                    <TableHead className="w-20 pr-4 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.products.map((product) => {
                    const stockLevel = product.stock ?? 0;
                    const stockColor =
                      stockLevel <= 0
                        ? 'text-destructive'
                        : stockLevel < 10
                          ? 'text-warning dark:text-warning'
                          : 'text-primary';
                    return (
                      <TableRow
                        key={product.id}
                        data-testid={`admin-row-${product.id}`}
                        className={cn(
                          'group cursor-pointer border-border/30 transition-colors hover:bg-muted/40',
                          s.selectedIds.has(product.id) && 'bg-primary/5',
                        )}
                        onClick={() => s.openEditForm(product)}
                      >
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={s.selectedIds.has(product.id)}
                            onCheckedChange={() => s.toggleSelect(product.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {product.images && product.images.length > 0 ? (
                            <div className="relative">
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="h-12 w-12 rounded-lg border border-border/50 object-cover transition-colors group-hover:border-primary/30"
                                loading="lazy"
                              />
                              {product.images.length > 1 && (
                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-medium">
                                  +{product.images.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/50">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {product.sku}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[280px]">
                            <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                              {product.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1">
                              {product.is_featured && (
                                <Badge
                                  variant="outline"
                                  className="h-4 border-warning/30 px-1 text-[10px] text-warning dark:text-warning"
                                >
                                  ⭐ Destaque
                                </Badge>
                              )}
                              {product.is_new && (
                                <Badge
                                  variant="outline"
                                  className="h-4 border-primary/30 px-1 text-[10px] text-primary"
                                >
                                  Novo
                                </Badge>
                              )}
                              {product.is_kit && (
                                <Badge
                                  variant="outline"
                                  className="h-4 gap-0.5 border-primary/30 bg-primary/10 px-1 text-[10px] text-primary"
                                >
                                  <Boxes className="h-2.5 w-2.5" />
                                  Kit
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold tabular-nums">
                            R$ {product.price?.toFixed(2) ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold tabular-nums ${stockColor}`}>
                            {stockLevel}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {product.is_active ? (
                            <Badge className="border border-primary/20 bg-primary/10 text-[10px] text-primary hover:bg-primary/15">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] opacity-60">
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div
                            className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Editar"
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                              onClick={() => s.openEditForm(product)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Excluir"
                              data-testid="admin-delete-btn"
                              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => s.openDeleteDialog(product)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!s.isLoading && s.products.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-border/40 px-4 py-3 sm:flex-row">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Mostrando <strong className="text-foreground">{s.products.length}</strong> de{' '}
                  <strong className="text-foreground">{s.totalCount?.toLocaleString()}</strong>{' '}
                  produtos
                </span>
                <Select value={String(s.pageSize)} onValueChange={s.handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {s.PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / pág
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={s.currentPage <= 1}
                  onClick={() => s.handlePageChange(s.currentPage - 1)}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, s.totalPages) }, (_, i) => {
                  let page: number;
                  if (s.totalPages <= 5) page = i + 1;
                  else if (s.currentPage <= 3) page = i + 1;
                  else if (s.currentPage >= s.totalPages - 2) page = s.totalPages - 4 + i;
                  else page = s.currentPage - 2 + i;
                  return (
                    <Button
                      key={page}
                      variant={page === s.currentPage ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => s.handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={s.currentPage >= s.totalPages}
                  onClick={() => s.handlePageChange(s.currentPage + 1)}
                  className="h-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={s.isDeleteOpen} onOpenChange={s.setIsDeleteOpen}>
        <AlertDialogContent data-testid="admin-confirm-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{s.selectedProduct?.name}" (
              {s.selectedProduct?.sku})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={s.handleDelete}
              data-testid="admin-confirm-delete-btn"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <BulkImportDialog
        open={s.isImportOpen}
        onOpenChange={s.setIsImportOpen}
        onComplete={() => s.fetchProducts()}
      />
    </div>
  );
}
