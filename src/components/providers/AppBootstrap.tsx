import { type ReactNode, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOnboardingContext } from "@/contexts/OnboardingContext";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * AppBootstrap — Responsável por inicializações globais que dependem de autenticação.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  
  // Acessa o tour se disponível para garantir que possamos reiniciar via "?"
  // mas aqui o objetivo é garantir que o preview "abra" com os dados certos.
  
  useEffect(() => {
    if (!loading) {
      setBootstrapped(true);
    }
  }, [loading]);

  if (!bootstrapped) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
