import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGlobalErrorCatcher } from "@/hooks/useErrorHandler";
import { markBootSuccessful } from "@/lib/chunk-recovery";
import { loadThemeConfig, applyThemePreset, applyRadius } from "@/lib/theme-presets";
import { startBridgeTelemetry } from "@/lib/external-db/bridge-telemetry-client";
import { startColdStartRecorder } from "@/lib/external-db/cold-start-recorder";
import { useCatalogPrefetch } from "@/hooks/useCatalogPrefetch";

/**
 * useAppBootstrap — Centraliza a lógica de inicialização do App.
 * Extraído de App.tsx para manter o componente principal limpo e focado no roteamento.
 */
export function useAppBootstrap() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { actualTheme } = useTheme();
  const location = useLocation();
  const initializedRef = useRef(false);

  useGlobalErrorCatcher();
  useCatalogPrefetch();

  // 1. Telemetria e Infra (Idempotente)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    startBridgeTelemetry();
    startColdStartRecorder();
    
    // Limpa marcador de chunk-recovery após boot bem-sucedido
    markBootSuccessful();
  }, []);

  // 2. Sincronização de Tema e Configurações Visuais
  useEffect(() => {
    const cfg = loadThemeConfig();
    applyThemePreset(cfg.presetId, actualTheme);
    applyRadius(cfg.radius);
  }, [actualTheme]);

  // 3. Gestão de Conectividade
  useEffect(() => {
    const handleStatusChange = () => {
      // Futuro: Adicionar lógica de toast de offline/online global
    };

    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);

    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  // 4. Lógica de Scroll Progressivo em Navegação
  const isHome = location.pathname === "/";
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--breadcrumb-h",
      isHome ? "0px" : "40px"
    );
  }, [isHome]);

  return {
    isHome,
    authLoading,
    isAuthenticated
  };
}
