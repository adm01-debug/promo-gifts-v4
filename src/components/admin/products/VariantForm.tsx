/**
 * VariantForm — Inline form for creating/editing a product variant.
 * Extracted from ProductVariantsSection.tsx.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VariantFormData } from './useProductVariants';

interface VariantFormProps {
  initial: VariantFormData;
  onSave: (data: VariantFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function VariantForm({ initial, onSave, onCancel, isSaving }: VariantFormProps) {
  const [form, setForm] = useState<VariantFormData>(initial);
  const [showExtra, setShowExtra] = useState(false);

  const set = <K extends keyof VariantFormData>(field: K, value: VariantFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast.error('Nome e SKU são obrigatórios');
      return;
    }
    onSave(form);
  };

  const hasExtraData = !!(
    form.supplier_sku ||
    form.ean ||
    form.size_code ||
    form.capacity_ml ||
    form.height_mm ||
    form.width_mm ||
    form.length_mm ||
    form.weight_g
  );

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-accent/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome *</Label>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Squeeze Azul"
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSave())}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SKU *</Label>
          <Input
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            placeholder="Ex: SQ-001-AZ"
            className="h-8 font-mono text-sm"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSave())}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cor</Label>
          <Input
            value={form.color_name}
            onChange={(e) => set('color_name', e.target.value)}
            placeholder="Ex: Azul Royal"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cor (hex)</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color_hex || '#000000'}
              onChange={(e) => set('color_hex', e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-input bg-background"
            />
            <Input
              value={form.color_hex}
              onChange={(e) => set('color_hex', e.target.value)}
              placeholder="#0000FF"
              className="h-8 flex-1 font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estoque</Label>
          <Input
            type="number"
            value={form.stock_quantity}
            onChange={(e) => set('stock_quantity', parseInt(e.target.value, 10) || 0)}
            min="0"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Collapsible open={showExtra || hasExtraData} onOpenChange={setShowExtra}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
          {showExtra || hasExtraData
            ? '▾ Ocultar detalhes'
            : '▸ Mais detalhes (SKU fornecedor, EAN, dimensões...)'}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">SKU Fornecedor</Label>
              <Input
                value={form.supplier_sku}
                onChange={(e) => set('supplier_sku', e.target.value)}
                placeholder="SKU do fornecedor"
                className="h-8 font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">EAN</Label>
              <Input
                value={form.ean}
                onChange={(e) => set('ean', e.target.value)}
                placeholder="Código de barras"
                className="h-8 font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tamanho</Label>
              <Input
                value={form.size_code}
                onChange={(e) => set('size_code', e.target.value)}
                placeholder="Ex: P, M, G, GG"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Capacidade (ml)</Label>
              <Input
                type="number"
                value={form.capacity_ml ?? ''}
                onChange={(e) =>
                  set('capacity_ml', e.target.value ? parseFloat(e.target.value) : null)
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Altura (mm)</Label>
              <Input
                type="number"
                value={form.height_mm ?? ''}
                onChange={(e) =>
                  set('height_mm', e.target.value ? parseFloat(e.target.value) : null)
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Largura (mm)</Label>
              <Input
                type="number"
                value={form.width_mm ?? ''}
                onChange={(e) =>
                  set('width_mm', e.target.value ? parseFloat(e.target.value) : null)
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comp. (mm)</Label>
              <Input
                type="number"
                value={form.length_mm ?? ''}
                onChange={(e) =>
                  set('length_mm', e.target.value ? parseFloat(e.target.value) : null)
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso (g)</Label>
              <Input
                type="number"
                value={form.weight_g ?? ''}
                onChange={(e) =>
                  set('weight_g', e.target.value ? parseFloat(e.target.value) : null)
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="mr-1 h-3.5 w-3.5" /> Cancelar
        </Button>
        <Button type="button" size="sm" disabled={isSaving} onClick={handleSave}>
          {isSaving ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1 h-3.5 w-3.5" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
