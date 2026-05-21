import React, { forwardRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useRBAC } from "@/hooks/auth";
import { getPrefetchHandlers } from "@/lib/routePrefetch";
import { isDevOnlyPath, isAdminOnlyPath } from "@/lib/navigation/restricted-routes";
import { isNavItemActive } from "@/lib/navigation/active-match";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  tourId?: string;
  adminOnly?: boolean;
  /** Restrito ao papel `dev` — rotas técnicas/infra. */
  devOnly?: boolean;
  requiredPermission?: { action: string; resource: string };
  badge?: string | number;
  
  exact?: boolean;
  children?: NavItem[];
  /** Keyboard shortcut hint (e.g. "Alt+P") */
  shortcut?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
  adminOnly?: boolean;
  /** Grupo inteiro restrito a `dev`. */
  devOnly?: boolean;
}

interface SidebarNavGroupProps {
  group: NavGroup;
  isOpen: boolean;
  isCollapsed: boolean;
  /** Receives the next open state from Radix Collapsible. */
  onToggle: (next: boolean) => void;
  onMobileClose: () => void;
  isMobileSidebarOpen: boolean;
}

export const SidebarNavGroup = forwardRef<HTMLDivElement, SidebarNavGroupProps>(function SidebarNavGroup({
  group,
  isOpen,
  isCollapsed,
  onToggle,
  onMobileClose,
  isMobileSidebarOpen,
}, _ref) {
  const location = useLocation();
  const { isAdmin, isDev } = useAuth();
  const { hasPermission } = useRBAC();

  const isItemActive = (href: string, exact?: boolean) => {
    // Hrefs with query params (e.g. /admin/cadastros?tab=products): match
    // both pathname and search exactly — query items are leaf navigation.
    if (href.includes('?')) {
      const [path, search] = href.split('?');
      return location.pathname === path && location.search === `?${search}`;
    }
    // Delegate to SSOT: prefix-aware matching that avoids false positives
    // like "/orcamentos" matching "/orcamentos-publicos".
    return isNavItemActive(location.pathname, href, exact);
  };

  const hasActiveItem = group.items.some((item) => isItemActive(item.href, item.exact));
  const GroupIcon = group.icon;
  const groupToggleLabel = `${isOpen ? 'Recolher' : 'Expandir'} grupo ${group.label}`;

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

  const toggleSubMenu = useCallback((label: string) => {
    setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));
  }, []);

  // Auto-open sub-menus that contain active items
  React.useEffect(() => {
    group.items.forEach(item => {
      if (item.children?.some(child => isItemActive(child.href, child.exact))) {
        setOpenSubMenus(prev => ({ ...prev, [item.label]: true }));
      }
    });
  }, [location.pathname]);

  const renderNavLink = (item: NavItem, depth = 0): React.ReactNode => {
    // 1) Flags declarativas
    if (item.devOnly && !isDev) return null;
    if (item.adminOnly && !isAdmin) return null;
    // 2) Defense-in-depth: SSOT por path. Garante que mesmo um item sem flag
    //    devOnly/adminOnly seja escondido se sua rota for técnica/admin e o
    //    usuário não tiver o papel — supervisor sem dev nunca enxerga rotas dev.
    if (item.href && isDevOnlyPath(item.href) && !isDev) return null;
    if (item.href && isAdminOnlyPath(item.href) && !isAdmin) return null;
    if (item.requiredPermission && !hasPermission(item.requiredPermission.action, item.requiredPermission.resource)) return null;

    // If item has children, render as expandable sub-menu
    if (item.children && item.children.length > 0) {
      const hasActiveChild = item.children.some(child => isItemActive(child.href, child.exact));
      const isSubOpen = openSubMenus[item.label] ?? hasActiveChild;
      const Icon = item.icon;

      return (
        <div key={item.label}>
          <button
            aria-expanded={isSubOpen}
            aria-controls={`submenu-${item.label}`}
            aria-label={`Expandir ${item.label}`}
            onClick={() => toggleSubMenu(item.label)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleSubMenu(item.label);
              }
            }}

            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-150 group relative",
              "hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange/20 active:scale-[0.995]",
              hasActiveChild
                ? "text-primary font-semibold bg-primary/[0.03] before:absolute before:left-0 before:top-[20%] before:bottom-[20%] before:w-[1.5px] before:rounded-r-full before:bg-primary"
                : "text-sidebar-foreground/75 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                hasActiveChild ? "text-primary" : "group-hover:text-primary/70"
              )}
            />
            {!isCollapsed && (
              <>
                <span className="truncate text-sm flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200 text-sidebar-foreground/30",
                    isSubOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>
          {isSubOpen && !isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pl-4 mt-0.5 space-y-0.5" id={`submenu-${item.label}`} role="group">
                {item.children.map(child => renderNavLink(child, depth + 1))}
              </div>
            </motion.div>
          )}
        </div>
      );
    }

    const isActive = isItemActive(item.href, item.exact);
    const Icon = item.icon;

    const prefetch = getPrefetchHandlers(item.href);

    const linkContent = (
      <NavLink
        to={item.href}
        data-tour={item.tourId}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 active:scale-[0.98]",

          "hover:bg-white/[0.04] hover:translate-x-1.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
          isActive
            ? "bg-primary/10 text-white font-bold shadow-[0_4px_20px_rgba(var(--primary),0.1)] before:absolute before:left-0 before:top-[12%] before:bottom-[12%] before:w-[4px] before:rounded-r-full before:bg-primary"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-0 before:w-[2px] before:rounded-r-full before:bg-primary/50 before:transition-all before:duration-500 hover:before:h-5"
        )}

        onClick={() => isMobileSidebarOpen && onMobileClose()}
        onMouseEnter={prefetch.onMouseEnter}
        onTouchStart={prefetch.onTouchStart}
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-all duration-500",
            isActive ? "text-primary scale-110 drop-shadow-[0_0_12px_rgba(var(--primary),0.9)]" : "group-hover:text-primary group-hover:scale-110"
          )}
        />
        {!isCollapsed && (
          <span className="truncate text-sm flex-1">
            {item.label}
          </span>
        )}
        {!isCollapsed && item.shortcut && (
          <kbd className="ml-auto text-[9px] text-muted-foreground/40 font-mono bg-muted/30 px-1 py-0.5 rounded hidden lg:inline-block">
            {item.shortcut}
          </kbd>
        )}
        {!isCollapsed && item.badge !== null && (
          <span className="ml-auto bg-primary/20 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-[0_0_10px_rgba(var(--primary),0.2)] border border-primary/30">
            {item.badge}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>
            <div>{linkContent}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-card border-border z-[100]">
            <div className="flex items-center gap-2">
              <span>{item.label}</span>
              {item.shortcut && (
                <kbd className="text-[9px] text-muted-foreground/60 font-mono bg-muted/50 px-1 py-0.5 rounded">
                  {item.shortcut}
                </kbd>
              )}
              {item.badge !== null && (
                <span className="bg-primary/20 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/30">
                  {item.badge}
                </span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  // Collapsed mode: flat list with tooltips
  if (isCollapsed) {
    return (
      <div className="space-y-0.5 py-1">
        {group.items.map(renderNavLink)}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          aria-expanded={isOpen}
          aria-label={groupToggleLabel}
          className={cn(
          "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 active:scale-[0.99]",
          "hover:bg-sidebar-accent/30 text-sidebar-foreground/50 hover:text-sidebar-foreground",
          hasActiveItem && "text-primary/90 bg-primary/[0.03] shadow-[inset_0_0_20px_rgba(var(--primary),0.02)]"
          )}
        >
          <GroupIcon
            className={cn(
              "h-4.5 w-4.5 shrink-0 transition-all duration-300",
              hasActiveItem ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60"
            )}
          />
          <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wider">
            {group.label}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-300 text-sidebar-foreground/30",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>

      {isOpen && (
        <CollapsibleContent forceMount>
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pl-3 mt-1 space-y-0.5 pb-1">
              {group.items.map(renderNavLink)}
            </div>
          </motion.div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
});

SidebarNavGroup.displayName = "SidebarNavGroup";
