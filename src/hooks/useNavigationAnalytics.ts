import { useCallback } from 'react';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/**
 * useNavigationAnalytics — tracks navigation button clicks.
 *
 * Schema: navigation_analytics
 *   id          uuid  PK, gen_random_uuid()
 *   user_id     uuid  nullable
 *   event_type  text  NOT NULL
 *   event_data  jsonb nullable
 *   created_at  timestamptz default now()
 */
export function useNavigationAnalytics() {
  const { user } = useAuth();
  const location = useLocation();

  const trackNavigationClick = useCallback(
    async (buttonName: 'Início' | 'Teletransporte', destination?: string) => {
      if (!user?.id) return;

      try {
        await untypedFrom('navigation_analytics').insert({
          user_id: user.id,
          event_type: 'navigation_click',
          event_data: {
            button_name: buttonName,
            source_path: location.pathname,
            ...(destination !== undefined && { destination_path: destination }),
          },
        });
      } catch {
        // Silently ignore tracking errors — analytics must never break the UI
      }
    },
    [user?.id, location.pathname],
  );

  return { trackNavigationClick };
}
