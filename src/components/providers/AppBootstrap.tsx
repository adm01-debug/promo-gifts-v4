import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * AppBootstrap — Responsável por inicializações globais que dependem de autenticação.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const { isLoading: loading } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  // Acessa o tour se disponível para garantir que possamos reiniciar via "?"
  // mas aqui o objetivo é garantir que o preview "abra" com os dados certos.

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
        console.error('Maintenance check failed:', e);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenance();

    if (!loading) {
      setBootstrapped(true);
    }
  }, [loading]);

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
          <Button className="w-full gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!bootstrapped || checkingMaintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
