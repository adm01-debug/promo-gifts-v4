import { useState, Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { performanceTracker } from '@/utils/performance';
import { useScrollLockFix } from '@/hooks/ui/useScrollLockFix';
import { useGlobalShortcuts } from '@/hooks/ui/useGlobalShortcuts';

import { SkipToContent } from '@/components/common/SkipToContent';

import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Lazy load heavy layout components to reduce MainLayout chunk size
const Header = lazyWithRetry(() => import('./Header').then((m) => ({ default: m.Header })));
const SidebarReorganized = lazyWithRetry(() =>
  import('./SidebarReorganized').then((m) => ({ default: m.SidebarReorganized })),
);
const PageTransition = lazyWithRetry(() =>
  import('@/components/effects/PageTransition').then((m) => ({ default: m.PageTransition })),
);

// Context providers must be imported synchronously (consumers render inside them)
import { SellerCartProvider } from '@/contexts/SellerCartContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

import { GlobalOverlay } from './GlobalOverlay';
const GlobalCommandBar = lazyWithRetry(() =>
  import('@/components/command/GlobalCommandBar').then((m) => ({ default: m.GlobalCommandBar })),
);
const PersistentBreadcrumbs = lazyWithRetry(() =>
  import('@/components/common/PersistentBreadcrumbs').then((m) => ({
    default: m.PersistentBreadcrumbs,
  })),
);
import { cn } from '@/lib/utils';
import { ShortcutsHelpDialog } from '@/components/ui/ShortcutsHelpDialog';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useScrollLockFix();
  useGlobalShortcuts();

  useEffect(() => {
    performanceTracker.mark('main-layout-mounted');
    performanceTracker.measure(
      'Main Layout Mount',
      'route-start:' + location.pathname,
      'main-layout-mounted',
    );
  }, []);

  // Propaga --breadcrumb-h ao :root para que stickys filhos (toolbars de
  // página) ancorem corretamente abaixo do Header + Breadcrumb. Em "/" a
  // breadcrumb-bar fica oculta → 0px.
  useEffect(() => {
    document.documentElement.style.setProperty('--breadcrumb-h', isHome ? '0px' : '40px');
  }, [isHome]);

  // Focus management: move focus to main content on route changes for screen readers
  const mainRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      // Delay to allow page transition animation to start
      const timer = setTimeout(() => {
        mainRef.current?.focus({ preventScroll: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const layoutContent = (
    <div className="min-h-screen bg-background print:min-h-0" role="document">
      <GlobalOverlay />
      <ShortcutsHelpDialog />
      <div className="print:hidden">
        <SkipToContent />
      </div>

      <div className="flex">
        <div className="print:hidden">
          <Suspense
            fallback={
              <div className="hidden h-screen w-16 flex-shrink-0 border-r border-sidebar-border/10 bg-sidebar/5 lg:block lg:w-64" />
            }
          >
            <SidebarReorganized
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
            />
          </Suspense>
        </div>

        <div className="isolate flex min-h-screen min-w-0 flex-1 flex-col print:min-h-0">
          <Suspense fallback={<div style={{ height: 56 }} className="print:hidden" />}>
            <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
          </Suspense>

          <div
            aria-hidden="true"
            className="shrink-0 print:hidden"
            style={{ height: 'var(--header-h, 56px)' }}
          />

          <div
            className={cn(
              'theme-transitioning sticky z-30 transition-all duration-300 print:hidden',
              'bg-background/20 backdrop-blur-xl',
              'border-b border-border/40',
              isHome && 'hidden',
            )}
            style={{ top: 'var(--header-h, 56px)' }}
            data-testid="breadcrumb-bar"
          >
            <div className="mx-auto max-w-[1920px] px-3 py-1 sm:px-4 lg:px-6">
              <Suspense fallback={<div className="h-6" />}>
                <PersistentBreadcrumbs showBackButton />
              </Suspense>
            </div>
          </div>

          <main
            ref={mainRef}
            tabIndex={-1}
            id="main-content"
            className="theme-transitioning relative z-0 flex-1 overflow-x-clip bg-transparent p-3 pb-6 outline-none sm:p-4 lg:p-6 print:p-0 print:pb-0"
            role="main"
            aria-label="Conteúdo principal"
            aria-labelledby="main-heading"
          >
            <Suspense fallback={<div>{children || <Outlet />}</div>}>
              <PageTransition variant="fade-slide" duration={0.6}>
                {children || <Outlet />}
              </PageTransition>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );

  return (
    <OnboardingProvider>
      <SellerCartProvider>
        <Suspense fallback={layoutContent}>
          <GlobalCommandBar>{layoutContent}</GlobalCommandBar>
        </Suspense>
      </SellerCartProvider>
    </OnboardingProvider>
  );
}
