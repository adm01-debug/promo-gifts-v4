/**
 * Unified Supplier section — primary supplier + alternative sources in one card
 */
import { useState } from 'react';
import { SupplierSelect } from '../SupplierSelect';
import { NewSupplierDialog } from '../NewSupplierDialog';
import type { FormSectionProps } from '../ProductFormHelpers';
import { SupplierFiscalInfo } from '../SupplierFiscalInfo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Truck, Plus, Star, Trash2, Clock, DollarSign, Loader2, Users } from 'lucide-react';
import { useProductSupplierSources, type SupplierSourceInput } from '@/hooks/products';
import { cn } from '@/lib/utils';

interface Props extends Pick<FormSectionProps, 'setValue' | 'errors'> {
  supplierId: string;
  onSupplierChange: (id: string, name?: string, markup?: number | null) => void;
  productId?: string;
  isEdit: boolean;
  primarySupplierName: string;
}

const emptyForm = {
  supplier_id: '',
  supplier_name: '',
  supplier_sku: '',
  cost_price: 0,
  sale_price: 0,
  lead_time_days: null as number | null,
  stock_quantity: 0,
  min_order_quantity: 1,
  notes: '',
};

export function ProductSupplierSection({
  supplierId,
  onSupplierChange,
  setValue,
  errors,
  productId,
  isEdit: _isEdit,
  primarySupplierName: _primarySupplierName,
}: Props) {
  const { sources, isLoading, addSource, removeSource, setPreferred } =
    useProductSupplierSources(productId);
  const [pendingSources, setPendingSources] = useState<
    Array<SupplierSourceInput & { _localId: string }>
  >([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Combine persisted + pending sources for display
  const allSources = [
    ...sources.map((s) => ({ ...s, _localId: s.id, _persisted: true as const })),
    ...pendingSources.map((s) => ({
      ...s,
      id: s._localId,
      created_at: '',
      updated_at: '',
      _persisted: false as const,
    })),
  ];

  const handleAdd = async () => {
    if (!form.supplier_id) return;

    if (productId) {
      // Persisted mode
      setSaving(true);
      const input: SupplierSourceInput = {
        product_id: productId,
        supplier_id: form.supplier_id,
        supplier_name: form.supplier_name,
        supplier_sku: form.supplier_sku || null,
        cost_price: form.cost_price,
        sale_price: form.sale_price,
        lead_time_days: form.lead_time_days,
        stock_quantity: form.stock_quantity,
        min_order_quantity: form.min_order_quantity,
        is_preferred: sources.length === 0,
        is_active: true,
        notes: form.notes || null,
      };
      const ok = await addSource(input);
      setSaving(false);
      if (ok) {
        setForm(emptyForm);
        setDialogOpen(false);
      }
    } else {
      // Local-only mode (product not yet saved)
      const localEntry: SupplierSourceInput & { _localId: string } = {
        _localId: crypto.randomUUID(),
        product_id: '',
        supplier_id: form.supplier_id,
        supplier_name: form.supplier_name,
        supplier_sku: form.supplier_sku || null,
        cost_price: form.cost_price,
        sale_price: form.sale_price,
        lead_time_days: form.lead_time_days,
        stock_quantity: form.stock_quantity,
        min_order_quantity: form.min_order_quantity,
        is_preferred: pendingSources.length === 0 && sources.length === 0,
        is_active: true,
        notes: form.notes || null,
      };
      setPendingSources((prev) => [...prev, localEntry]);
      setForm(emptyForm);
      setDialogOpen(false);
    }
  };

  const removePending = (localId: string) => {
    setPendingSources((prev) => prev.filter((s) => s._localId !== localId));
  };

  const formatCurrency = (v: number | null) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Card className="overflow-hidden border-primary/20 bg-primary/5 backdrop-blur-sm">
      <div className="space-y-4 p-4">
        {/* ── Fornecedor Principal ── */}
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Fornecedor Principal
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Selecione ou cadastre o fornecedor do produto
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <SupplierSelect
                value={supplierId}
                onChange={onSupplierChange}
                error={errors.supplier_id?.message}
              />
            </div>
            <NewSupplierDialog onCreated={(id) => setValue('supplier_id', id)} />
          </div>
          {/* Primary supplier fiscal info */}
          {supplierId && productId && (
            <SupplierFiscalInfo productId={productId} supplierId={supplierId} />
          )}
        </div>

        {/* ── Separator ── */}
        <Separator className="bg-border/50" />

        {/* ── Fornecedores Secundários ── */}
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Fornecedores Secundários
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Fontes alternativas com preços e prazos distintos
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
              {allSources.length} fonte{allSources.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {allSources.length > 0 && (
                <div className="mb-3 space-y-2">
                  {allSources.map((src) => {
                    const isPersisted = '_persisted' in src && src._persisted;
                    return (
                      <Card
                        key={src.id}
                        className={cn(
                          'border-border/50 bg-card/50 p-3 transition-colors',
                          src.is_preferred && 'border-primary/30 bg-primary/5',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {src.supplier_name}
                              </span>
                              {src.is_preferred && (
                                <Badge className="border-0 bg-primary/20 text-[10px] text-primary">
                                  <Star className="mr-0.5 h-3 w-3 fill-current" /> Preferencial
                                </Badge>
                              )}
                              {!isPersisted && (
                                <Badge
                                  variant="outline"
                                  className="border-warning/30 text-[10px] text-warning"
                                >
                                  Pendente
                                </Badge>
                              )}
                              {!src.is_active && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-muted-foreground"
                                >
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {src.supplier_sku && (
                                <span className="font-mono">SKU: {src.supplier_sku}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Custo: {formatCurrency(src.cost_price)} · Venda:{' '}
                                {formatCurrency(src.sale_price)}
                              </span>
                              {src.lead_time_days !== null && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {src.lead_time_days}d
                                </span>
                              )}
                              <span>Estoque: {src.stock_quantity}</span>
                            </div>
                            {/* Fiscal info from external DB */}
                            {isPersisted && (
                              <SupplierFiscalInfo
                                productId={productId}
                                supplierId={src.supplier_id}
                              />
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isPersisted && !src.is_preferred && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Favoritar"
                                    className="h-7 w-7"
                                    onClick={() => setPreferred(src.id)}
                                  >
                                    <Star className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Definir como preferencial</TooltipContent>
                              </Tooltip>
                            )}
                            {isPersisted ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                    aria-label="Excluir"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover fonte?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O fornecedor "{src.supplier_name}" será desvinculado deste
                                      produto.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeSource(src.id)}>
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Excluir"
                                className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                onClick={() => removePending(src.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Add button + Dialog */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="mr-1.5 h-4 w-4" /> Adicionar Fornecedor Alternativo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nova Fonte de Fornecimento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Fornecedor</label>
                      <SupplierSelect
                        value={form.supplier_id}
                        onChange={(id, name) =>
                          setForm((f) => ({ ...f, supplier_id: id, supplier_name: name ?? '' }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">SKU do Fornecedor</label>
                      <Input
                        value={form.supplier_sku}
                        onChange={(e) => setForm((f) => ({ ...f, supplier_sku: e.target.value }))}
                        placeholder="Código ref. do fornecedor"
                        className="h-9 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium">Preço de Custo</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.cost_price ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, cost_price: parseFloat(e.target.value) || 0 }))
                          }
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Preço de Venda</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.sale_price ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, sale_price: parseFloat(e.target.value) || 0 }))
                          }
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium">Prazo (dias)</label>
                        <Input
                          type="number"
                          min="0"
                          value={form.lead_time_days ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              lead_time_days: e.target.value ? parseInt(e.target.value, 10) : null,
                            }))
                          }
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Estoque</label>
                        <Input
                          type="number"
                          min="0"
                          value={form.stock_quantity ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              stock_quantity: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Qtd Mín.</label>
                        <Input
                          type="number"
                          min="1"
                          value={form.min_order_quantity ?? ''}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              min_order_quantity: parseInt(e.target.value, 10) || 1,
                            }))
                          }
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAdd} disabled={!form.supplier_id || saving}>
                      {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
