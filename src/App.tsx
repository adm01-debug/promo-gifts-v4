import { Suspense, type ReactNode } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-config';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppBootstrap } from '@/components/providers/AppBootstrap';
import { MotionProvider } from '@/components/providers/MotionProvider';
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
const LazyCloudStatusBanner = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/system/CloudStatusBanner').then((m) => ({
        default: m.CloudStatusBanner,
      })),
    );
const LazyGlobalOfflineAlert = skipOptionalRootInfra
  ? null
  : lazyWithRetry(() =>
      import('@/components/common/GlobalOfflineAlert').then((m) => ({
        default: m.GlobalOfflineAlert,
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

function OptionalCloudStatusBanner() {
  if (!LazyCloudStatusBanner) return null;
  return (
    <Suspense fallback={null}>
      <LazyCloudStatusBanner />
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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="fixed inset-0 z-[-10] bg-[#030508]" />
        <ThemeInitializer />
        <Suspense fallback={<div className="min-h-screen bg-[#030508]" />}>
          <AccessibilityProvider>
            <AriaLiveProvider>
            <TooltipProvider delayDuration={400} skipDelayDuration={200}>
              {/*
               * Keep v7_startTransition disabled: under concurrent root work it can
               * update history before the matching route render commits.
               */}
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                  <AppBootstrapContainer>
                    <AppBootstrap>
                      <MotionProvider>
                        <EnhancedErrorBoundary>
                          <RootInteractivityGuard />
                          <Sonner />
                          <OptionalCloudStatusBanner />
                          <OptionalCloudStatusDot />
                          <OptionalGlobalOfflineAlert />
                          <RouteScrollReset />
                          <RoutePrefetcher />
                          <AppRoutes />
                        </EnhancedErrorBoundary>
                      </MotionProvider>
                    </AppBootstrap>
                  </AppBootstrapContainer>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
            </AriaLiveProvider>
          </AccessibilityProvider>
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
