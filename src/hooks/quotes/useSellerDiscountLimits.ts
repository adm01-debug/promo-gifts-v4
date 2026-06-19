/**
 * useSellerDiscountLimits — Gerencia limites de desconto por vendedor
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
export interface SellerDiscountLimit {
  id: string;
  user_id: string;
  max_discount_percent: number;
  set_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useSellerDiscountLimits() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<SellerDiscountLimit[]>([]);
  const [myLimit, setMyLimit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch own limit (for sellers)
  const fetchMyLimit = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('seller_discount_limits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setMyLimit(data?.max_discount_percent ?? null);
  }, [user]);

  // Fetch all limits (for admins)
  const fetchAllLimits = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('seller_discount_limits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('Error fetching discount limits:', error);
    } else {
      setLimits(data ?? []);
    }
    setIsLoading(false);
  }, []);

  // Set/update limit for a seller
  const setLimit = useCallback(
    async (userId: string, maxPercent: number, notes?: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const { error } = await supabase.from('seller_discount_limits').upsert(
          {
            user_id: userId,
            max_discount_percent: maxPercent,
            set_by: user.id,
            notes: notes || null,
          },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        toast.success('Limite de desconto atualizado!');
        return true;
      } catch (err) {
        logger.error('Error setting discount limit:', err);
        toast.error('Erro ao definir limite de desconto');
        return false;
      }
    },
    [user],
  );

  // Delete limit
  const deleteLimit = useCallback(async (limitId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('seller_discount_limits').delete().eq('id', limitId);
      if (error) throw error;
      toast.success('Limite removido');
      return true;
    } catch (err) {
      logger.error('Error deleting limit:', err);
      toast.error('Erro ao remover limite');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchMyLimit();
  }, [fetchMyLimit]);

  return {
    limits,
    myLimit,
    isLoading,
    fetchAllLimits,
    fetchMyLimit,
    setLimit,
    deleteLimit,
  };
}
