import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

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
          destination_path: destination,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Silently ignore tracking errors
      }
    },
    [user?.id, location.pathname],
  );

  return { trackNavigationClick };
}
