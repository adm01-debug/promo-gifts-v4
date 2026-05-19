import { useState, Suspense, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useScrollLockFix } from "@/hooks/ui/useScrollLockFix";
import { useGlobalShortcuts } from "@/hooks/ui";
import { SkipToContent } from "@/components/common/SkipToContent";
import { BackButton } from "@/components/common/BackButton";

import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load heavy layout components to reduce MainLayout chunk size
const Header = lazyWithRetry(() => import("./Header").then(m => ({ default: m.Header })));
const SidebarReorganized = lazyWithRetry(() => import("./SidebarReorganized").then(m => ({ default: m.SidebarReorganized })));
const PageTransition = lazyWithRetry(() => import("@/components/effects/PageTransition").then(m => ({ default: m.PageTransition })));

// Context providers must be imported synchronously (consumers render inside them)
import { SellerCartProvider } from "@/contexts/SellerCartContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";

import { GlobalOverlay } from "./GlobalOverlay";
const GlobalCommandBar = lazyWithRetry(() => import("@/components/command/GlobalCommandBar").then(m => ({ default: m.GlobalCommandBar })));
const PersistentBreadcrumbs = lazyWithRetry(() => import("@/components/common/PersistentBreadcrumbs").then(m => ({ default: m.PersistentBreadcrumbs })));
import { cn } from "@/lib/utils";

import { Outlet } from "react-router-dom";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const isMockupGenerator = location.pathname === "/mockup-generator";
  const isHome = location.pathname === "/";

  useScrollLockFix();
  useGlobalShortcuts();

  // Propaga --breadcrumb-h ao :root para que stickys filhos (toolbars de
  // página) ancorem corretamente abaixo do Header + Breadcrumb. Em "/" a
  // breadcrumb-bar fica oculta → 0px.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--breadcrumb-h",
      isHome ? "0px" : "40px",
    );
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
      <div className="print:hidden">
        <SkipToContent />
      </div>
      
      <div className="flex">
        <div className="print:hidden">
          <Suspense fallback={<div className="hidden lg:block w-64 h-screen flex-shrink-0" />}>
            <SidebarReorganized 
              isOpen={sidebarOpen} 
              onToggle={() => setSidebarOpen(!sidebarOpen)} 
            />
          </Suspense>
        </div>
        
        <div className="flex-1 flex flex-col min-h-screen min-w-0 print:min-h-0 isolate">
          <Suspense fallback={<div style={{ height: 56 }} className="print:hidden" />}>
            <Header 
              onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </Suspense>

          <div
            aria-hidden="true"
            className="print:hidden shrink-0"
            style={{ height: "var(--header-h, 56px)" }}
          />

          <div
            className={cn(
              "sticky z-30 print:hidden transition-all duration-300",
              "bg-background/20 backdrop-blur-xl",
              "border-b border-border/40",
              isHome && "hidden",
            )}
            style={{ top: "var(--header-h, 56px)" }}
            data-testid="breadcrumb-bar"
          >
            <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-2">
              <Suspense fallback={<div className="h-6" />}>
                <PersistentBreadcrumbs showBackButton />
              </Suspense>
            </div>
          </div>

          <main
            ref={mainRef}
            tabIndex={-1}
            id="main-content" 
            className="flex-1 p-3 sm:p-4 lg:p-6 pb-6 print:p-0 print:pb-0 outline-none overflow-x-clip bg-transparent" 
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
          <GlobalCommandBar>
            {layoutContent}
          </GlobalCommandBar>
        </Suspense>
      </SellerCartProvider>
    </OnboardingProvider>
  );
}
