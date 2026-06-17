/**
 * SEO section — meta title, meta description, keywords, slug, canonical
 */
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldLabel, SectionCard, type FormSectionProps } from '../ProductFormHelpers';
import { Globe } from 'lucide-react';

type Props = FormSectionProps;

export function ProductSeoSection({ register, watch }: Props) {
  const metaTitleValue = watch('meta_title') ?? '';
  const metaDescValue = watch('meta_description') ?? '';
  const metaKeywordsValue = watch('meta_keywords') ?? '';

  return (
    <SectionCard
      id="seo"
      title="SEO e Metadados"
      icon={Globe}
      subtitle="Otimize o produto para buscadores"
    >
      <div>
        <FieldLabel
          htmlFor="meta_title"
          charCount={metaTitleValue.length}
          charMax={200}
          hint="Título exibido nos resultados de busca do Google. Ideal entre 50-60 caracteres."
        >
          Meta Título
        </FieldLabel>
        <Input
          id="meta_title"
          {...register('meta_title')}
          placeholder="Título para buscadores (Google)"
          className="h-9"
        />
      </div>
      <div>
        <FieldLabel
          htmlFor="meta_description"
          charCount={metaDescValue.length}
          charMax={500}
          hint="Descrição exibida nos resultados de busca. Ideal entre 120-160 caracteres para melhor exibição."
        >
          Meta Descrição
        </FieldLabel>
        <Textarea
          id="meta_description"
          {...register('meta_description')}
          placeholder="Descrição para buscadores (Google)"
          rows={2}
          className="resize-y text-sm"
        />
      </div>
      <div>
        <FieldLabel
          htmlFor="meta_keywords"
          charCount={metaKeywordsValue.length}
          charMax={500}
          hint="Palavras-chave separadas por vírgula. Usadas para filtros internos e SEO."
        >
          Palavras-chave
        </FieldLabel>
        <Input
          id="meta_keywords"
          {...register('meta_keywords')}
          placeholder="caneta, brinde, personalizado"
          className="h-9"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel
            htmlFor="slug"
            hint="URL amigável do produto. Gerado automaticamente a partir do nome se vazio."
          >
            Slug (URL)
          </FieldLabel>
          <Input
            id="slug"
            {...register('slug')}
            placeholder="caneta-plastica-001"
            className="h-9 font-mono"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="canonical_url"
            hint="URL canônica para evitar conteúdo duplicado em buscadores."
          >
            URL Canônica
          </FieldLabel>
          <Input
            id="canonical_url"
            {...register('canonical_url')}
            placeholder="/produto/caneta-001"
            className="h-9 font-mono"
          />
        </div>
      </div>
    </SectionCard>
  );
}
