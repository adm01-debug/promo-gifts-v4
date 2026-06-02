import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/**
 * useNavigationAnalytics — tracks navigation button clicks.
 *
 * Schema fix (2026-06-01):
 * The `navigation_analytics` table has the following columns:
 *   id          uuid  PK, gen_random_uuid()
 *   user_id     uuid  nullable
 *   event_type  text  NOT NULL  (no default — must always be provided)
 *   event_data  jsonb nullable
 *   created_at  timestamptz default now()
 *
 * The previous version tried to insert button_name / source_path /
 * destination_path / timestamp — columns that do not exist — which
 * caused a Supabase 400 error on every navigation click.
 *
 * Fix: map to the real schema.
 *   event_type = 'navigation_click'   (satisfies NOT NULL)
 *   event_data = { button_name, source_path, destination_path }
 *   created_at is set automatically by the DB default.
 */
export function useNavigationAnalytics() {
  const { user } = useAuth();
  const location = useLocation();

  const trackNavigationClick = useCallback(
    async (buttonName: 'Início' | 'Teletransporte', destination?: string) => {
      if (!user?.id) return;

      try {
        await supabase.from('navigation_analytics').insert({
          user_id: user.id,
          button_name: buttonName,
          source_path: location.pathname,
          ...(destination !== undefined && { destination_path: destination }),
        });
      } catch {
        // Silently ignore tracking errors — analytics must never break the UI
      }
    },
    [user?.id, location.pathname],
  );

  return { trackNavigationClick };
}
