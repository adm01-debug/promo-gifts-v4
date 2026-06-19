import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';
import type { ProductFormData } from '@/components/admin/products/ProductFormSchema';

import { logger } from '@/lib/logger';
interface SeoAIResult {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  slug: string;
  key_benefits: string;
  use_cases: string;
}

const SEO_FIELDS: Array<keyof SeoAIResult> = [
  'meta_title',
  'meta_description',
  'meta_keywords',
  'slug',
  'key_benefits',
  'use_cases',
];

export function useProductSeoAI(
  getValues: UseFormGetValues<ProductFormData>,
  setValue: UseFormSetValue<ProductFormData>,
) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    const name = getValues('name');
    if (!name?.trim()) {
      toast.error('Preencha o nome do produto antes de gerar.');
      return;
    }

    setIsGenerating(true);
    try {
      const product = {
        name,
        sku: getValues('sku'),
        description: getValues('description'),
        short_description: getValues('short_description'),
        brand: getValues('brand'),
        country_of_origin: getValues('country_of_origin'),
        sale_price: getValues('sale_price'),
      };

      const { data, error } = await supabase.functions.invoke('generate-product-seo', {
        body: { product },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      for (const field of SEO_FIELDS) {
        if (data[field]) {
          setValue(field, data[field], { shouldDirty: true });
        }
      }

      // Generate canonical_url from slug
      if (data.slug) {
        setValue('canonical_url', `/produto/${data.slug}`, { shouldDirty: true });
      }

      toast.success('Campos SEO e marketing preenchidos com IA!');
    } catch (err) {
      logger.error('SEO AI error:', err);
      toast.error('Erro ao gerar conteúdo com IA', { description: sanitizeError(err) });
    } finally {
      setIsGenerating(false);
    }
  }, [getValues, setValue]);

  return { generate, isGenerating };
}
