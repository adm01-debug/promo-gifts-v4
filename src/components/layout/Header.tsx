import React, { useEffect, type CSSProperties } from "react";
import { User, Menu, Sun, Moon, Heart, GitCompare, Search, LogOut, Settings, HelpCircle, Shield, MoreHorizontal, Palette, RotateCcw } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { useComparisonStore } from "@/stores/useComparisonStore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useOnboardingContext } from "@/contexts/OnboardingContext";

import { StockAlertsIndicator } from "@/components/inventory/StockAlertsIndicator";
import { NotificationBell } from "@/components/notifications/NotificationDrawer";
import { DiscountApprovalHeaderBadge } from "@/components/admin/DiscountApprovalHeaderBadge";

import { GlobalSearchPalette } from "@/components/search/GlobalSearchPalette";
import { CartHeaderButton } from "@/components/cart/CartHeaderButton";
import { useIsScrolled } from "@/hooks/useScroll";
import { useCurrentSection } from "@/hooks/useCurrentSection";
import { cn } from "@/lib/utils";
import { getRoleLabel } from "@/lib/roles";
import { RoleBadge } from "@/components/RoleBadge";

interface HeaderProps {
  onMenuToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const Header = React.memo(function Header({ onMenuToggle, searchQuery, onSearchChange }: HeaderProps) {
  const { theme, actualTheme, setTheme, toggleTheme, isFallback } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const favoriteCount = useFavoritesStore((s) => s.favoriteCount);
  const compareCount = useComparisonStore((s) => s.compareCount);
  const { user, profile, role, isAdmin, signOut, rolesLoaded } = useAuth();
  const currentSection = useCurrentSection();
  const { restartTour, hasCompletedTour, isLoading: onboardingLoading } = useOnboardingContext();

  const isScrolled = useIsScrolled(20);

  // Altura dinâmica do Header (px). Usada como --header-h para que stickys
  // filhos (breadcrumb, toolbars de catálogo) ancorem corretamente abaixo
  // do header em qualquer estado (compactado ou expandido).
  const headerHeightPx = isScrolled ? 48 : 56;

  // Propaga --header-h ao :root para que stickys fora da árvore do Header
  // (ex.: dentro de <main>) também leiam o valor atual.
  useEffect(() => {
    document.documentElement.style.setProperty("--header-h", `${headerHeightPx}px`);
  }, [headerHeightPx]);

  // Mantém --header-left em sincronia com o breakpoint desktop (lg = 1024px)
  // e a largura atual da sidebar (--sidebar-w). Em telas <lg, a sidebar é
  // off-canvas, então --header-left = 0.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      const sidebarW = getComputedStyle(document.documentElement)
        .getPropertyValue("--sidebar-w")
        .trim() || "16rem";
      document.documentElement.style.setProperty(
        "--header-left",
        mq.matches ? sidebarW : "0px",
      );
    };
    apply();
    mq.addEventListener("change", apply);
    // Observa mudanças no atributo style do <html> (quando sidebar atualiza --sidebar-w)
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => {
      mq.removeEventListener("change", apply);
      obs.disconnect();
    };
  }, []);

  const handleToggleTheme = () => {
    if (theme === "auto") {
      setTheme(actualTheme === "dark" ? "light" : "dark");
      return;
    }
    toggleTheme();
  };

  const handleSignOut = async () => {
    try {
      // Mostra toast imediato de processamento se desejar, ou apenas aguarda
      await signOut();
      toast({
        title: "Até logo!",
        description: "Você saiu da sua conta com segurança.",
      });
    } catch (err) {
      console.error("[Header] signOut error:", err);
      toast({
        variant: "destructive",
        title: "Aviso",
        description: "Sessão encerrada localmente, mas houve um erro ao sincronizar com o servidor.",
      });
    } finally {
      // Força redirect para a página de login correta
      navigate("/login", { replace: true });
    }
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuário";
  const roleLabel = getRoleLabel(role);

  // #10 — Truncate inteligente: "Joaquim Ataides" → "Joaquim A."
  const truncatedName = (() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length <= 1) return displayName;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  })();

  return (
    <header
      data-testid="app-header"
      style={{
        "--header-h": `${headerHeightPx}px`,
        left: "var(--header-left, 0px)",
      } as CSSProperties}
      className={cn(
        "fixed top-0 right-0 z-40 border-b transition-all duration-300 print:hidden",
        "bg-transparent backdrop-blur-none border-transparent",
        "h-[var(--header-h)]",
        isScrolled && "bg-card/40 backdrop-blur-xl shadow-lg border-border/20",
      )}
    >
      <div className="flex items-center justify-between h-full px-2 sm:px-4 lg:px-6">
        {/* ══════ Left section — Menu + Âncora contextual (#1) ══════ */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-primary/10 hover:text-primary h-8 w-8 sm:h-9 sm:w-9"
            onClick={onMenuToggle}
           aria-label="Menu"><Menu className="h-5 w-5" />
          </Button>

          {/* #1 — Seção atual como âncora */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="font-display text-sm font-bold text-primary tracking-wider uppercase truncate max-w-[160px] drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">
              {currentSection}
            </span>
          </div>
        </div>

        {/* ══════ Center section — Global Search (#4 expandida) ══════ */}
        <div className="flex-1 max-w-lg mx-4 hidden md:block" data-tour="search">
          <GlobalSearchPalette />
        </div>

        {/* ══════ Right section — Agrupamento em clusters (#2) ══════ */}
        <div className="flex items-center gap-0.5 sm:gap-0.5">
          {isFallback && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-[10px] font-medium mr-2 flex items-center gap-1 animate-pulse border border-amber-200">
                  <Shield className="h-3 w-3" />
                  <span className="hidden sm:inline">Theme Safe-Mode</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-xs">
                O ThemeProvider não foi detectado. O sistema está rodando em modo de segurança com o tema padrão.
              </TooltipContent>
            </Tooltip>
          )}
          {/* Mobile search trigger */}
          <Button
            variant="ghost"
            size="icon" 
            aria-label="Abrir busca global"
            className="md:hidden h-8 w-8 hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
              document.dispatchEvent(event);
            }}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* ── Cluster 1: Transacional (carrinho, notificações, alertas) ── */}
          <div className="flex items-center gap-0.5">
            <CartHeaderButton />
            <DiscountApprovalHeaderBadge />
            <NotificationBell />
            <div className="hidden md:block">
              <StockAlertsIndicator />
            </div>
          </div>

          {/* Divider entre clusters (#2) */}
          <div className="h-5 w-px bg-border/60 mx-1.5 hidden md:block" />

          {/* ── Cluster 2: Utilitário (favoritos, comparar, tema) — desktop only ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {/* #5 — Tooltip com atalho */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon" aria-label="Favoritar"
                  className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200"
                  onClick={() => navigate("/favoritos")}
                  onMouseEnter={() => {
                    import("../../pages/FavoritesPage");
                  }}
                >
                  <Heart className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {favoriteCount > 0 && (
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] bg-orange text-orange-foreground border-0">
                      {favoriteCount > 99 ? "99+" : favoriteCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs">
                Favoritos <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">Alt+F</kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon" aria-label="GitCompare"
                  className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200"
                  onClick={() => navigate("/comparar")}
                  onMouseEnter={() => {
                    import("../../pages/ComparePage");
                  }}
                >
                  <GitCompare className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {compareCount > 0 && (
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] bg-orange text-orange-foreground border-0">
                      {compareCount > 4 ? "4" : compareCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs">
                Comparar <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">Alt+C</kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleTheme}
                  className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200"
                 aria-label="Tema claro"><Sun className="h-[17px] w-[17px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" strokeWidth={1.75} />
                  <Moon className="absolute h-[17px] w-[17px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" strokeWidth={1.75} />
                  <span className="sr-only">Alternar tema</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs">
                {actualTheme === "dark" ? "Modo Claro" : "Modo Escuro"} <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">Alt+T</kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* ── Mobile overflow menu (#8) ── */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem onClick={() => navigate("/favoritos")} className="cursor-pointer">
                  <Heart className="h-4 w-4 mr-2" />
                  Favoritos
                  {favoriteCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-orange text-orange-foreground border-0">
                      {favoriteCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/comparar")} className="cursor-pointer">
                  <GitCompare className="h-4 w-4 mr-2" />
                  Comparar
                  {compareCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-orange text-orange-foreground border-0">
                      {compareCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleToggleTheme} className="cursor-pointer">
                  {actualTheme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {actualTheme === "dark" ? "Modo Claro" : "Modo Escuro"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Divider before avatar */}
          <div className="h-5 w-px bg-border/60 mx-1.5 hidden sm:block" />

          {/* ── User menu — com status online (#6) e truncate (#10) ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label={`Menu de usuário: ${displayName}`}
                className="flex items-center gap-2 h-9 px-1.5 sm:px-2 hover:bg-primary/10 rounded-lg"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center ring-2 ring-background shadow-md">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <User className="h-4 w-4 text-primary-foreground" />
                    )}
                  </div>
                  {/* #6 — Status online dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full ring-2 ring-background" />
                </div>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium text-foreground leading-tight truncate max-w-[120px]">
                    {truncatedName}
                  </span>
                  {rolesLoaded ? (
                    <RoleBadge role={role} className="h-4 px-1.5 text-[9px] leading-none" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-4 w-12 rounded bg-muted/40 animate-pulse"
                    />
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                  {rolesLoaded ? (
                    <RoleBadge role={role} className="self-start mt-1" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="self-start mt-1 h-5 w-16 rounded bg-muted/40 animate-pulse"
                    />
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => navigate("/admin/temas")}
                className="hover:bg-primary/10 focus:bg-primary/10 cursor-pointer"
              >
                <Palette className="h-4 w-4 mr-2" />
                Skins
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-primary/10 focus:bg-primary/10 cursor-pointer">
                <HelpCircle className="h-4 w-4 mr-2" />
                Ajuda
              </DropdownMenuItem>
              {!onboardingLoading && hasCompletedTour && (
                <DropdownMenuItem
                  onClick={() => restartTour()}
                  className="hover:bg-primary/10 focus:bg-primary/10 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reiniciar Tour
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* #9 — Barra colorida de seção no bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/80 via-primary to-primary/40 opacity-60" />
    </header>
  );
});
