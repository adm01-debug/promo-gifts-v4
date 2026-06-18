import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  type QuoteTemplate,
  type QuoteTemplateItem,
  type CreateTemplateInput,
  useQuoteTemplates,
} from '@/hooks/quotes';
import { Save, X } from 'lucide-react';

interface QuoteTemplateFormProps {
  template?: QuoteTemplate | null;
  initialItems?: QuoteTemplateItem[];
  initialDiscountPercent?: number;
  initialDiscountAmount?: number;
  initialNotes?: string;
  initialInternalNotes?: string;
  onSave?: (template: QuoteTemplate | null) => void;
  onCancel?: () => void;
}

export function QuoteTemplateForm({
  template,
  initialItems = [],
  initialDiscountPercent = 0,
  initialDiscountAmount = 0,
  initialNotes = '',
  initialInternalNotes = '',
  onSave,
  onCancel,
}: QuoteTemplateFormProps) {
  const { createTemplate, updateTemplate } = useQuoteTemplates();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<CreateTemplateInput>({
    name: template?.name ?? '',
    description: template?.description ?? '',
    is_default: template?.is_default ?? false,
    items: template?.items || initialItems,
    discount_percent: template?.discount_percent ?? initialDiscountPercent,
    discount_amount: template?.discount_amount ?? initialDiscountAmount,
    notes: template?.notes ?? initialNotes,
    internal_notes: template?.internal_notes ?? initialInternalNotes,
    payment_terms: template?.payment_terms ?? '',
    delivery_time: template?.delivery_time ?? '',
    validity_days: template?.validity_days || 30,
  });

  const isEditing = !!template;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    setSaving(true);
    try {
      let result: QuoteTemplate | null;
      if (isEditing) {
        result = await updateTemplate(template.id, formData);
      } else {
        const created = await createTemplate(formData);
        // createTemplate returns the raw DB row; normalize it to QuoteTemplate
        result = created
          ? {
              id: created.id,
              seller_id: created.seller_id ?? '',
              name: created.name,
              description: created.description ?? undefined,
              is_default: created.is_default ?? false,
              template_data:
                created.template_data &&
                typeof created.template_data === 'object' &&
                !Array.isArray(created.template_data)
                  ? (created.template_data as Record<string, unknown>)
                  : {},
              // DB stores items as JSON; matches the hook's own transformTemplates mapping.
              items: Array.isArray(created.items)
                ? (created.items as unknown as QuoteTemplateItem[])
                : [],
              discount_percent: created.discount_percent ?? 0,
              discount_amount: created.discount_amount ?? 0,
              notes: created.notes ?? undefined,
              internal_notes: created.internal_notes ?? undefined,
              payment_terms: created.payment_terms ?? undefined,
              delivery_time: created.delivery_time ?? undefined,
              validity_days: created.validity_days ?? 30,
              created_at: created.created_at ?? '',
              updated_at: created.updated_at ?? '',
            }
          : null;
      }
      onSave?.(result);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof CreateTemplateInput>(
    field: K,
    value: CreateTemplateInput[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calculateTotal = () => {
    const itemsTotal = (formData.items ?? []).reduce((sum, item) => {
      const itemBase = item.quantity * item.unitPrice;
      const personalizationCost =
        item.personalizations?.reduce((pSum, p) => {
          return pSum + (p.unitCost || 0) * item.quantity + (p.setupCost || 0);
        }, 0) || 0;
      return sum + itemBase + personalizationCost;
    }, 0);

    const discountValue =
      formData.discount_percent && formData.discount_percent > 0
        ? itemsTotal * (formData.discount_percent / 100)
        : formData.discount_amount || 0;

    return itemsTotal - discountValue;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Template' : 'Novo Template'}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Atualize as informações do template de orçamento'
              : 'Crie um template reutilizável para agilizar seus orçamentos'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ex: Kits Corporativos Padrão"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validity">Validade (dias)</Label>
              <Input
                id="validity"
                type="number"
                min={1}
                max={365}
                value={formData.validity_days}
                onChange={(e) => updateField('validity_days', parseInt(e.target.value, 10) || 30)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Descreva o template para facilitar a identificação..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Template Padrão</Label>
              <p className="text-sm text-muted-foreground">
                Será sugerido automaticamente ao criar novos orçamentos
              </p>
            </div>
            <Switch
              checked={formData.is_default}
              onCheckedChange={(checked) => updateField('is_default', checked)}
            />
          </div>

          <Separator />

          {/* Discount Settings */}
          <div className="space-y-4">
            <h4 className="font-medium">Configurações de Desconto</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount_percent">Desconto (%)</Label>
                <Input
                  id="discount_percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={formData.discount_percent ?? ''}
                  onChange={(e) => {
                    updateField('discount_percent', parseFloat(e.target.value) || 0);
                    if (e.target.value) updateField('discount_amount', 0);
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_amount">Desconto Fixo (R$)</Label>
                <CurrencyInput
                  value={formData.discount_amount || 0}
                  onChange={(n) => {
                    updateField('discount_amount', n);
                    if (n) updateField('discount_percent', 0);
                  }}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Terms */}
          <div className="space-y-4">
            <h4 className="font-medium">Termos e Condições</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Condições de Pagamento</Label>
                <Input
                  id="payment_terms"
                  value={formData.payment_terms ?? ''}
                  onChange={(e) => updateField('payment_terms', e.target.value)}
                  placeholder="Ex: 50% entrada + 50% na entrega"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_time">Prazo de Entrega</Label>
                <Input
                  id="delivery_time"
                  value={formData.delivery_time ?? ''}
                  onChange={(e) => updateField('delivery_time', e.target.value)}
                  placeholder="Ex: 15 dias úteis"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-4">
            <h4 className="font-medium">Observações</h4>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações para o Cliente</Label>
              <Textarea
                id="notes"
                value={formData.notes ?? ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Observações que aparecerão na proposta..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Notas Internas</Label>
              <Textarea
                id="internal_notes"
                value={formData.internal_notes ?? ''}
                onChange={(e) => updateField('internal_notes', e.target.value)}
                placeholder="Notas visíveis apenas para a equipe..."
                rows={2}
              />
            </div>
          </div>

          {/* Items Summary */}
          {formData.items && formData.items.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Itens do Template</h4>
                <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="flex-1 truncate">
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="ml-4 font-medium">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between font-medium">
                    <span>Total Estimado</span>
                    <span className="text-lg">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={saving || !formData.name.trim()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Template'}
        </Button>
      </div>
    </form>
  );
}
