import { useState } from 'react';
import { Target, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
<<<<<<< HEAD
import type { PrintAreaFormData } from './types';
=======
import type { PrintAreaFormData } from "./types";
>>>>>>> origin/main

interface Props {
  initial: PrintAreaFormData;
  onSave: (data: PrintAreaFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function PrintAreaForm({ initial, onSave, onCancel, isSaving }: Props) {
  const [form, setForm] = useState<PrintAreaFormData>(initial);

  const set = <K extends keyof PrintAreaFormData>(field: K, value: PrintAreaFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.location_name.trim()) {
      toast.error('Nome do local é obrigatório');
      return;
    }
    onSave(form);
  };

  const areaNamePreview = [form.location_name, form.technique_name].filter(Boolean).join(' — ');

  return (
    <div className="ml-6 space-y-2.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Target className="h-3 w-3" />
        Área de Gravação
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Código Local</Label>
          <Input
            value={form.location_code}
            onChange={(e) => set('location_code', e.target.value)}
            placeholder="Ex: CABO"
            className="h-7 font-mono text-xs uppercase"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Nome Local *</Label>
          <Input
            value={form.location_name}
            onChange={(e) => set('location_name', e.target.value)}
            placeholder="Ex: Cabo, Frente, 360°"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Técnica</Label>
          <Input
            value={form.technique_name}
            onChange={(e) => set('technique_name', e.target.value)}
            placeholder="Ex: Laser, Serigrafia"
            className="h-7 text-xs"
          />
        </div>
      </div>

      {areaNamePreview && (
        <div className="text-[10px] text-muted-foreground">
          area_name: <span className="font-mono text-foreground">{areaNamePreview}</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Larg. Máx (mm)</Label>
          <Input
            type="number"
            value={form.max_width_mm ?? ''}
            onChange={(e) =>
              set('max_width_mm', e.target.value ? parseFloat(e.target.value) : null)
            }
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Alt. Máx (mm)</Label>
          <Input
            type="number"
            value={form.max_height_mm ?? ''}
            onChange={(e) =>
              set('max_height_mm', e.target.value ? parseFloat(e.target.value) : null)
            }
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">ID Técnica</Label>
          <Input
            value={form.technique_id}
            onChange={(e) => set('technique_id', e.target.value)}
            placeholder="UUID"
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">ID Tabela Preço</Label>
          <Input
            value={form.tabela_preco_id}
            onChange={(e) => set('tabela_preco_id', e.target.value)}
            placeholder="UUID"
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Ordem</Label>
          <Input
            type="number"
            value={form.display_order}
            onChange={(e) => set('display_order', parseInt(e.target.value, 10) || 0)}
            min="0"
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Observações</Label>
        <Input
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Observações sobre a área de gravação"
          className="h-7 text-xs"
        />
      </div>

      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="mr-0.5 h-3 w-3" /> Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-6 px-2 text-[10px]"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? (
            <Loader2 className="mr-0.5 h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-0.5 h-3 w-3" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
