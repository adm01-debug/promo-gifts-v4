/**
 * ProductVariantsSection — CRUD de variações de cor de um produto
 * Refactored: logic in useProductVariants, form in VariantForm.
 */
import { Palette, Package, AlertCircle, Plus, Pencil, Trash2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VariantGridMatrix } from '@/components/products/VariantGridMatrix';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useProductVariants } from './useProductVariants';
import { VariantForm } from './VariantForm';

interface ProductVariantsSectionProps {
  productId: string;
  productName?: string;
  productSku?: string;
}

function StockBadge({ stock }: { stock: number | null }) {
  const qty = stock ?? 0;
  if (qty === 0)
    return (
      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
        Estoque zerado
      </Badge>
    );
  if (qty < 100)
    return (
      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
        {qty} un
      </Badge>
    );
  return (
    <Badge className="border-primary/30 bg-primary/15 px-1.5 py-0 text-[10px] text-primary">
      {qty >= 1000 ? `${(qty / 1000).toFixed(1)}k` : qty} un
    </Badge>
  );
}

function isLightColor(hex: string | null) {
  if (!hex) return true;
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

export function ProductVariantsSection({
  productId,
  productName,
  productSku,
}: ProductVariantsSectionProps) {
  const m = useProductVariants(productId, productName, productSku);

  if (m.isLoading)
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  if (m.error)
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        Erro ao carregar variações
      </div>
    );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {m.variants.length > 0 ? (
            <>
              <span className="font-medium text-foreground">{m.variants.length} variações</span>
              <span>•</span>
              <span>
                Estoque total:{' '}
                <span className="font-medium text-foreground">
                  {m.totalStock >= 1000
                    ? `${(m.totalStock / 1000).toFixed(1)}k`
                    : m.totalStock.toLocaleString('pt-BR')}{' '}
                  un
                </span>
              </span>
            </>
          ) : (
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Nenhuma variação cadastrada
            </span>
          )}
        </div>
        {!m.isCreating && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              m.setIsCreating(true);
              m.setEditingId(null);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Nova Variação
          </Button>
        )}
      </div>

      {/* Swatches */}
      {m.variants.length > 0 && (
        <TooltipProvider>
          <div className="flex flex-wrap gap-2.5">
            {m.variants.map((v) => {
              const hex = v.color_hex;
              const isTransparent = !hex || hex.toLowerCase() === '#ffffff';
              const light = isLightColor(hex);
              const stock = v.stock_quantity ?? 0;
              const stockLabel = stock >= 1000 ? `${(stock / 1000).toFixed(1)}k` : stock.toString();
              return (
                <Tooltip key={v.id}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          m.setEditingId(v.id);
                          m.setIsCreating(false);
                        }}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2',
                          m.editingId === v.id
                            ? 'ring-2 ring-offset-1'
                            : 'border-border hover:border-muted-foreground/50',
                          isTransparent && 'bg-gradient-to-br from-muted to-muted/60',
                          !stock && 'opacity-40',
                        )}
                        style={{
                          backgroundColor: isTransparent ? undefined : hex || 'hsl(var(--muted))',
                          ...(m.editingId === v.id
                            ? {
                                borderColor: hex || 'hsl(var(--muted))',
                                ['--tw-ring-color' as string]: hex || 'hsl(var(--primary))',
                              }
                            : {}),
                        }}
                      >
                        {m.editingId === v.id && (
                          <Check
                            className={cn('h-4 w-4', light ? 'text-foreground' : 'text-white')}
                          />
                        )}
                      </button>
                      {v.size_code && (
                        <span className="text-[9px] font-medium leading-none text-muted-foreground">
                          {v.size_code}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{v.color_name || v.name}</span>
                      <span className="font-mono text-muted-foreground">{v.sku}</span>
                      {v.size_code && (
                        <span className="text-muted-foreground">
                          Tam: <strong>{v.size_code}</strong>
                        </span>
                      )}
                      {v.capacity_ml && (
                        <span className="text-muted-foreground">{v.capacity_ml}ml</span>
                      )}
                      {v.supplier_sku && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          Forn: {v.supplier_sku}
                        </span>
                      )}
                      {v.ean && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          EAN: {v.ean}
                        </span>
                      )}
                      <span>{stockLabel} un</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* Grid matrix */}
      {m.variants.some((v) => v.size_code) && (
        <VariantGridMatrix
          variants={m.variants.map((v) => ({
            id: v.id,
            color_name: v.color_name || v.name,
            color_hex: v.color_hex || '#888',
            size_code: v.size_code,
            stock: v.stock_quantity ?? 0,
            sku: v.sku,
            image: v.selected_thumbnail,
          }))}
          selectedId={m.editingId}
          onSelect={(item) => {
            m.setEditingId(item.id);
            m.setIsCreating(false);
          }}
          mode="admin"
          compact
          onBulkAction={m.handleBulkAction}
          isBulkLoading={m.isBulkLoading}
        />
      )}

      {/* Create form */}
      {m.isCreating && (
        <VariantForm
          initial={m.createInitial}
          onSave={m.handleCreate}
          onCancel={() => m.setIsCreating(false)}
          isSaving={m.isSaving}
        />
      )}

      {/* Variants list */}
      <div className="space-y-2">
        {m.variants.map((variant) => {
          if (m.editingId === variant.id) {
            return (
              <VariantForm
                key={variant.id}
                initial={{
                  name: variant.name ?? '',
                  sku: variant.sku ?? '',
                  color_name: variant.color_name ?? '',
                  color_hex: variant.color_hex || '#000000',
                  stock_quantity: variant.stock_quantity ?? 0,
                  supplier_sku: variant.supplier_sku ?? '',
                  ean: variant.ean ?? '',
                  size_code: variant.size_code ?? '',
                  capacity_ml: variant.capacity_ml,
                  height_mm: variant.height_mm,
                  width_mm: variant.width_mm,
                  length_mm: variant.length_mm,
                  weight_g: variant.weight_g,
                }}
                onSave={(data) => m.handleUpdate(variant.id, data)}
                onCancel={() => m.setEditingId(null)}
                isSaving={m.isSaving}
              />
            );
          }
          return (
            <div
              key={variant.id}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg border p-2 transition-colors hover:bg-accent/50',
                !variant.stock_quantity && 'opacity-60',
              )}
            >
              {variant.selected_thumbnail ? (
                <img
                  src={variant.selected_thumbnail}
                  alt={variant.color_name || variant.name}
                  className="h-10 w-10 shrink-0 rounded-md border object-cover"
                  loading="lazy"
                />
              ) : variant.color_hex ? (
                <div
                  className="h-10 w-10 shrink-0 rounded-md border"
                  style={{ backgroundColor: variant.color_hex }}
                  title={variant.color_name ?? ''}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-medium"
                  title={variant.color_name || variant.name}
                >
                  {variant.color_name || variant.name}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-mono">{variant.sku}</span>
                  {variant.supplier_sku && (
                    <span className="font-mono">• {variant.supplier_sku}</span>
                  )}
                  {variant.ean && <span className="font-mono">• EAN:{variant.ean}</span>}
                  {variant.size_code && <span>• {variant.size_code}</span>}
                  {variant.capacity_ml && <span>• {variant.capacity_ml}ml</span>}
                </div>
                <StockBadge stock={variant.stock_quantity} />
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Editar"
                  className="h-7 w-7"
                  onClick={() => {
                    m.setEditingId(variant.id);
                    m.setIsCreating(false);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => m.setDeleteTarget(variant)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete dialog */}
      <AlertDialog
        open={!!m.deleteTarget}
        onOpenChange={(open) => !open && m.setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir variação?</AlertDialogTitle>
            <AlertDialogDescription>
              A variação <strong>{m.deleteTarget?.color_name || m.deleteTarget?.name}</strong> (SKU:{' '}
              {m.deleteTarget?.sku}) será desativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={m.handleDelete}
              disabled={m.isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {m.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
