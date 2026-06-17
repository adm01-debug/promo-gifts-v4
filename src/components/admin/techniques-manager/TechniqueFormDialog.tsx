import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Droplets, Ruler, Hash, Clock, Package } from 'lucide-react';

interface NewTechniqueData {
  code: string;
  name: string;
  description: string;
  category: string;
  setupPrice: string;
  handlingPrice: string;
  minColors: string;
  maxColors: string;
  minQuantity: string;
  estimatedDays: string;
  priceByColor: boolean;
  priceByArea: boolean;
  priceByStitches: boolean;
  displayOrder: string;
}

const EMPTY_FORM: NewTechniqueData = {
  code: '',
  name: '',
  description: '',
  category: '',
  setupPrice: '',
  handlingPrice: '',
  minColors: '',
  maxColors: '',
  minQuantity: '',
  estimatedDays: '',
  priceByColor: false,
  priceByArea: false,
  priceByStitches: false,
  displayOrder: '',
};

interface TechniqueFormDialogProps {
  categorias: string[];
  isCreating: boolean;
  onCreate: (data: {
    code: string;
    name: string;
    description?: string;
    category: string;
    setup_price?: number;
    handling_price?: number;
    min_colors: number;
    max_colors?: number;
    min_quantity?: number;
    estimated_days?: number;
    price_by_color: boolean;
    price_by_area: boolean;
    price_by_stitches: boolean;
    display_order: number;
    is_active: boolean;
    requires_color_count: boolean;
  }) => void;
}

export function TechniqueFormDialog({
  categorias,
  isCreating,
  onCreate,
}: TechniqueFormDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<NewTechniqueData>(EMPTY_FORM);

  const handleAdd = () => {
    if (!form.name || !form.code) return;
    onCreate({
      code: form.code.toUpperCase(),
      name: form.name,
      description: form.description || undefined,
      category: form.category || 'Outros',
      setup_price: form.setupPrice ? parseFloat(form.setupPrice) : undefined,
      handling_price: form.handlingPrice ? parseFloat(form.handlingPrice) : undefined,
      min_colors: form.minColors ? parseInt(form.minColors, 10) : 1,
      max_colors: form.maxColors ? parseInt(form.maxColors, 10) : undefined,
      min_quantity: form.minQuantity ? parseInt(form.minQuantity, 10) : undefined,
      estimated_days: form.estimatedDays ? parseInt(form.estimatedDays, 10) : undefined,
      price_by_color: form.priceByColor,
      price_by_area: form.priceByArea,
      price_by_stitches: form.priceByStitches,
      display_order: form.displayOrder ? parseInt(form.displayOrder, 10) : 0,
      is_active: true,
      requires_color_count: form.priceByColor || !!form.maxColors,
    });
    setIsOpen(false);
    setForm(EMPTY_FORM);
  };

  const update = (field: keyof NewTechniqueData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="admin-create-btn">
          <Plus className="mr-2 h-4 w-4" />
          Nova Técnica
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="admin-form" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Técnica de Personalização</DialogTitle>
          <DialogDescription>Adicione uma nova técnica ao catálogo (BD Externo)</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código *</Label>
              <Input
                placeholder="Ex: SERI, LASER"
                data-testid="admin-code-input"
                value={form.code}
                onChange={(e) => update('code', e.target.value)}
              />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Serigrafia"
                data-testid="admin-name-input"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => update('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem de Exibição</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.displayOrder}
                onChange={(e) => update('displayOrder', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descrição da técnica..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Custo de Setup (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.setupPrice}
                onChange={(e) => update('setupPrice', e.target.value)}
              />
            </div>
            <div>
              <Label>Custo de Manuseio (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.handlingPrice}
                onChange={(e) => update('handlingPrice', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Mín. Cores</Label>
              <Input
                type="number"
                placeholder="1"
                value={form.minColors}
                onChange={(e) => update('minColors', e.target.value)}
              />
            </div>
            <div>
              <Label>Máx. Cores</Label>
              <Input
                type="number"
                placeholder="Ilimitado"
                value={form.maxColors}
                onChange={(e) => update('maxColors', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Qtd. Mínima
              </Label>
              <Input
                type="number"
                placeholder="Ex: 50"
                value={form.minQuantity}
                onChange={(e) => update('minQuantity', e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Prazo (dias úteis)
              </Label>
              <Input
                type="number"
                placeholder="Ex: 7"
                value={form.estimatedDays}
                onChange={(e) => update('estimatedDays', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-3 border-t pt-2">
            <Label className="text-base">Tipo de Precificação</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-info" />
                  <span className="text-sm">Por Cor</span>
                </div>
                <Switch
                  checked={form.priceByColor}
                  onCheckedChange={(c) => update('priceByColor', c)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-success" />
                  <span className="text-sm">Por Área</span>
                </div>
                <Switch
                  checked={form.priceByArea}
                  onCheckedChange={(c) => update('priceByArea', c)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  <span className="text-sm">Por Pontos</span>
                </div>
                <Switch
                  checked={form.priceByStitches}
                  onCheckedChange={(c) => update('priceByStitches', c)}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            data-testid="admin-save-btn"
            disabled={isCreating || !form.code || !form.name}
          >
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Técnica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
