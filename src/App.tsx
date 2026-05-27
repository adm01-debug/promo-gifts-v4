import { Suspense, type ReactNode } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-config';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppBootstrap } from '@/components/providers/AppBootstrap';
import { AccessibilityProvider, AriaLiveProvider } from '@/components/a11y';
import { RootInteractivityGuard } from '@/components/system/RootInteractivityGuard';
import { RouteScrollReset } from '@/components/common/RouteScrollReset';
import { EnhancedErrorBoundary } from '@/components/errors/EnhancedErrorBoundary';
import { ThemeInitializer } from '@/components/ThemeInitializer';
import { useAppBootstrap } from '@/hooks/common/useAppBootstrap';
import { AppRoutes } from '@/routes/AppRoutes';
import { RoutePrefetcher } from '@/routes/RoutePrefetcher';
import { isSupabaseLighthousePlaceholder } from '@/lib/env/supabase-placeholder';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import './App.css';

const queryClient = createQueryClient();
const skipOptionalRootInfra = isSupabaseLighthousePlaceholder();
const LazyKillSwitchBanner = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/system/KillSwitchBanner').then((m) => ({
        default: m.KillSwitchBanner,
      })),
    );
const LazyCloudStatusBanner = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/system/CloudStatusBanner').then((m) => ({
        default: m.CloudStatusBanner,
      })),
    );
const LazyBridgeStatusBanner = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/BridgeStatusBanner').then((m) => ({
        default: m.BridgeStatusBanner,
      })),
    );
const LazyGlobalOfflineAlert = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/common/GlobalOfflineAlert').then((m) => ({
        default: m.GlobalOfflineAlert,
      })),
    );
const LazyDevOnlyBridgeOverlay = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/dev/DevOnlyBridgeOverlay').then((m) => ({
        default: m.DevOnlyBridgeOverlay,
      })),
    );
const LazyCloudStatusDot = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/system/CloudStatusDot').then((m) => ({ default: m.CloudStatusDot })),
    );

/** Internal container that runs hooks depending on AuthProvider. */
function AppBootstrapContainer({ children }: { children: ReactNode }) {
  useAppBootstrap();
  return <>{children}</>;
}

function OptionalCloudStatusDot() {
  if (!LazyCloudStatusDot) return null;
  return (
    <Suspense fallback={null}>
      <LazyCloudStatusDot />
    </Suspense>
  );
}

function OptionalKillSwitchBanner() {
  if (!LazyKillSwitchBanner) return null;
  return (
    <Suspense fallback={null}>
      <LazyKillSwitchBanner />
    </Suspense>
  );
}

function OptionalCloudStatusBanner() {
  if (!LazyCloudStatusBanner) return null;
  return (
    <Suspense fallback={null}>
      <LazyCloudStatusBanner />
    </Suspense>
  );
}

function OptionalBridgeStatusBanner() {
  if (!LazyBridgeStatusBanner) return null;
  return (
    <Suspense fallback={null}>
      <LazyBridgeStatusBanner />
    </Suspense>
  );
}

function OptionalGlobalOfflineAlert() {
  if (!LazyGlobalOfflineAlert) return null;
  return (
    <Suspense fallback={null}>
      <LazyGlobalOfflineAlert />
    </Suspense>
  );
}

function OptionalDevOnlyBridgeOverlay() {
  if (!LazyDevOnlyBridgeOverlay) return null;
  return (
    <Suspense fallback={null}>
      <LazyDevOnlyBridgeOverlay />
    </Suspense>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemeInitializer />
        <AccessibilityProvider>
          <AriaLiveProvider>
            <TooltipProvider delayDuration={1120}>
              {/*
               * Keep v7_startTransition disabled: under concurrent root work it can
               * update history before the matching route render commits.
               */}
              <BrowserRouter future={{ v7_relativeSplatPath: true }}>
                <AuthProvider>
                  <AppBootstrapContainer>
                    <AppBootstrap>
                      <EnhancedErrorBoundary>
                        <RootInteractivityGuard />
                        <Sonner />
                        <OptionalKillSwitchBanner />
                        <OptionalCloudStatusBanner />
                        <OptionalCloudStatusDot />
                        <OptionalBridgeStatusBanner />
                        <OptionalGlobalOfflineAlert />
                        <OptionalDevOnlyBridgeOverlay />
                        <RouteScrollReset />
                        <RoutePrefetcher />
                        <AppRoutes />
                      </EnhancedErrorBoundary>
                    </AppBootstrap>
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
