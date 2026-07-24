/**
 * Basic info section — Name, SKU, description, brand, category, lead time, supply mode
 */
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FieldLabel, SectionCard, type FormSectionProps } from '../ProductFormHelpers';
import { Info, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props extends FormSectionProps {
  skuStatus: 'checking' | 'duplicate' | 'idle' | 'valid';
  duplicateName: string;
  skuManuallyEdited: boolean;
  onSkuManualEdit: () => void;
}

export function ProductInfoSection({
  register,
  setValue,
  watch,
  errors,
  numericProps,
  skuStatus,
  duplicateName,
  skuManuallyEdited,
  onSkuManualEdit,
}: Props) {
  const nameValue = watch('name') || '';
  const skuValue = watch('sku') || '';
  const supplierRefValue = watch('supplier_reference') || '';
  const descValue = watch('description') || '';
  const shortDescValue = watch('short_description') || '';

  return (
    <SectionCard
      id="info"
      title="Informações Básicas"
      icon={Info}
      subtitle="SKU, nome, descrição, marca e categoria"
    >
      {/* Nome */}
      <div>
        <FieldLabel
          htmlFor="name"
          required
          charCount={nameValue.length}
          charMax={300}
          hint="Nome comercial do produto que será exibido no catálogo e orçamentos"
        >
          Nome do Produto
        </FieldLabel>
        <Input
          id="name"
          {...register('name')}
          placeholder="Nome do produto"
          className={cn('h-9', errors.name && 'border-destructive')}
        />
        {errors.name && <p className="mt-1 text-[10px] text-destructive">{errors.name.message}</p>}
      </div>

      {/* SKU Fornecedor | SKU Interno */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <FieldLabel
            htmlFor="supplier_reference"
            charCount={supplierRefValue.length}
            charMax={100}
            hint="Código de referência usado pelo fornecedor para identificar o produto"
          >
            SKU do Fornecedor
          </FieldLabel>
          <Input
            id="supplier_reference"
            {...register('supplier_reference')}
            placeholder="Ex: FORN-12345"
            className="h-9 font-mono"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="sku"
            required
            charCount={skuValue.length}
            charMax={50}
            hint="Código interno único para identificar o produto no sistema. Gerado automaticamente a partir do nome."
          >
            SKU Interno
          </FieldLabel>
          <div className="relative">
            <Input
              id="sku"
              {...register('sku', {
                onChange: () => {
                  if (!skuManuallyEdited) onSkuManualEdit();
                },
              })}
              placeholder="Ex: GS-001"
              className={cn(
                'h-9 pr-8 font-mono',
                errors.sku && 'border-destructive',
                skuStatus === 'valid' && 'border-success/50',
                skuStatus === 'duplicate' && 'border-destructive',
              )}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {skuStatus === 'checking' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {skuStatus === 'valid' && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {skuStatus === 'duplicate' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>SKU já usado em "{duplicateName}"</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {errors.sku && <p className="mt-1 text-[10px] text-destructive">{errors.sku.message}</p>}
          {skuStatus === 'duplicate' && (
            <p className="mt-1 text-[10px] text-destructive">SKU duplicado: "{duplicateName}"</p>
          )}
        </div>
        <div>
          <FieldLabel
            htmlFor="supplier_product_url"
            hint="Link do produto no site do fornecedor para referência rápida"
          >
            Link Fornecedor
          </FieldLabel>
          <Input
            id="supplier_product_url"
            {...register('supplier_product_url')}
            placeholder="https://fornecedor.com/produto"
            className="h-9"
          />
        </div>
      </div>

      {/* Descrição Completa */}
      <div>
        <FieldLabel
          htmlFor="description"
          charCount={descValue.length}
          charMax={5000}
          hint="Descrição detalhada do produto com especificações técnicas, materiais e diferenciais"
        >
          Descrição Completa
        </FieldLabel>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Descrição detalhada do produto"
          rows={4}
          className="min-h-[80px] resize-y text-sm"
        />
      </div>

      {/* Descrição Curta */}
      <div>
        <FieldLabel
          htmlFor="short_description"
          charCount={shortDescValue.length}
          charMax={500}
          hint="Texto resumido para cards, listagens e visualizações rápidas do produto"
        >
          Descrição Curta
        </FieldLabel>
        <Input
          id="short_description"
          {...register('short_description')}
          placeholder="Resumo curto do produto"
          className="h-9"
        />
      </div>

      {/* Marca + País + Prazo + Modo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <FieldLabel htmlFor="brand" hint="Fabricante ou marca comercial do produto">
            Marca
          </FieldLabel>
          <Input id="brand" {...register('brand')} placeholder="Ex: Tramontina" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="country_of_origin"
            hint="País onde o produto é fabricado ou de onde é importado"
          >
            País de Origem
          </FieldLabel>
          <select
            id="country_of_origin"
            {...register('country_of_origin')}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione...</option>
            <option value="Alemanha">Alemanha</option>
            <option value="Bangladesh">Bangladesh</option>
            <option value="Brasil">Brasil</option>
            <option value="China">China</option>
            <option value="Espanha">Espanha</option>
            <option value="Índia">Índia</option>
            <option value="Paquistão">Paquistão</option>
            <option value="Portugal">Portugal</option>
          </select>
        </div>
        <div>
          <FieldLabel
            htmlFor="lead_time_days"
            hint="Tempo médio em dias úteis para produção/entrega pelo fornecedor"
          >
            Prazo Entrega (dias)
          </FieldLabel>
          <Input id="lead_time_days" {...numericProps('lead_time_days')} min="0" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="supply_mode"
            hint="Define se o fornecedor mantém o produto em estoque pronto ou se fabrica sob demanda, podendo entregá-lo liso ou já personalizado"
          >
            Modo de Fornecimento
          </FieldLabel>
          <Select
            value={watch?.('supply_mode') ?? ''}
            onValueChange={(v) => setValue?.('supply_mode', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pronta_entrega_liso">Pronta Entrega Liso</SelectItem>
              <SelectItem value="fabricado_personalizado">Fabricado Personalizado</SelectItem>
              <SelectItem value="fabricado_liso">Fabricado Liso</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}
