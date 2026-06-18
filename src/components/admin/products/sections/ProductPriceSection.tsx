/**
 * Price & Stock section
 */
import { Input } from '@/components/ui/input';
import { FieldLabel, SectionCard, type FormSectionProps } from '../ProductFormHelpers';
import { Tag, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPriceDateLong } from '@/utils/price-freshness';

interface Props extends FormSectionProps {
  supplierMarkup: number | null;
  costPriceDisplay: string;
  salePriceDisplay: string;
  onCostPriceDisplayChange: (v: string) => void;
  onSalePriceDisplayChange: (v: string) => void;
  onSalePriceManualEdit: () => void;
  lastPriceUpdate?: { date: string; user: string } | null;
}

export function ProductPriceSection({
  register,
  setValue,
  watch,
  errors,
  numericProps,
  supplierMarkup,
  costPriceDisplay,
  salePriceDisplay,
  onCostPriceDisplayChange,
  onSalePriceDisplayChange,
  onSalePriceManualEdit,
  lastPriceUpdate,
}: Props) {
  const salePrice = watch('sale_price') ?? 0;
  const suggestedPrice = watch('suggested_price') ?? 0;

  return (
    <SectionCard
      id="price"
      title="Preço e Estoque"
      icon={Tag}
      subtitle={`Preço atual: R$ ${salePrice.toFixed(2)}${supplierMarkup ? ` · Markup ${supplierMarkup}%` : ''}`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <FieldLabel
            htmlFor="cost_price"
            hint={
              supplierMarkup
                ? `Markup do fornecedor: ${supplierMarkup}%. Preço sugerido e venda serão calculados automaticamente.`
                : 'Informe o preço de custo do produto'
            }
          >
            Preço Custo (R$)
          </FieldLabel>
          <Input
            id="cost_price"
            type="text"
            inputMode="decimal"
            value={costPriceDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.,]/g, '');
              onCostPriceDisplayChange(raw);
              const num = parseFloat(raw.replace(',', '.'));
              if (!Number.isNaN(num)) setValue('cost_price', num);
            }}
            onBlur={(e) => {
              const num = parseFloat(e.target.value.replace(',', '.'));
              if (!Number.isNaN(num)) onCostPriceDisplayChange(num.toFixed(2));
            }}
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="suggested_price"
            hint="Calculado automaticamente pelo markup do fornecedor. Valor de referência (não editável)."
          >
            Preço Sugerido (R$)
          </FieldLabel>
          <Input
            id="suggested_price"
            type="text"
            value={suggestedPrice.toFixed(2)}
            className="h-9 cursor-not-allowed bg-muted/50"
            readOnly
            tabIndex={-1}
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="sale_price"
            required
            hint="Inicia com o valor sugerido pelo markup, mas pode ser editado livremente."
          >
            Preço Venda (R$)
          </FieldLabel>
          <Input
            id="sale_price"
            type="text"
            inputMode="decimal"
            value={salePriceDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.,]/g, '');
              onSalePriceDisplayChange(raw);
              const num = parseFloat(raw.replace(',', '.'));
              if (!Number.isNaN(num)) setValue('sale_price', num);
              onSalePriceManualEdit();
            }}
            onBlur={(e) => {
              const num = parseFloat(e.target.value.replace(',', '.'));
              if (!Number.isNaN(num)) onSalePriceDisplayChange(num.toFixed(2));
            }}
            className={cn('h-9', errors.sale_price && 'border-destructive')}
          />
          {errors.sale_price && (
            <p className="mt-1 text-[10px] text-destructive">{errors.sale_price.message}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <FieldLabel
            htmlFor="stock_quantity"
            hint="Quantidade atual em estoque. Atualizado automaticamente por sincronizações."
          >
            Estoque
          </FieldLabel>
          <Input id="stock_quantity" {...numericProps('stock_quantity')} min="0" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="product_type"
            hint="Produto unitário, kit montado ou embalagem avulsa"
          >
            Tipo
          </FieldLabel>
          <select
            id="product_type"
            {...register('product_type', {
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                setValue('is_kit', e.target.value === 'kit');
              },
            })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="product">Produto Unitário</option>
            <option value="kit">Kit</option>
            <option value="packaging">Embalagem</option>
          </select>
        </div>
        <div>
          <FieldLabel
            htmlFor="min_quantity"
            hint="Quantidade mínima que o cliente precisa comprar desse produto no pedido"
          >
            Qtd. Mín. Venda
          </FieldLabel>
          <Input id="min_quantity" {...numericProps('min_quantity')} min="1" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="min_order_quantity"
            hint="Quantidade mínima exigida pelo fornecedor para compra/reposição"
          >
            Qtd. Mín. Compra
          </FieldLabel>
          <Input
            id="min_order_quantity"
            {...numericProps('min_order_quantity')}
            min="0"
            className="h-9"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="price_freshness_threshold_days"
            hint="Após esse prazo o sistema avisa o vendedor que o preço pode estar defasado. Padrão: 60 dias."
          >
            Validade do Preço
          </FieldLabel>
          <select
            id="price_freshness_threshold_days"
            {...register('price_freshness_threshold_days', { valueAsNumber: true })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={30}>30 dias</option>
            <option value={60}>60 dias (padrão)</option>
            <option value={90}>90 dias</option>
            <option value={120}>120 dias</option>
          </select>
          {lastPriceUpdate && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <History className="h-3 w-3" />
              <span>
                Alterado por <strong>{lastPriceUpdate.user}</strong> em{' '}
                {formatPriceDateLong(new Date(lastPriceUpdate.date))}
              </span>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
