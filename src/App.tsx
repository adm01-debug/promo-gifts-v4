import { type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-config";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppProviders } from "@/components/providers/AppProviders";
import { AccessibilityProvider, AriaLiveProvider } from "@/components/a11y";
import { BridgeStatusBanner } from "@/components/BridgeStatusBanner";
import { CloudStatusBanner } from "@/components/system/CloudStatusBanner";
import { CloudStatusDot } from "@/components/system/CloudStatusDot";
import { GlobalOfflineAlert } from "@/components/common/GlobalOfflineAlert";
import { DevOnlyBridgeOverlay } from "@/components/dev/DevOnlyBridgeOverlay";
import { RouteScrollReset } from "@/components/common/RouteScrollReset";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { AppRoutes } from "@/routes/AppRoutes";
import { RoutePrefetcher } from "@/routes/RoutePrefetcher";
import "./App.css";

const queryClient = createQueryClient();

/** Internal container that runs hooks depending on AuthProvider. */
function AppBootstrapContainer({ children }: { children: ReactNode }) {
  useAppBootstrap();
  return <>{children}</>;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemeInitializer />
        <AccessibilityProvider>
          <AriaLiveProvider>
            <TooltipProvider>
              <BrowserRouter future={{ v7_relativeSplatPath: true }}>
                <AuthProvider>
                  <AppBootstrapContainer>
                    <ErrorBoundary>
                      <AppProviders>
                        <Toaster />
                        <Sonner />
                        <CloudStatusBanner />
                        <CloudStatusDot />
                        <BridgeStatusBanner />
                        <GlobalOfflineAlert />
                        <DevOnlyBridgeOverlay />
                        <RouteScrollReset />
                        <RoutePrefetcher />
                        <AppRoutes />
                      </AppProviders>
                    </ErrorBoundary>
                  </AppBootstrapContainer>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
          </AriaLiveProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
