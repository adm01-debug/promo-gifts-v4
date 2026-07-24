/**
 * Product-level fiscal data — intrinsic to the product, not supplier-dependent.
 * NCM, EAN, GTIN, IPI rate, Country of Origin.
 * Supplier-specific fiscal fields (CFOP, CST, ICMS, PIS, COFINS, CEST, CSOSN)
 * live in variant_supplier_sources and are shown in the Supplier section.
 */
import { Input } from '@/components/ui/input';
import { FieldLabel, SectionCard, type FormSectionProps } from '../ProductFormHelpers';
import { FileText } from 'lucide-react';

type Props = FormSectionProps;

export function ProductFiscalSection({ register, numericProps }: Props) {
  return (
    <SectionCard
      id="fiscal"
      title="Dados Fiscais do Produto"
      icon={FileText}
      subtitle="Atributos fiscais intrínsecos ao produto — não variam por fornecedor"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <FieldLabel
            htmlFor="ncm_code"
            hint="Nomenclatura Comum do Mercosul — código de 8 dígitos usado na classificação fiscal"
          >
            Código NCM
          </FieldLabel>
          <Input
            id="ncm_code"
            {...register('ncm_code')}
            placeholder="Ex: 96081000"
            className="h-9 font-mono"
          />
        </div>
        <div>
          <FieldLabel htmlFor="ean" hint="Código de barras padrão europeu (13 dígitos)">
            Código EAN
          </FieldLabel>
          <Input
            id="ean"
            {...register('ean')}
            placeholder="Código de barras EAN"
            className="h-9 font-mono"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="gtin"
            hint="Global Trade Item Number — identificação global do produto"
          >
            GTIN
          </FieldLabel>
          <Input
            id="gtin"
            {...register('gtin')}
            placeholder="Global Trade Item Number"
            className="h-9 font-mono"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel
            htmlFor="ipi_rate"
            hint="Imposto sobre Produtos Industrializados — alíquota padrão definida pelo NCM"
          >
            Alíquota IPI (%)
          </FieldLabel>
          <Input id="ipi_rate" {...numericProps('ipi_rate')} min="0" step="0.01" className="h-9" />
        </div>
        <div>
          <FieldLabel
            htmlFor="country_of_origin"
            hint="País de fabricação/origem — impacta o CST (nacional vs importado)"
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
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Campos fiscais que variam por fornecedor (CFOP, CST, ICMS, PIS, COFINS, CEST) são
        gerenciados na aba <strong>Identificação → Fontes de Fornecimento</strong>.
      </p>
    </SectionCard>
  );
}
