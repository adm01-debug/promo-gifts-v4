import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/ui';
import type { Tables, TablesInsert, TablesUpdate, Json } from '@/integrations/supabase/types';

import { logger } from '@/lib/logger';
// ============================================
// Types
// ============================================

type QuoteTemplateRow = Tables<'quote_templates'>;

export interface QuoteTemplateItem {
  productId?: string;
  productSku?: string;
  productName: string;
  productImageUrl?: string;
  quantity: number;
  unitPrice: number;
  colorName?: string;
  colorHex?: string;
  personalizations?: Array<{
    techniqueId: string;
    techniqueName: string;
    colorsCount?: number;
    positionsCount?: number;
    unitCost?: number;
    setupCost?: number;
  }>;
}

export interface QuoteTemplate {
  id: string;
  seller_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  template_data: Record<string, unknown>;
  items: QuoteTemplateItem[];
  discount_percent: number;
  discount_amount: number;
  notes?: string;
  internal_notes?: string;
  payment_terms?: string;
  delivery_time?: string;
  validity_days: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  is_default?: boolean;
  items?: QuoteTemplateItem[];
  discount_percent?: number;
  discount_amount?: number;
  notes?: string;
  internal_notes?: string;
  payment_terms?: string;
  delivery_time?: string;
  validity_days?: number;
}

function transformTemplates(data: QuoteTemplateRow[]): QuoteTemplate[] {
  return (data ?? []).map((item) => ({
    ...item,
    is_default: item.is_default ?? false,
    items: Array.isArray(item.items) ? (item.items as unknown as QuoteTemplateItem[]) : [],
    template_data:
      typeof item.template_data === 'object' && item.template_data !== null
        ? (item.template_data as Record<string, unknown>)
        : {},
    discount_percent: item.discount_percent ?? 0,
    discount_amount: item.discount_amount ?? 0,
    validity_days: item.validity_days ?? 30,
  })) as unknown as QuoteTemplate[];
}

// ============================================
// Hook
// ============================================

export function useQuoteTemplates() {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<QuoteTemplate[]>([]);
  const [sellers, setSellers] = useState<
    Array<{ id: string; full_name: string | null; email: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: qErr } = await supabase
        .from('quote_templates')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (qErr) throw new Error(qErr.message);
      setTemplates(transformTemplates(data ?? []));
    } catch (err) {
      logger.error('Error fetching quote templates:', err);
      setError('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAllTemplates = useCallback(async () => {
    if (!user || !isAdmin) {
      setAllTemplates([]);
      return;
    }

    try {
      const { data, error: qErr } = await supabase
        .from('quote_templates')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (qErr) throw new Error(qErr.message);
      setAllTemplates(transformTemplates(data ?? []));
    } catch (err) {
      logger.error('Error fetching all templates:', err);
    }
  }, [user, isAdmin]);

  const fetchSellers = useCallback(async () => {
    if (!user || !isAdmin) {
      setSellers([]);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');

      if (fetchError) throw fetchError;

      const sellersWithInfo = (data ?? [])
        .filter(
          (profile): profile is typeof profile & { user_id: string } => profile.user_id !== null,
        )
        .map((profile) => ({
          id: profile.user_id,
          full_name: profile.full_name,
          email: profile.full_name || 'Vendedor',
        }));

      setSellers(sellersWithInfo);
    } catch (err) {
      logger.error('Error fetching sellers:', err);
    }
  }, [user, isAdmin]);

  const createTemplate = useCallback(
    async (input: CreateTemplateInput) => {
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para criar templates',
          variant: 'destructive',
        });
        return null;
      }

      try {
        if (input.is_default) {
          const resetPayload: TablesUpdate<'quote_templates'> = { is_default: false };
          await supabase
            .from('quote_templates')
            .update(resetPayload)
            .eq('seller_id', user.id)
            .eq('is_default', true);
        }

        const insertPayload: TablesInsert<'quote_templates'> = {
          seller_id: user.id,
          name: input.name,
          description: input.description || null,
          is_default: input.is_default ?? false,
          items: structuredClone(input.items ?? []) as unknown as Json,
          template_data: {},
          discount_percent: input.discount_percent || 0,
          discount_amount: input.discount_amount || 0,
          notes: input.notes || null,
          internal_notes: input.internal_notes || null,
          payment_terms: input.payment_terms || null,
          delivery_time: input.delivery_time || null,
          validity_days: input.validity_days || 30,
        };

        const { data: inserted, error: insErr } = await supabase
          .from('quote_templates')
          .insert(insertPayload)
          .select('*');

        if (insErr) throw new Error(insErr.message);

        toast({
          title: 'Template criado',
          description: `Template "${input.name}" salvo com sucesso`,
        });
        await fetchTemplates();
        return inserted?.[0] || null;
      } catch (err) {
        logger.error('Error creating template:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar o template',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast, fetchTemplates],
  );

  const updateTemplate = useCallback(
    async (id: string, updates: Partial<CreateTemplateInput>) => {
      if (!user) return null;

      try {
        if (updates.is_default) {
          const resetPayload: TablesUpdate<'quote_templates'> = { is_default: false };
          await supabase
            .from('quote_templates')
            .update(resetPayload)
            .eq('seller_id', user.id)
            .eq('is_default', true);
        }

        const updatePayload: TablesUpdate<'quote_templates'> = {
          ...(updates as TablesUpdate<'quote_templates'>),
          updated_at: new Date().toISOString(),
        };
        if (updates.items) {
          updatePayload.items = structuredClone(updates.items) as unknown as Json;
        }

        const { data: result, error: updErr } = await supabase
          .from('quote_templates')
          .update(updatePayload)
          .eq('id', id)
          .select('*');

        if (updErr) throw new Error(updErr.message);

        toast({ title: 'Template atualizado', description: 'Alterações salvas com sucesso' });
        await fetchTemplates();
        return result?.[0] ? transformTemplates([result[0]])[0] : null;
      } catch (err) {
        logger.error('Error updating template:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível atualizar o template',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast, fetchTemplates],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      if (!user) return false;

      try {
        const { error: delErr } = await supabase.from('quote_templates').delete().eq('id', id);
        if (delErr) throw new Error(delErr.message);

        toast({ title: 'Template excluído', description: 'Template removido com sucesso' });
        await fetchTemplates();
        return true;
      } catch (err) {
        logger.error('Error deleting template:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível excluir o template',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast, fetchTemplates],
  );

  const setDefaultTemplate = useCallback(
    async (id: string) => {
      return updateTemplate(id, { is_default: true });
    },
    [updateTemplate],
  );

  const duplicateTemplate = useCallback(
    async (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (!template) return null;

      return createTemplate({
        name: `${template.name} (Cópia)`,
        description: template.description,
        is_default: false,
        items: template.items,
        discount_percent: template.discount_percent,
        discount_amount: template.discount_amount,
        notes: template.notes,
        internal_notes: template.internal_notes,
        payment_terms: template.payment_terms,
        delivery_time: template.delivery_time,
        validity_days: template.validity_days,
      });
    },
    [templates, createTemplate],
  );

  const cloneTemplateToSeller = useCallback(
    async (templateId: string, targetSellerId: string) => {
      if (!user || !isAdmin) {
        toast({
          title: 'Erro',
          description: 'Apenas administradores podem clonar templates entre vendedores',
          variant: 'destructive',
        });
        return null;
      }

      const template = allTemplates.find((t) => t.id === templateId);
      if (!template) {
        toast({ title: 'Erro', description: 'Template não encontrado', variant: 'destructive' });
        return null;
      }

      try {
        const insertPayload: TablesInsert<'quote_templates'> = {
          seller_id: targetSellerId,
          name: `${template.name} (Clonado)`,
          description: template.description || null,
          is_default: false,
          items: structuredClone(template.items ?? []) as unknown as Json,
          template_data: structuredClone(template.template_data ?? {}) as unknown as Json,
          discount_percent: template.discount_percent || 0,
          discount_amount: template.discount_amount || 0,
          notes: template.notes || null,
          internal_notes: template.internal_notes || null,
          payment_terms: template.payment_terms || null,
          delivery_time: template.delivery_time || null,
          validity_days: template.validity_days || 30,
        };

        const { data: inserted, error: insErr } = await supabase
          .from('quote_templates')
          .insert(insertPayload)
          .select('*');

        if (insErr) throw new Error(insErr.message);

        const targetSeller = sellers.find((s) => s.id === targetSellerId);
        toast({
          title: 'Template clonado',
          description: `Template "${template.name}" clonado para ${targetSeller?.full_name || 'vendedor'} com sucesso`,
        });

        await fetchAllTemplates();
        return inserted?.[0] || null;
      } catch (err) {
        logger.error('Error cloning template:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível clonar o template',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, isAdmin, allTemplates, sellers, toast, fetchAllTemplates],
  );

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllTemplates();
      fetchSellers();
    }
  }, [isAdmin, fetchAllTemplates, fetchSellers]);

  return {
    templates,
    allTemplates,
    sellers,
    loading,
    error,
    isAdmin,
    fetchTemplates,
    fetchAllTemplates,
    fetchSellers,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    duplicateTemplate,
    cloneTemplateToSeller,
  };
}
