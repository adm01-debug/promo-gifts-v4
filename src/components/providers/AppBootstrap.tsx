import { type ReactNode, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isSupabaseLighthousePlaceholder } from '@/lib/env/supabase-placeholder';

import { logger } from '@/lib/logger';
/**
 * AppBootstrap — shell global com fallback de manutenção sem bloquear o boot público.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    if (isSupabaseLighthousePlaceholder()) return;

    const checkMaintenance = async () => {
      try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        if (error) {
          logger.error('[AppBootstrap] Failed to fetch maintenance mode:', error);
          return;
        }

        if (data?.value === 'true') {
          setMaintenanceMode(true);
        }
      } catch (e) {
        logger.error('[AppBootstrap] Error during maintenance check:', e);
      }
    };

    checkMaintenance();
  }, []);

  if (maintenanceMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-warning/10">
            <AlertTriangle className="h-10 w-10 text-warning" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold">Sistema em Manutenção</h1>
            <p className="text-muted-foreground">
              Estamos realizando melhorias programadas. Voltaremos em breve!
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition-all duration-300 ease-out hover:bg-primary-hover"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
