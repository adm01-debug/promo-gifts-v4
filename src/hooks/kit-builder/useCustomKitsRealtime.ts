/**
 * useCustomKitsRealtime — Subscribes to changes on custom_kits for the current
 * user so multiple tabs / devices stay in sync. Falls back gracefully if the
 * realtime channel cannot be established (the polling staleTime keeps the data fresh).
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export function useCustomKitsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user:${user.id}:custom-kits`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_kits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['custom-kits'] });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn(
            '[useCustomKitsRealtime] channel error — polling staleTime maintains freshness',
            { status, err },
          );
          queryClient.invalidateQueries({ queryKey: ['custom-kits'] });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
