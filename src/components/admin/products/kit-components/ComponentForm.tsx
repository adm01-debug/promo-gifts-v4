import { useState } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
<<<<<<< HEAD
import type { ComponentFormData } from './types';
=======
import type { ComponentFormData } from "./types";
>>>>>>> origin/main

interface Props {
  initial: ComponentFormData;
  onSave: (data: ComponentFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ComponentForm({ initial, onSave, onCancel, isSaving }: Props) {
  const [form, setForm] = useState<ComponentFormData>(initial);

  const set = <K extends keyof ComponentFormData>(field: K, value: ComponentFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.component_name.trim()) {
      toast.error('Nome do componente é obrigatório');
      return;
    }
    onSave(form);
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-accent/30 p-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome *</Label>
          <Input
            value={form.component_name}
            onChange={(e) => set('component_name', e.target.value)}
            placeholder="Ex: Tábua de corte"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Input
            value={form.component_type_code}
            onChange={(e) => set('component_type_code', e.target.value)}
            placeholder="Ex: TABUA"
            className="h-8 font-mono text-sm uppercase"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Código</Label>
          <Input
            value={form.component_code}
            onChange={(e) => set('component_code', e.target.value)}
            placeholder="Ex: COMP-001"
            className="h-8 font-mono text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">SKU</Label>
          <Input
            value={form.component_sku}
            onChange={(e) => set('component_sku', e.target.value)}
            placeholder="SKU componente"
            className="h-8 font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SKU Fornecedor</Label>
          <Input
            value={form.supplier_component_code}
            onChange={(e) => set('supplier_component_code', e.target.value)}
            placeholder="Código fornecedor"
            className="h-8 font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quantidade</Label>
          <Input
            type="number"
            value={form.quantity}
            onChange={(e) => set('quantity', parseInt(e.target.value, 10) || 1)}
            min="1"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ordem</Label>
          <Input
            type="number"
            value={form.display_order}
            onChange={(e) => set('display_order', parseInt(e.target.value, 10) || 0)}
            min="0"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Material</Label>
          <Input
            value={form.material}
            onChange={(e) => set('material', e.target.value)}
            placeholder="Ex: Bambu"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cor</Label>
          <Input
            value={form.color}
            onChange={(e) => set('color', e.target.value)}
            placeholder="Ex: Natural"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Altura (mm)</Label>
          <Input
            type="number"
            value={form.height_mm ?? ''}
            onChange={(e) => set('height_mm', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Largura (mm)</Label>
          <Input
            type="number"
            value={form.width_mm ?? ''}
            onChange={(e) => set('width_mm', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Comp. (mm)</Label>
          <Input
            type="number"
            value={form.length_mm ?? ''}
            onChange={(e) => set('length_mm', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Peso (g)</Label>
          <Input
            type="number"
            value={form.weight_g ?? ''}
            onChange={(e) => set('weight_g', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['is_optional', 'Opcional'],
            ['is_packaging', 'Embalagem'],
            ['is_replaceable', 'Substituível'],
            ['allows_personalization', 'Personalizável'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
            <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} className="scale-75" />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">URL Imagem</Label>
        <Input
          value={form.primary_image_url}
          onChange={(e) => set('primary_image_url', e.target.value)}
          placeholder="https://..."
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Input
            value={form.component_description}
            onChange={(e) => set('component_description', e.target.value)}
            placeholder="Descrição / dimensões descritivas"
            className="h-8 text-sm"
          />
        </div>
        {form.allows_personalization && (
          <div className="space-y-1">
            <Label className="text-xs">Notas de Personalização</Label>
            <Textarea
              value={form.personalization_notes}
              onChange={(e) => set('personalization_notes', e.target.value)}
              placeholder="Instruções de personalização..."
              rows={2}
              className="text-sm"
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Observações</Label>
          <Input
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Observações internas"
            className="h-8 text-sm"
          />
        </div>
      </div>

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
