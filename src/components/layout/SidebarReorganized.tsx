import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Package,
  Users,
  Heart,
  GitCompare,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calculator,
  Sparkles,
  FileText,
  ShoppingCart,
  Wrench,
  Zap,
  RefreshCw,
  DollarSign,
  Plus,
  Activity,
  Gauge,
  Truck,
  Palette,
  Brain,
  Workflow,
  Layers,
  SlidersHorizontal,
  Boxes,
  ImagePlus,
  BarChart3,
  Crosshair,
  Settings,
  Plug,
  ChevronsDownUp,
  Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarBrandHeader } from './sidebar/SidebarBrandHeader';
import { FocusTrap } from '@/components/ui/FocusTrap';
import { useMediaQuery } from '@/hooks/ui/useMediaQuery';
import { SidebarNavGroup, type NavGroup } from './sidebar/SidebarNavGroup';
import { RestrictedRouteNotice } from './sidebar/RestrictedRouteNotice';
import { isDevOnlyPath, isAdminOnlyPath } from '@/lib/navigation/restricted-routes';
import { isNavItemActive } from '@/lib/navigation/active-match';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navGroups: NavGroup[] = [
  {
    id: 'quotes',
    label: 'Orçamentos',
    icon: FileText,
    defaultOpen: true,
    items: [
      {
        icon: Plus,
        label: 'Novo Orçamento',
        href: '/orcamentos/novo',
        shortcut: 'Alt+N',
        tooltip: 'Monte uma proposta em poucos cliques e envie para o cliente agora mesmo.',
      },
      {
        icon: FileText,
        label: 'Orçamentos',
        href: '/orcamentos',
        tourId: 'quotes',
        exact: true,
        shortcut: 'Alt+O',
        tooltip: 'Acompanhe todas as suas propostas: abertas, aprovadas e em negociação.',
      },
      {
        icon: ShoppingCart,
        label: 'Carrinhos',
        href: '/carrinhos',
        shortcut: 'Alt+R',
        tooltip: 'Retome carrinhos salvos e transforme-os em orçamento sem perder tempo.',
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: Package,
    defaultOpen: true,
    items: [
      {
        icon: Package,
        label: 'Produtos',
        href: '/',
        tourId: 'products',
        shortcut: 'Alt+P',
        tooltip: 'Navegue pelo catálogo completo e encontre o brinde ideal para cada cliente.',
      },
      {
        icon: SlidersHorizontal,
        label: 'Super Filtro',
        href: '/filtros',
        shortcut: 'Alt+F',
        tooltip: 'Filtre por preço, cor, material e ocasião para chegar rápido no produto certo.',
      },
      {
        icon: Zap,
        label: 'Novidades',
        href: '/novidades',
        tooltip: 'Veja o que acabou de chegar e surpreenda o cliente com lançamentos exclusivos.',
      },
      {
        icon: RefreshCw,
        label: 'Reposição',
        href: '/reposicao',
        tooltip: 'Produtos que voltaram ao estoque — ótima chance de reativar pedidos antigos.',
      },
      {
        icon: Layers,
        label: 'Estoque',
        href: '/estoque',
        tooltip: 'Confira a disponibilidade antes de prometer prazo e evite frustrar o cliente.',
      },
      {
        icon: FolderOpen,
        label: 'Coleções',
        href: '/colecoes',
        tooltip: 'Organize seleções de produtos por cliente, campanha ou tema e compartilhe.',
      },
      {
        icon: Heart,
        label: 'Favoritos',
        href: '/favoritos',
        tooltip: 'Salve os produtos que você mais vende para acessar rápido nas próximas vendas.',
      },
      {
        icon: GitCompare,
        label: 'Comparar',
        href: '/comparar',
        tooltip: 'Coloque produtos lado a lado e ajude o cliente a decidir com segurança.',
      },
    ],
  },

  {
    id: 'tools',
    label: 'Ferramentas',
    icon: Wrench,
    defaultOpen: false,
    items: [
      {
        icon: ImagePlus,
        label: 'Mockup',
        href: '/mockup-generator',
        shortcut: 'Alt+M',
        tooltip: 'Crie uma prévia do produto com a logo do cliente e feche a venda no visual.',
      },
      {
        icon: Sparkles,
        label: 'Magic Up',
        href: '/magic-up',
        tooltip: 'Gere artes e anúncios prontos para enviar ao cliente em segundos.',
      },
      {
        icon: Crosshair,
        label: 'Match',
        href: '/match',
        tooltip: 'Encontre o brinde perfeito para o perfil e a ocasião do seu cliente.',
      },
      {
        icon: Boxes,
        label: 'Kit Maker',
        href: '/montar-kit',
        tooltip: 'Monte kits personalizados que aumentam o ticket médio do pedido.',
      },
      {
        icon: Zap,
        label: 'Raio X',
        href: '/raio-x',
        tooltip: 'Veja tudo sobre o produto num só lugar para responder o cliente na hora.',
      },
      {
        icon: Calculator,
        label: 'Simulador',
        href: '/simulador',
        shortcut: 'Alt+S',
        tooltip: 'Calcule o preço final com gravação e quantidade antes de enviar a proposta.',
      },
      {
        icon: BarChart3,
        label: 'Preços por Tiragem',
        href: '/simulador-precos',
        tooltip: 'Compare preços por quantidade e mostre ao cliente quanto ele ganha pedindo mais.',
      },
      {
        icon: DollarSign,
        label: 'Busca por Preço',
        href: '/busca-preco',
        tooltip: 'Tem um orçamento? Encontre rapidamente produtos que cabem no bolso do cliente.',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Insights',
    icon: Brain,
    defaultOpen: false,
    items: [
      {
        icon: Brain,
        label: 'Inteligência de Mercado',
        href: '/inteligencia-comercial',
        tooltip: 'Descubra os produtos mais procurados e venda o que está bombando agora.',
      },
      // NOTE: '/estoque' removido deste grupo -- duplicata com catalog/Estoque.
      // href único por item evita que computeOpenGroups abra dois grupos simultaneamente
      // (root cause do stack overflow em 25/05/2026).
      {
        icon: Activity,
        label: 'Tendências',
        href: '/tendencias',
        tooltip: 'Acompanhe o que está em alta e antecipe a próxima campanha do seu cliente.',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    adminOnly: true,
    defaultOpen: false,
    items: [
      {
        icon: Users,
        label: 'Usuários',
        href: '/admin/usuarios',
        adminOnly: true,
        tooltip: 'Gerencie a equipe: cadastre vendedores, defina permissões e alçadas.',
      },
      {
        icon: Settings,
        label: 'Configurações',
        href: '/configuracoes',
        adminOnly: true,
        tooltip: 'Ajuste preferências da sua conta e do funcionamento do sistema.',
      },
      {
        icon: ShieldCheck,
        label: 'Segurança',
        href: '/admin/seguranca',
        devOnly: true,
        tooltip: 'Controle acessos e proteja os dados sensíveis dos seus clientes.',
      },
      {
        icon: ShieldCheck,
        label: 'Acesso & Bots',
        href: '/admin/seguranca-acesso',
        devOnly: true,
        tooltip: 'Bloqueie acessos indevidos e proteja o catálogo contra cópias automáticas.',
      },
      {
        icon: Plug,
        label: 'Conexões',
        href: '/admin/conexoes',
        devOnly: true,
        tooltip: 'Conecte o sistema ao seu CRM e às ferramentas que a equipe já usa.',
      },
      {
        icon: FolderOpen,
        label: 'Cadastros',
        href: '/admin/cadastros',
        adminOnly: true,
        tooltip: 'Mantenha produtos, fornecedores e gravações sempre atualizados.',
        children: [
          {
            icon: Package,
            label: 'Produtos',
            href: '/admin/cadastros?tab=products',
            tooltip: 'Cadastre e edite os produtos que aparecem no catálogo de vendas.',
          },
          {
            icon: Truck,
            label: 'Fornecedores',
            href: '/admin/cadastros?tab=suppliers',
            tooltip: 'Gerencie seus parceiros e prazos para prometer entregas com confiança.',
          },
          {
            icon: Palette,
            label: 'Gravação',
            href: '/admin/cadastros?tab=personalizacao',
            tooltip: 'Configure técnicas e cores de gravação para precificar a personalização.',
          },
        ],
      },
      {
        icon: Sparkles,
        label: 'Prompts IA',
        href: '/admin/prompts-ia',
        devOnly: true,
        tooltip: 'Ajuste como a IA responde para deixar o atendimento com a sua cara.',
      },
      {
        icon: Workflow,
        label: 'Workflows IA',
        href: '/admin/workflows',
        devOnly: true,
        tooltip: 'Automatize tarefas repetitivas e libere tempo para focar em vender.',
      },
      {
        icon: Activity,
        label: 'Telemetria',
        href: '/admin/telemetria',
        devOnly: true,
        tooltip: 'Acompanhe a saúde do sistema para garantir que nada atrapalhe sua venda.',
      },
      {
        icon: Gauge,
        label: 'Performance UX',
        href: '/admin/client-performance',
        devOnly: true,
        tooltip: 'Veja se o sistema está rápido para sua equipe atender sem travamentos.',
      },
      {
        icon: DollarSign,
        label: 'Validade de Preços',
        href: '/admin/validade-precos',
        devOnly: true,
        tooltip: 'Garanta que os preços enviados ao cliente estejam sempre atualizados.',
      },
      {
        icon: ShieldCheck,
        label: 'Auditoria RBAC',
        href: '/admin/rbac-rotas',
        devOnly: true,
        tooltip: 'Confira quem pode acessar o quê e mantenha a operação organizada.',
      },
      {
        icon: Activity,
        label: 'Status do Sistema',
        href: '/admin/status',
        devOnly: true,
        tooltip: 'Veja em tempo real se está tudo funcionando para vender sem surpresas.',
      },
      {
        icon: SlidersHorizontal,
        label: 'Observabilidade',
        href: '/admin/observabilidade',
        devOnly: true,
        tooltip: 'Acompanhe métricas de uso e identifique oportunidades de melhoria.',
      },
      {
        icon: Cloud,
        label: 'Cloudflare Images',
        href: '/admin/cloudflare-images',
        devOnly: true,
        tooltip: 'Gerencie as imagens do catálogo para uma vitrine sempre rápida e bonita.',
      },
    ],
  },
];


/**
 * Pure module-level function — called once on mount and on route change.
 * Returns a new object only when values differ, so React bails out via
 * functional-update reference equality check.
 */
function computeOpenGroups(pathname: string): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  navGroups.forEach((group) => {
    const hasActive = group.items.some((item) => isNavItemActive(pathname, item.href, item.exact));
    next[group.id] = hasActive || (group.defaultOpen ?? false);
  });
  return next;
}

export const SidebarReorganized = React.memo(
  React.forwardRef<HTMLElement, SidebarProps>(function SidebarReorganized(
    { isOpen, onToggle },
    ref,
  ) {
    const location = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
      document.documentElement.style.setProperty('--sidebar-w', isCollapsed ? '4rem' : '16rem');
    }, [isCollapsed]);

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
      computeOpenGroups(location.pathname),
    );

    const prevPathRef = React.useRef(location.pathname);
    useEffect(() => {
      if (prevPathRef.current === location.pathname) return;
      prevPathRef.current = location.pathname;
      const next = computeOpenGroups(location.pathname);
      setOpenGroups((prev) => {
        const changed = Object.keys(next).some((k) => prev[k] !== next[k]);
        return changed ? next : prev;
      });
    }, [location.pathname]);

    const { isAdmin, isDev, rolesLoaded } = useAuth();
    const isMobile = useMediaQuery('(max-width: 1023px)');

    const { data: pendingApprovalCount } = useQuery({
      queryKey: ['pending-discount-approvals-count'],
      queryFn: async () => {
        const { count } = await supabase
          // rls-allow: admin-only badge query, guarded by `enabled: isAdmin`
          .from('discount_approval_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        return count || 0;
      },
      enabled: rolesLoaded && Boolean(isAdmin), // rolesLoaded garante JWT pronto — FIX 2026-06-18 BUG-DAR-401
      refetchInterval: 30_000,
      staleTime: 15_000,
      retry: 0,
      retryOnMount: false,
    });

    const enrichedNavGroups = useMemo(() => {
      if (!isAdmin || !pendingApprovalCount) return navGroups;
      return navGroups.map((group) => {
        if (group.id !== 'admin') return group;
        return {
          ...group,
          items: group.items.map((item) =>
            item.href === '/admin/usuarios?tab=discounts'
              ? { ...item, badge: pendingApprovalCount }
              : item,
          ),
        };
      });
    }, [isAdmin, pendingApprovalCount]);

    const toggleCollapse = () => setIsCollapsed((c) => !c);

    const collapseAllGroups = () => {
      setOpenGroups((prev) => {
        const collapsed: Record<string, boolean> = {};
        Object.keys(prev).forEach((key) => {
          collapsed[key] = false;
        });
        return collapsed;
      });
    };

    useEffect(() => {
      const shortcutMap: Record<string, string> = {};
      navGroups.forEach((g) =>
        g.items.forEach((item) => {
          if (item.shortcut) {
            shortcutMap[item.shortcut.replace('Alt+', '').toLowerCase()] = item.href;
          }
        }),
      );
      const handler = (e: KeyboardEvent) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
          const target = e.target as HTMLElement;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          )
            return;
          const href = shortcutMap[e.key.toLowerCase()];
          if (href) {
            e.preventDefault();
            navigate(href);
          }
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [navigate]);

    const hasAnyGroupOpen = Object.values(openGroups).some(Boolean);

    const toggleGroup = useCallback((groupId: string, next: boolean) => {
      setOpenGroups((prev) => (prev[groupId] === next ? prev : { ...prev, [groupId]: next }));
    }, []);

    const isItemVisible = useCallback(
      (item: { href?: string; adminOnly?: boolean; devOnly?: boolean }): boolean => {
        const href = item.href ?? '';
        if (item.devOnly && !isDev) return false;
        if (item.adminOnly && !isAdmin) return false;
        if (href && isDevOnlyPath(href) && !isDev) return false;
        if (href && isAdminOnlyPath(href) && !isAdmin) return false;
        return true;
      },
      [isDev, isAdmin],
    );

    const filteredGroups = useMemo(
      () =>
        enrichedNavGroups
          .filter((g) => {
            // Se o grupo for de Insights, ele é visível para todos os usuários autenticados
            if (g.id === 'intelligence') return true;
            return (!g.adminOnly || isAdmin) && (!g.devOnly || isDev);
          })
          .map((g) => ({
            ...g,
            items: g.items.filter(isItemVisible).map((i) => ({
              ...i,
              children: i.children?.filter(isItemVisible),
            })),
          }))
          .filter((g) => g.items.length > 0),
      [isAdmin, isDev, enrichedNavGroups, isItemVisible],
    );

    return (
      <>
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
        <aside
          ref={ref}
          data-tour="sidebar"
          role="navigation"
          aria-label="Menu principal"
          style={{
            ['--sidebar-w' as string]: isCollapsed ? '4rem' : '16rem',
            transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)',
          }}
          className={cn(
            'theme-transitioning fixed left-0 top-0 z-50 h-full border-r border-sidebar-border/20 bg-sidebar/80 backdrop-blur-3xl transition-all duration-500',
            isCollapsed ? 'overflow-visible' : 'overflow-hidden',
            'lg:sticky lg:top-0 lg:z-40 lg:h-screen',
            isOpen
              ? 'translate-x-0 shadow-[40px_0_100px_rgba(0,0,0,0.4)]'
              : '-translate-x-full lg:translate-x-0',
            isCollapsed
              ? 'w-16 lg:shadow-[20px_0_50px_rgba(0,0,0,0.15)]'
              : 'w-64 lg:shadow-[30px_0_80px_rgba(0,0,0,0.2)]',
          )}
        >
          <FocusTrap active={isOpen && isMobile} className="h-full" autoFocus={false}>
            <div
              className={cn(
                'flex h-full min-h-0 flex-col pt-16 lg:pt-0',
                isCollapsed && 'overflow-visible',
              )}
            >
              <div className="group/brand relative border-b border-white/[0.05] bg-gradient-to-b from-white/[0.02] to-transparent">
                <SidebarBrandHeader isCollapsed={isCollapsed} />
                <div className="pointer-events-none absolute inset-0 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover/brand:opacity-100" />
              </div>
              <div className="mb-3 mt-4 hidden items-center justify-between gap-2 px-3 lg:flex">
                {!isCollapsed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 flex-1 gap-2 text-[10px] font-bold uppercase tracking-wider',
                      'text-sidebar-foreground/40 hover:bg-primary/10 hover:text-primary',
                      'rounded-xl opacity-60 transition-all duration-300 hover:opacity-100',
                      !hasAnyGroupOpen && 'invisible',
                    )}
                    onClick={collapseAllGroups}
                    aria-label="Recolher todos os grupos de navegação"
                  >
                    <ChevronsDownUp className="h-3 w-3" />
                    Recolher
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 shrink-0 text-sidebar-foreground/30 hover:bg-sidebar-accent/50 hover:text-primary',
                    'rounded-xl transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary',
                    isCollapsed && 'mx-auto',
                  )}
                  onClick={toggleCollapse}
                  aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                  title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <RestrictedRouteNotice isCollapsed={isCollapsed} />
              <nav
                className={cn(
                  'scrollbar-thin min-h-0 flex-1 px-2',
                  isCollapsed ? 'overflow-visible' : 'overflow-y-auto',
                  isCollapsed ? 'space-y-0' : 'space-y-0.5',
                )}
              >
                {filteredGroups.map((group, index) => (
                  <div key={group.id}>
                    {index > 0 && !isCollapsed && (
                      <div className="mx-2 my-2.5 h-px bg-sidebar-border/40" />
                    )}
                    {index > 0 && isCollapsed && (
                      <div className="mx-auto my-1.5 h-px w-4 bg-sidebar-border/30" />
                    )}
                    <SidebarNavGroup
                      group={group}
                      isOpen={openGroups[group.id] ?? false}
                      isCollapsed={isCollapsed}
                      onToggle={(next) => toggleGroup(group.id, next)}
                      onMobileClose={onToggle}
                      isMobileSidebarOpen={isOpen}
                    />
                  </div>
                ))}
              </nav>
            </div>
          </FocusTrap>
        </aside>
      </>
    );
  }),
);
SidebarReorganized.displayName = 'SidebarReorganized';
