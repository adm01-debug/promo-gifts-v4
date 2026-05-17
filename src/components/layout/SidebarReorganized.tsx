import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Package,
  Users,
  Filter,
  Heart,
  GitCompare,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calculator,
  Wand2,
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
  ChevronsDownUp,
  Settings,
  Percent,
  Plug,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarBrandHeader } from "./sidebar/SidebarBrandHeader";

import { SidebarNavGroup, type NavGroup } from "./sidebar/SidebarNavGroup";
import { RestrictedRouteNotice } from "./sidebar/RestrictedRouteNotice";
import { isDevOnlyPath, isAdminOnlyPath } from "@/lib/navigation/restricted-routes";
import { isNavItemActive } from "@/lib/navigation/active-match";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navGroups: NavGroup[] = [
  {
    id: "quotes",
    label: "Orçamentos",
    icon: FileText,
    defaultOpen: true,
    items: [
      { icon: Plus, label: "Novo Orçamento", href: "/orcamentos/novo", shortcut: "Alt+N" },
      { icon: FileText, label: "Orçamentos", href: "/orcamentos", tourId: "quotes", exact: true, shortcut: "Alt+O" },
      { icon: ShoppingCart, label: "Carrinhos", href: "/carrinhos", shortcut: "Alt+R" },
    ],
  },
  {
    id: "catalog",
    label: "Catálogo",
    icon: Package,
    defaultOpen: true,
    items: [
      { icon: Package, label: "Produtos", href: "/", tourId: "products", shortcut: "Alt+P" },
      { icon: SlidersHorizontal, label: "Super Filtro", href: "/filtros", shortcut: "Alt+F" },
      { icon: Zap, label: "Novidades", href: "/novidades" },
      { icon: RefreshCw, label: "Reposição", href: "/reposicao" },
      { icon: FolderOpen, label: "Coleções", href: "/colecoes" },
      { icon: Layers, label: "Estoque", href: "/estoque" },
      { icon: Heart, label: "Favoritos", href: "/favoritos" },
      { icon: GitCompare, label: "Comparar", href: "/comparar" },
    ],
  },
  {
    id: "tools",
    label: "Ferramentas",
    icon: Wrench,
    defaultOpen: false,
    items: [
      { icon: ImagePlus, label: "Mockup", href: "/mockup-generator", shortcut: "Alt+M" },
      { icon: Sparkles, label: "Magic Up", href: "/magic-up" },
      { icon: Crosshair, label: "Match", href: "/match" },
      { icon: Boxes, label: "Kit Maker", href: "/montar-kit" },
      { icon: Calculator, label: "Simulador", href: "/simulador", shortcut: "Alt+S" },
      { icon: BarChart3, label: "Preços por Tiragem", href: "/simulador-precos" },
      { icon: DollarSign, label: "Busca por Preço", href: "/busca-preco" },
    ],
  },
  {
    id: "intelligence",
    label: "Insights",
    icon: Brain,
    defaultOpen: false,
    items: [
      { icon: Brain, label: "Inteligência de Mercado", href: "/inteligencia-comercial" },
      { icon: Sparkles, label: "Estoque", href: "/estoque" },
      { icon: Activity, label: "Tendências", href: "/tendencias" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
    defaultOpen: false,
    items: [
      { icon: Users, label: "Usuários", href: "/admin/usuarios", adminOnly: true },
      { icon: Settings, label: "Configurações", href: "/configuracoes", adminOnly: true },
      { icon: ShieldCheck, label: "Segurança", href: "/admin/seguranca", devOnly: true },
      { icon: ShieldCheck, label: "Acesso & Bots", href: "/admin/seguranca-acesso", devOnly: true },
      { icon: Plug, label: "Conexões", href: "/admin/conexoes", devOnly: true },
      { icon: FolderOpen, label: "Cadastros", href: "/admin/cadastros", adminOnly: true, children: [
        { icon: Package, label: "Produtos", href: "/admin/cadastros?tab=products" },
        { icon: Truck, label: "Fornecedores", href: "/admin/cadastros?tab=suppliers" },
        { icon: Palette, label: "Gravação", href: "/admin/cadastros?tab=personalizacao" },
      ]},
      { icon: Sparkles, label: "Prompts IA", href: "/admin/prompts-ia", devOnly: true },
      { icon: Workflow, label: "Workflows IA", href: "/admin/workflows", devOnly: true },
      { icon: Activity, label: "Telemetria", href: "/admin/telemetria", devOnly: true },
      { icon: DollarSign, label: "Validade de Preços", href: "/admin/validade-precos", devOnly: true },
      { icon: ShieldCheck, label: "Auditoria RBAC", href: "/admin/rbac-rotas", devOnly: true },
    ],
  },
];

export const SidebarReorganized = React.memo(
  React.forwardRef<HTMLElement, SidebarProps>(
    function SidebarReorganized({ isOpen, onToggle }, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Propaga --sidebar-w no :root para que o Header fixo possa offset
  // corretamente da largura da sidebar em desktop (lg+).
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      isCollapsed ? "4rem" : "16rem",
    );
  }, [isCollapsed]);
  const isItemActive = (href: string, exact?: boolean) =>
    isNavItemActive(location.pathname, href, exact);

  // Compute which groups should be auto-opened for the current route.
  // Derived synchronously from `location` so back/forward navigation never
  // flickers (no post-commit useEffect lag).
  const computeAutoOpen = useCallback(() => {
    const next: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const hasActive = group.items.some((item) =>
        isNavItemActive(location.pathname, item.href, item.exact),
      );
      next[group.id] = hasActive || (group.defaultOpen ?? false);
    });
    return next;
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(computeAutoOpen);

  // Track the last pathname we synced so we only override user-toggled state
  // when the route actually changes (incl. via popstate / back-forward).
  const lastSyncedPathRef = React.useRef(location.pathname);
  if (lastSyncedPathRef.current !== location.pathname) {
    lastSyncedPathRef.current = location.pathname;
    // setState during render is safe here: React bails out on equal state and
    // schedules the update before paint, eliminating the 1-frame flicker.
    setOpenGroups(computeAutoOpen());
  }

  const { isAdmin, isDev } = useAuth();

  // Pending discount approval count for admin badge
  const { data: pendingApprovalCount } = useQuery({
    queryKey: ["pending-discount-approvals-count"],
    queryFn: async () => {
      const { count } = await supabase
        // rls-allow: admin-only badge; RLS filtra
        .from("discount_approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Inject badge into navGroups dynamically
  const enrichedNavGroups = useMemo(() => {
    if (!isAdmin || !pendingApprovalCount) return navGroups;
    return navGroups.map(group => {
      if (group.id !== "admin") return group;
      return {
        ...group,
        items: group.items.map(item =>
          item.href === "/admin/usuarios?tab=discounts"
            ? { ...item, badge: pendingApprovalCount }
            : item
        ),
      };
    });
  }, [isAdmin, pendingApprovalCount]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const collapseAllGroups = () => {
    setOpenGroups((prev) => {
      const collapsed: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => { collapsed[key] = false; });
      return collapsed;
    });
  };

  // Global keyboard shortcuts for navigation
  useEffect(() => {
    const shortcutMap: Record<string, string> = {};
    navGroups.forEach(g => g.items.forEach(item => {
      if (item.shortcut) {
        const key = item.shortcut.replace("Alt+", "").toLowerCase();
        shortcutMap[key] = item.href;
      }
    }));

    const handler = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        const href = shortcutMap[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          navigate(href);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const hasAnyGroupOpen = Object.values(openGroups).some(Boolean);


  // Receives the next open value from Radix Collapsible. Trusting Radix's
  // value (instead of inverting our own) keeps state consistent if the
  // Collapsible re-emits the same state due to focus/escape interactions.
  const toggleGroup = (groupId: string, next: boolean) => {
    setOpenGroups((prev) => (prev[groupId] === next ? prev : { ...prev, [groupId]: next }));
  };

  // Defense-in-depth: além das flags declarativas (`devOnly`/`adminOnly`),
  // o SSOT `restricted-routes.ts` é consultado por `href`. Assim:
  //  - rota dev-only ⇒ visível só p/ isDev (mesmo se faltou marcar a flag)
  //  - rota admin-only ⇒ visível só p/ isAdmin (= supervisor OU dev)
  //  - supervisor SEM dev nunca enxerga itens técnicos, mesmo que outro
  //    desenvolvedor os marque erroneamente como `adminOnly`.
  const isItemVisible = useCallback(
    (
      item: { href?: string; adminOnly?: boolean; devOnly?: boolean },
    ): boolean => {
      const href = item.href ?? "";
      // 1) Flags declarativas
      if (item.devOnly && !isDev) return false;
      if (item.adminOnly && !isAdmin) return false;
      // 2) SSOT por path (defesa contra flags faltantes/erradas)
      if (href && isDevOnlyPath(href) && !isDev) return false;
      if (href && isAdminOnlyPath(href) && !isAdmin) return false;
      return true;
    },
    [isDev, isAdmin],
  );

  const filteredGroups = useMemo(
    () =>
      enrichedNavGroups
        .filter((g) => (!g.adminOnly || isAdmin) && (!g.devOnly || isDev))
        .map((g) => ({
          ...g,
          items: g.items.filter(isItemVisible).map((i) => ({
            ...i,
            // Filtra também os filhos (ex.: subitens de Cadastros)
            children: i.children?.filter(isItemVisible),
          })),
        }))
        .filter((g) => g.items.length > 0),
    [isAdmin, isDev, enrichedNavGroups, isItemVisible]
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={ref}
        data-tour="sidebar"
        role="navigation"
        aria-label="Menu principal"
        style={{ ['--sidebar-w' as string]: isCollapsed ? '4rem' : '16rem' }}
        className={cn(
          "fixed left-0 top-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out",
          isCollapsed ? "overflow-visible" : "overflow-hidden",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("flex flex-col h-full pt-16 lg:pt-0 min-h-0", isCollapsed && "overflow-visible")}>
          {/* Brand Header */}
          <SidebarBrandHeader isCollapsed={isCollapsed} />


          {/* Collapse controls (desktop) */}
          <div className="hidden lg:flex items-center justify-between px-2 mb-1">
            {!isCollapsed && hasAnyGroupOpen && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[10px] border-sidebar-border/50 hover:bg-orange/10 hover:text-orange text-sidebar-foreground/40"
                onClick={collapseAllGroups}
              >
                <X className="h-3 w-3" />
                Fechar
              </Button>
            )}
            {!isCollapsed && !hasAnyGroupOpen && <div />}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-sidebar-accent/50 hover:text-orange ml-auto text-sidebar-foreground/30"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
              title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Aviso quando vendedor/admin tenta abrir rota técnica via URL/histórico */}
          <RestrictedRouteNotice isCollapsed={isCollapsed} />

          {/* Navigation Groups */}
          <nav
            className={cn(
              "flex-1 min-h-0 px-2 scrollbar-thin",
              isCollapsed ? "overflow-visible" : "overflow-y-auto",
              isCollapsed ? "space-y-0" : "space-y-0.5"
            )}
          >
            {filteredGroups.map((group, index) => (
              <div key={group.id}>
                {/* Separator between groups */}
                {index > 0 && !isCollapsed && (
                  <div className="my-2.5 mx-2 h-px bg-sidebar-border/40" />
                )}
                {index > 0 && isCollapsed && (
                  <div className="my-1.5 mx-auto w-4 h-px bg-sidebar-border/30" />
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
      </aside>
    </>
  );
}
  )
);
