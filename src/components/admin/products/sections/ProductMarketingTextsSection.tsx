/**
 * Marketing texts section — key benefits and use cases
 */
import { Textarea } from '@/components/ui/textarea';
import { FieldLabel, SectionCard, type FormSectionProps } from '../ProductFormHelpers';
import { Megaphone } from 'lucide-react';

type Props = Pick<FormSectionProps, 'register'>;

export function ProductMarketingTextsSection({ register }: Props) {
  return (
    <SectionCard
      id="marketing"
      title="Textos de Marketing"
      icon={Megaphone}
      subtitle="Benefícios e casos de uso"
    >
      <div>
        <FieldLabel
          htmlFor="key_benefits"
          hint="Liste os principais diferenciais e benefícios para uso em apresentações e orçamentos"
        >
          Benefícios Principais
        </FieldLabel>
        <Textarea
          id="key_benefits"
          {...register('key_benefits')}
          placeholder="Liste os benefícios do produto (um por linha)"
          rows={3}
          className="resize-y text-sm"
        />
      </div>
      <div>
        <FieldLabel
          htmlFor="use_cases"
          hint="Descreva cenários e ocasiões de uso para orientar vendedores e clientes"
        >
          Casos de Uso
        </FieldLabel>
        <Textarea
          id="use_cases"
          {...register('use_cases')}
          placeholder="Cenários e ocasiões de uso (ex: Brindes corporativos, feiras, eventos)"
          rows={3}
          className="resize-y text-sm"
        />
      </div>
    </SectionCard>
  );
}
