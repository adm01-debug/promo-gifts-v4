import React, { useEffect, type CSSProperties } from 'react';
import {
  User,
  Menu,
  Heart,
  GitCompare,
  Search,
  LogOut,
  HelpCircle,
  Shield,
  MoreHorizontal,
  Palette,
  BookOpen,
  Tag,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { useBadgeVisibilityStore } from '@/stores/useBadgeVisibilityStore';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentSection } from '@/hooks/ui/useCurrentSection';
import { useIsScrolled } from '@/hooks/ui/useScroll';
import { useToast } from '@/hooks/ui/use-toast';
import { useOnboardingContext } from '@/contexts/OnboardingContext';

import { useSearchStore } from '@/stores/useSearchStore';
import { useWordMagicStore } from '@/stores/useWordMagicStore';

import { StockAlertsIndicator } from '@/components/inventory/StockAlertsIndicator';
import { NotificationBell } from '@/components/notifications/NotificationDrawer';
import { DiscountApprovalHeaderBadge } from '@/components/admin/DiscountApprovalHeaderBadge';

import { GlobalSearchPalette } from '@/components/search/GlobalSearchPalette';
import { CartHeaderButton } from '@/components/cart/CartHeaderButton';
import { cn } from '@/lib/utils';
import { RoleBadge } from '@/components/RoleBadge';
import { AppLogo } from '@/components/layout/AppLogo';

import { logger } from '@/lib/logger';
interface HeaderProps {
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}

export const Header = React.memo(({ onMenuToggle, sidebarOpen }: HeaderProps) => {
  const { actualTheme, tooltipStyle, setTooltipStyle, isFallback } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const favoriteCount = useFavoritesStore((s) => s.favoriteCount);
  const compareCount = useComparisonStore((s) => s.compareCount);
  const { user, profile, role, signOut, rolesLoaded } = useAuth();

  const toggleBadges = useBadgeVisibilityStore((s) => s.toggleBadges);
  const initializeFromProfile = useBadgeVisibilityStore((s) => s.initializeFromProfile);

  const badgesEnabled = useBadgeVisibilityStore((s) => {
    const settings = s.routeSettings[location.pathname];
    if (settings) {
      return actualTheme === 'dark' ? settings.dark : settings.light;
    }
    return s.badgesEnabled;
  });

  // Sync profile preferences with store
  useEffect(() => {
    if (profile?.preferences) {
      initializeFromProfile(profile.preferences);
    }
  }, [profile?.preferences, initializeFromProfile]);
  const currentSection = useCurrentSection();
  const { restartTour } = useOnboardingContext();
  const setOpenSearch = useSearchStore((s) => s.setOpen);

  const isScrolled = useIsScrolled(20);
  const { isGlobalAIMode, toggleGlobalAIMode } = useWordMagicStore();

  // Altura dinâmica do Header (px). Usada como --header-h para que stickys
  // filhos (breadcrumb, toolbars de catálogo) ancorem corretamente abaixo
  // do header em qualquer estado (compactado ou expandido).
  const headerHeightPx = isScrolled ? 48 : 56;

  // Propaga --header-h ao :root para que stickys fora da árvore do Header
  // (ex.: dentro de <main>) também leiam o valor atual.
  useEffect(() => {
    document.documentElement.style.setProperty('--header-h', `${headerHeightPx}px`);
  }, [headerHeightPx]);

  // Mantém --header-left em sincronia com o breakpoint desktop (lg = 1024px)
  // e a largura atual da sidebar (--sidebar-w). Em telas <lg, a sidebar é
  // off-canvas, então --header-left = 0.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => {
      const sidebarW =
        getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim() ||
        '16rem';
      document.documentElement.style.setProperty('--header-left', mq.matches ? sidebarW : '0px');
    };
    apply();
    mq.addEventListener('change', apply);
    // Observa mudanças no atributo style do <html> (quando sidebar atualiza --sidebar-w)
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      mq.removeEventListener('change', apply);
      obs.disconnect();
    };
  }, []);

  const handleToggleBadges = async () => {
    const success = await toggleBadges(location.pathname, actualTheme, user?.id);
    if (!success) {
      toast({
        variant: 'destructive',
        title: 'Erro de Sincronização',
        description:
          'Não foi possível salvar sua preferência no servidor. Ela será mantida apenas nesta sessão.',
      });
    }
  };

  const handleToggleTooltipStyle = () => {
    const nextStyle = tooltipStyle === 'compact' ? 'standard' : 'compact';
    setTooltipStyle(nextStyle);
    toast({
      title: `Dicas: ${nextStyle === 'compact' ? 'Compacto' : 'Padrão'}`,
      description: `O tamanho das dicas foi alterado para ${nextStyle === 'compact' ? 'Compacto (10px)' : 'Padrão (13px)'}.`,
    });
  };

  const handleSignOut = async () => {
    try {
      // Mostra toast imediato de processamento se desejar, ou apenas aguarda
      await signOut();
      toast({
        title: 'Até logo!',
        description: 'Você saiu da sua conta com segurança.',
      });
    } catch (err) {
      logger.error('[Header] signOut error:', err);
      toast({
        variant: 'destructive',
        title: 'Aviso',
        description:
          'Sessão encerrada localmente, mas houve um erro ao sincronizar com o servidor.',
      });
    } finally {
      // Força redirect para a página de login correta
      navigate('/login', { replace: true });
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  // #10 — Truncate inteligente: "Joaquim Ataides" → "Joaquim A."
  const truncatedName = (() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length <= 1) return displayName;
    if (displayName.length <= 12) return displayName;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  })();

  return (
    <header
      data-testid="app-header"
      style={
        {
          '--header-h': `${headerHeightPx}px`,
          left: 'var(--header-left, 0px)',
        } as CSSProperties
      }
      className={cn(
        'theme-transitioning fixed right-0 top-0 z-40 border-b transition-all duration-300 print:hidden',
        'border-border/10 bg-sidebar/60 backdrop-blur-xl',
        'h-[var(--header-h)]',
        isScrolled &&
          'border-border/30 bg-sidebar/80 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] backdrop-blur-2xl',
      )}
    >
      <div className="flex h-full items-center justify-between px-2 sm:px-4 lg:px-6">
        {/* ══════ Left section — Menu + Âncora contextual (#1) ══════ */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            onClick={onMenuToggle}
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="lg:hidden">
            <AppLogo
              showText
              iconClassName="h-8 w-8 sm:h-9 sm:w-9"
              textClassName="text-[14px] sm:text-[16px]"
              subtextClassName="text-[8px] sm:text-[9px]"
            />
          </div>

          {/* #1 — Seção atual como âncora */}
          <div className="hidden items-center gap-4 lg:flex">
            <div className="flex flex-col">
              <span className="mb-1 font-display text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-primary/60">
                Seção Atual
              </span>
              <span className="max-w-[150px] truncate font-display text-sm font-bold tracking-wide text-foreground">
                {currentSection}
              </span>
            </div>
          </div>
        </div>

        {/* ══════ Center section — Global Search (#4 expandida) ══════ */}
        <div className="mx-6 hidden max-w-2xl flex-1 md:block" data-tour="search">
          <GlobalSearchPalette />
        </div>

        {/* ══════ Right section — Agrupamento em clusters (#2) ══════ */}
        <div className="flex items-center gap-0.5 sm:gap-0.5">
          {isFallback && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mr-2 flex animate-pulse items-center gap-1 rounded border border-amber-200 bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-800">
                  <Shield className="h-3 w-3" />
                  <span className="hidden sm:inline">Theme Safe-Mode</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                O ThemeProvider não foi detectado. O sistema está rodando em modo de segurança com o
                tema padrão.
              </TooltipContent>
            </Tooltip>
          )}
          {/* Mobile search trigger */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir busca global"
            className="h-8 w-8 hover:bg-primary/10 hover:text-primary md:hidden"
            onClick={() => setOpenSearch(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* ── Cluster 1: Transacional (carrinho, notificações, alertas) ── */}
          <div className="flex items-center gap-1 px-1.5 py-1 sm:gap-1.5">
            <CartHeaderButton />
            <div className="mx-0.5 h-4 w-px bg-border/40" />
            <DiscountApprovalHeaderBadge />
            <NotificationBell />
            <div className="hidden items-center gap-1 md:flex">
              <div className="mx-0.5 h-4 w-px bg-border/40" />
              <StockAlertsIndicator />
            </div>
          </div>

          {/* Divider entre clusters (#2) */}
          <div className="mx-1.5 hidden h-5 w-px bg-border/60 md:block" />

          {/* ── Cluster 2: Utilitário (favoritos, comparar, tema) — desktop only ── */}
          <div className="hidden items-center gap-0.5 md:flex">
            {/* #5 — Tooltip com atalho */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Favoritar"
                  className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
                  onClick={() => navigate('/favoritos')}
                  onMouseEnter={() => {
                    import('@/pages/products/FavoritesPage');
                  }}
                >
                  <Heart className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {favoriteCount > 0 && (
                    <Badge className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-brand-primary p-0 text-[10px] font-bold text-brand-primary-foreground shadow-sm">
                      {favoriteCount > 99 ? '99+' : favoriteCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Favoritos{' '}
                <kbd className="ml-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Alt+F
                </kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="GitCompare"
                  className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
                  onClick={() => navigate('/comparar')}
                  onMouseEnter={() => {
                    import('@/pages/products/ComparePage');
                  }}
                >
                  <GitCompare className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {compareCount > 0 && (
                    <Badge className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-brand-primary p-0 text-[10px] font-bold text-brand-primary-foreground shadow-sm">
                      {compareCount > 4 ? '4' : compareCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Comparar{' '}
                <kbd className="ml-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Alt+C
                </kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleTooltipStyle}
                  className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground"
                  aria-label="Alternar tamanho do tooltip"
                >
                  <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Altere o tamanho do texto de Dicas para{' '}
                {tooltipStyle === 'compact' ? 'Padrão' : 'Compacto'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleBadges}
                  aria-label={
                    badgesEnabled ? 'Ocultar badges dos produtos' : 'Exibir badges dos produtos'
                  }
                  aria-pressed={badgesEnabled}
                  className={cn(
                    'relative h-8 w-8 rounded-full transition-all duration-200 hover:bg-primary/10 hover:text-foreground',
                    badgesEnabled ? 'text-muted-foreground' : 'text-muted-foreground/40',
                  )}
                >
                  <Tag className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {!badgesEnabled && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-[1.5px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current"
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Etiquetas dos Produtos —{' '}
                {badgesEnabled ? 'Clique para ocultar' : 'Clique para reativar'}
              </TooltipContent>
            </Tooltip>

            {/* Word Magic — toggle global Nativo ↔ IA */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleGlobalAIMode}
                  aria-label={isGlobalAIMode ? 'Desativar textos com IA' : 'Ativar textos com IA'}
                  aria-pressed={isGlobalAIMode}
                  className={cn(
                    'relative h-8 w-8 rounded-full transition-all duration-200 hover:bg-primary/10',
                    isGlobalAIMode
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  {isGlobalAIMode && (
                    <span
                      aria-hidden="true"
                      className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-violet-500 ring-1 ring-background"
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isGlobalAIMode
                  ? 'Modo IA ativo — clique para ver texto original'
                  : 'Ativar textos melhorados por IA'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* ── Mobile overflow menu (#8) ── */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-primary/10"
                  aria-label="Mais opções"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-border bg-card">
                <DropdownMenuItem onClick={() => navigate('/favoritos')} className="cursor-pointer">
                  <Heart className="mr-2 h-4 w-4" />
                  Favoritos
                  {favoriteCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 border-0 bg-brand-primary px-1.5 text-[10px] text-brand-primary-foreground">
                      {favoriteCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/comparar')} className="cursor-pointer">
                  <GitCompare className="mr-2 h-4 w-4" />
                  Comparar
                  {compareCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 border-0 bg-brand-primary px-1.5 text-[10px] text-brand-primary-foreground">
                      {compareCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleToggleTooltipStyle} className="cursor-pointer">
                  <Palette className="mr-2 h-4 w-4" />
                  Tooltips: {tooltipStyle === 'compact' ? 'Standard' : 'Compact'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="header-toggle-badges"
                  onClick={() => toggleBadges(location.pathname, actualTheme, user?.id)}
                  className="cursor-pointer"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Badges: {badgesEnabled ? 'Ocultar' : 'Exibir'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={toggleGlobalAIMode}
                  className={isGlobalAIMode ? 'text-violet-600 dark:text-violet-400' : ''}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  IA: {isGlobalAIMode ? 'Ativo — clique para desativar' : 'Ativar textos com IA'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Divider before avatar */}
          <div className="mx-1.5 hidden h-5 w-px bg-border/60 sm:block" />

          {/* ── User menu — com status online (#6) e truncate (#10) ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label={`Menu de usuário: ${displayName}`}
                data-testid="user-menu-trigger"
                className="flex h-10 items-center gap-3 rounded-xl px-2 transition-all duration-300 hover:bg-muted/40 sm:px-2.5"
              >
                <div className="group/avatar relative">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-muted transition-all duration-300 group-hover/avatar:border-primary/50 group-hover/avatar:shadow-[0_0_10px_rgba(var(--primary),0.3)]">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {/* #6 — Status online dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success shadow-sm ring-2 ring-background" />
                </div>
                <div className="hidden flex-col items-start lg:flex">
                  <span className="max-w-[120px] truncate text-sm font-medium leading-tight text-foreground">
                    {truncatedName}
                  </span>
                  {rolesLoaded ? (
                    <RoleBadge role={role} className="h-4 px-1.5 text-[9px] leading-none" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-4 w-12 animate-pulse rounded bg-muted/40"
                    />
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border bg-card">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                  {rolesLoaded ? (
                    <RoleBadge role={role} className="mt-1 self-start" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mt-1 h-5 w-16 animate-pulse self-start rounded bg-muted/40"
                    />
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onClick={() => navigate('/admin/temas')}
                    data-testid="user-menu-item-skins"
                    className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                  >
                    <Palette className="mr-2 h-4 w-4" />
                    Skins
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8} data-testid="user-menu-tooltip-skins">
                  <p>Personalize a aparência da plataforma (temas e cores)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/');
                      setTimeout(() => restartTour(), 300);
                    }}
                    data-testid="user-menu-item-guia-rapido"
                    className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Guia Rápido
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={8}
                  data-testid="user-menu-tooltip-guia-rapido"
                >
                  <p>Reiniciar o tour guiado pelas funcionalidades do sistema</p>
                </TooltipContent>
              </Tooltip>

              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* #9 — Barra sutil no bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5 opacity-50" />
    </header>
  );
});
