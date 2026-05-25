import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * AppBootstrap — shell global com fallback de manutenção sem bloquear o boot público.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();
        
        if (data && data.value === 'true') {
          setMaintenanceMode(true);
        }
      } catch (e) {
        console.error("Maintenance check failed:", e);
      }
    };

    checkMaintenance();
  }, []);

  if (maintenanceMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-warning/10 rounded-3xl flex items-center justify-center mx-auto">
            <AlertTriangle className="h-10 w-10 text-warning" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-display">Sistema em Manutenção</h1>
            <p className="text-muted-foreground">Estamos realizando melhorias programadas. Voltaremos em breve!</p>
          </div>
          <Button 
            className="w-full gap-2" 
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
