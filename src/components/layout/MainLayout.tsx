import { useState, Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { performanceTracker } from '@/utils/performance';
import { useScrollLockFix } from '@/hooks/ui/useScrollLockFix';
import { useMobileSidebarFix } from '@/hooks/ui/useMobileSidebarFix';
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
const StarBackground = lazyWithRetry(() =>
  import('@/components/effects/StarBackground').then((m) => ({ default: m.StarBackground })),
);

// Context providers must be imported synchronously (consumers render inside them)
import { SellerCartProvider } from '@/contexts/SellerCartContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

import { GlobalOverlay } from './GlobalOverlay';
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
  useMobileSidebarFix(() => setSidebarOpen(false), sidebarOpen);
  useGlobalShortcuts();

  useEffect(() => {
    performanceTracker.mark('main-layout-mounted');
    performanceTracker.measure(
      'Main Layout Mount',
      `route-start:${location.pathname}`,
      'main-layout-mounted',
    );
  }, [location.pathname]);

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
      // Focus main content immediately to be caught by screen readers
      // but prevent scroll to allow RouteScrollReset or manual scroll restoration to work.
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  const layoutContent = (
    // overflow-x-hidden previne bleed horizontal de elementos internos
    // sem quebrar posicionamentos fixed/sticky que usam transform proprio
    <div className="min-h-screen overflow-x-hidden bg-background print:min-h-0" role="document">
      <div className="fixed inset-0 z-[-1]">
        <Suspense fallback={null}>
          <StarBackground />
        </Suspense>
      </div>
      <GlobalOverlay />
      <ShortcutsHelpDialog />
      <div className="print:hidden">
        <SkipToContent />
      </div>

      <div className="flex">
        <div className="print:hidden">
          <Suspense
            fallback={
              <div className="hidden h-screen w-16 flex-shrink-0 border-r border-sidebar-border/10 bg-sidebar/5 lg:block lg:w-64">
                <div className="flex flex-col items-center justify-center px-3 py-4 sm:px-4 2xl:px-5 2xl:py-5 ultra-wide:px-6 ultra-wide:py-6">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-sidebar-foreground/10" />
                  <div className="mt-4 hidden h-4 w-32 animate-pulse rounded bg-sidebar-foreground/5 lg:block" />
                </div>
              </div>
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
              !isHome
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none -translate-y-full opacity-0',
            )}
            aria-hidden={isHome}
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
            className="theme-transitioning relative z-0 flex-1 overflow-x-clip bg-background/30 p-2 pb-6 outline-none sm:p-4 lg:p-6 print:p-0 print:pb-0"
            role="main"
            aria-label="Conteúdo principal"
            aria-labelledby="main-heading"
          >
            <Suspense fallback={<div>{children || <Outlet />}</div>}>
              {/*
                FIX scroll quebrado em /produto/:id, /novidades, /reposicao:
                a variant `fade-slide` deixa `transform: translateY(0px)` inline
                no wrapper depois da animação. Esse transform cria um novo
                containing block que (a) faz o ProductStickyHeader (position:
                fixed) ancorar no wrapper em vez do viewport e (b) corrompe a
                medição do useWindowVirtualizer (getBoundingClientRect.top +
                window.scrollY passa a refletir a translação interna), zerando
                a barra de rolagem. `fade` só anima opacity → sem transform
                residual → scroll/sticky voltam a funcionar.
              */}
              <PageTransition variant="fade" duration={0.6}>
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
      <SellerCartProvider>{layoutContent}</SellerCartProvider>
    </OnboardingProvider>
  );
}
