import { useState, useEffect, forwardRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getPrefetchHandlers } from "@/lib/routePrefetch";
import {
  Home,
  Package,
  FileText,

  Plus,
  Heart,
  Wand2, ShoppingCart, Calculator,
  FolderOpen,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  icon: typeof Home;
  label: string;
  href: string;
  ariaLabel?: string;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: "Início", href: "/", ariaLabel: "Ir para página inicial" },
  { icon: Package, label: "Produtos", href: "/filtros", ariaLabel: "Ver catálogo de produtos" },
  // FAB placeholder
  { icon: Plus, label: "Ação", href: "#fab", ariaLabel: "Ação rápida" },
  { icon: FileText, label: "Orçamentos", href: "/orcamentos", ariaLabel: "Gerenciar orçamentos" },
  { icon: ShoppingCart, label: "Carrinhos", href: "/carrinhos", ariaLabel: "Gerenciar carrinhos" },
];

const quickActions: NavItem[] = [
  { icon: FileText, label: "Novo Orçamento", href: "/orcamentos/novo" },
  { icon: Heart, label: "Favoritos", href: "/favoritos" },
  { icon: Wand2, label: "Mockup", href: "/mockup-generator" },
  { icon: Calculator, label: "Simulador", href: "/simulador" },
  { icon: FolderOpen, label: "Coleções", href: "/colecoes" },
];

export const SmartMobileNav = forwardRef<HTMLDivElement>(function SmartMobileNav(_props, _ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Hide nav when scrolling down, show when scrolling up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 50) {
        setIsScrollingUp(true);
      } else if (currentScrollY > lastScrollY + 10) {
        setIsScrollingUp(false);
        setFabOpen(false);
      } else if (currentScrollY < lastScrollY - 10) {
        setIsScrollingUp(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const handleFabClick = () => {
    setFabOpen(!fabOpen);
  };

  const handleQuickAction = (href: string) => {
    setFabOpen(false);
    navigate(href);
  };

  return (
    <>
      {/* FAB Quick Actions Overlay */}
      <AnimatePresence>
        {fabOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
              onClick={() => setFabOpen(false)}
            />

            {/* Quick Actions Menu */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4 lg:hidden"
              style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 5rem), 6rem)' }}
            >
              <div className="bg-card rounded-2xl border border-border p-4 max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">Ações Rápidas</h3>
                  <button
                    onClick={() => setFabOpen(false)}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                    aria-label="Fechar menu"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {quickActions.map((item, index) => {
                    const Icon = item.icon;
                    const isItemActive = isActive(item.href);

                    return (
                      <motion.button
                        key={item.href}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleQuickAction(item.href)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl",
                          "min-h-[72px] touch-manipulation transition-all",
                          "active:scale-95",
                          isItemActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5 mb-1.5" aria-hidden="true" />
                        <span className="text-[10px] font-medium text-center leading-tight">
                          {item.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <motion.nav
        initial={{ y: 0 }}
        animate={{ y: isScrollingUp ? 0 : 100 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border lg:hidden"
        role="navigation"
        aria-label="Navegação principal mobile"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}
      >
        <div className="flex items-center justify-around h-14 sm:h-16 px-1 sm:px-2 relative">
          {mainNavItems.map((item, _index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isFab = item.href === "#fab";

            // FAB Button (center)
            if (isFab) {
              return (
                <div key="fab" className="relative -mt-4">
                  <motion.button
                    onClick={handleFabClick}
                    whileTap={{ scale: 0.9 }}
                    animate={{ rotate: fabOpen ? 45 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={cn(
                      "flex items-center justify-center w-14 h-14 rounded-full border border-border/40",
                      "transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      fabOpen
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                    aria-label={fabOpen ? "Fechar menu de ações" : "Abrir menu de ações"}
                    aria-expanded={fabOpen}
                  >
                    <Plus className="h-6 w-6" />
                  </motion.button>
                </div>
              );
            }

            const prefetch = getPrefetchHandlers(item.href);
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center min-w-[56px] sm:min-w-[64px] min-h-[44px] sm:min-h-[48px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all",
                  "touch-manipulation tap-highlight-transparent",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  "active:scale-95",
                  active 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-label={item.ariaLabel || item.label}
                aria-current={active ? "page" : undefined}
                onMouseEnter={prefetch.onMouseEnter}
                onTouchStart={prefetch.onTouchStart}
              >
                <Icon className={cn("h-5 w-5 sm:mb-1 transition-transform duration-200", active && "text-primary scale-110")} aria-hidden="true" />
                <span className="text-[9px] sm:text-[10px] font-medium leading-tight truncate max-w-[56px]">
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </div>
      </motion.nav>
    </>
  );
});
