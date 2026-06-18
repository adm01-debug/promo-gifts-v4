import React, { forwardRef, useState, useCallback } from 'react';
import { TruncatedTooltip } from '@/components/ui/truncated-tooltip';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/auth';
import { getPrefetchHandlers } from '@/lib/routePrefetch';
import { isDevOnlyPath, isAdminOnlyPath } from '@/lib/navigation/restricted-routes';
import { isNavItemActive } from '@/lib/navigation/active-match';

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  tourId?: string;
  adminOnly?: boolean;
  devOnly?: boolean;
  requiredPermission?: { action: string; resource: string };
  badge?: string | number;
  exact?: boolean;
  children?: NavItem[];
  shortcut?: string;
  /** Texto curto e comercial exibido em tooltip ao passar o mouse. */
  tooltip?: string;
}


export interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
  adminOnly?: boolean;
  devOnly?: boolean;
}

interface SidebarNavGroupProps {
  group: NavGroup;
  isOpen: boolean;
  isCollapsed: boolean;
  onToggle: (next: boolean) => void;
  onMobileClose: () => void;
  isMobileSidebarOpen: boolean;
}

export const SidebarNavGroup = forwardRef<HTMLDivElement, SidebarNavGroupProps>(
  function SidebarNavGroup(
    { group, isOpen, isCollapsed, onToggle, onMobileClose, isMobileSidebarOpen },
    _ref,
  ) {
    const location = useLocation();
    const { isAdmin, isDev } = useAuth();
    const { hasPermission } = useRBAC();

    // Stable active-item checker — only recreated when location changes
    const isItemActive = useCallback(
      (href: string, exact?: boolean) => {
        if (href.includes('?')) {
          const [path, search] = href.split('?');
          return location.pathname === path && location.search === `?${search}`;
        }
        return isNavItemActive(location.pathname, href, exact);
      },
      [location.pathname, location.search],
    );

    const hasActiveItem = group.items.some((item) => isItemActive(item.href, item.exact));
    const GroupIcon = group.icon;
    const groupToggleLabel = `${isOpen ? 'Recolher' : 'Expandir'} grupo ${group.label}`;

    // Sub-menu state computed on mount — no useEffect to avoid render-loop
    const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      group.items.forEach((item) => {
        if (
          item.children?.some((child) => {
            if (child.href.includes('?')) {
              const [p, s] = child.href.split('?');
              return location.pathname === p && location.search === `?${s}`;
            }
            return isNavItemActive(location.pathname, child.href, child.exact);
          })
        ) {
          initial[item.label] = true;
        }
      });
      return initial;
    });

    const toggleSubMenu = useCallback((label: string) => {
      setOpenSubMenus((prev) => ({ ...prev, [label]: !prev[label] }));
    }, []);

    const renderNavLink = (item: NavItem, depth = 0): React.ReactNode => {
      if (item.devOnly && !isDev) return null;
      if (item.adminOnly && !isAdmin) return null;
      if (item.href && isDevOnlyPath(item.href) && !isDev) return null;
      if (item.href && isAdminOnlyPath(item.href) && !isAdmin) return null;
      if (
        item.requiredPermission &&
        !hasPermission(item.requiredPermission.action, item.requiredPermission.resource)
      )
        return null;

      if (item.children && item.children.length > 0) {
        const hasActiveChild = item.children.some((child) => isItemActive(child.href, child.exact));
        const isSubOpen = openSubMenus[item.label] ?? hasActiveChild;
        const Icon = item.icon;
        return (
          <div key={item.label}>
            <button
              aria-expanded={isSubOpen}
              aria-controls={`submenu-${item.label}`}
              aria-label={`Expandir ${item.label}`}
              onClick={() => toggleSubMenu(item.label)}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150',
                'hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 active:scale-[0.995]',
                hasActiveChild
                  ? 'bg-primary/[0.03] font-semibold text-primary before:absolute before:bottom-[20%] before:left-0 before:top-[20%] before:w-[1.5px] before:rounded-r-full before:bg-primary'
                  : 'text-sidebar-foreground/75 hover:text-sidebar-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  hasActiveChild ? 'text-primary' : 'group-hover:text-primary/70',
                )}
              />
              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate text-left text-sm">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200',
                      isSubOpen && 'rotate-180',
                    )}
                  />
                </>
              )}
            </button>
            {isSubOpen && !isCollapsed && (
              <div className="mt-0.5 space-y-0.5 pl-4" id={`submenu-${item.label}`} role="group">
                {item.children.map((child) => renderNavLink(child, depth + 1))}
              </div>
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
            'group relative flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 active:scale-[0.98]',
            'hover:translate-x-1 hover:bg-white/[0.04]',
            isActive
              ? 'bg-primary/10 font-bold text-white shadow-[0_0_15px_rgba(255,165,0,0.1)] before:absolute before:bottom-[15%] before:left-0 before:top-[15%] before:w-[3px] before:rounded-r-full before:bg-primary'
              : 'text-sidebar-foreground/60 before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[2px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary/50 before:transition-all before:duration-500 hover:text-sidebar-foreground hover:before:h-5',
          )}
          onClick={() => isMobileSidebarOpen && onMobileClose()}
          onMouseEnter={prefetch.onMouseEnter}
          onTouchStart={prefetch.onTouchStart}
        >
          <Icon
            className={cn(
              'h-[18px] w-[18px] shrink-0 transition-all duration-500',
              isActive
                ? 'scale-110 text-primary'
                : 'group-hover:scale-110 group-hover:text-primary',
            )}
          />
          {!isCollapsed && (
            <TruncatedTooltip className="flex-1 text-sm">{item.label}</TruncatedTooltip>
          )}
          {!isCollapsed && item.shortcut && (
            <kbd className="ml-auto hidden rounded bg-muted/30 px-1 py-0.5 font-mono text-[9px] text-muted-foreground/40 lg:inline-block">
              {item.shortcut}
            </kbd>
          )}
          {!isCollapsed && item.badge !== null && (
            <span className="ml-auto min-w-[20px] rounded-full bg-primary/20 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
              {item.badge}
            </span>
          )}
        </NavLink>
      );

      if (isCollapsed) {
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <div>{linkContent}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="z-[100] max-w-[240px]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="text-tooltip rounded bg-muted/50 px-1 py-0.5 font-mono text-muted-foreground/60">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
                {item.tooltip && (
                  <p className="text-tooltip text-muted-foreground">{item.tooltip}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      }

      if (item.tooltip) {
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <div>{linkContent}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="z-[100] max-w-[240px]">
              <p className="text-tooltip">{item.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        );
      }

      return <div key={item.href}>{linkContent}</div>;
    };


    if (isCollapsed) {
      return <div className="space-y-0.5 py-1">{group.items.map(renderNavLink)}</div>;
    }

    return (
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button
            aria-expanded={isOpen}
            aria-label={groupToggleLabel}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 active:scale-[0.99]',
              'text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground',
              hasActiveItem && 'bg-primary/[0.03] text-primary/90',
            )}
          >
            <GroupIcon
              className={cn(
                'h-4.5 w-4.5 shrink-0 transition-all duration-300',
                hasActiveItem
                  ? 'text-primary'
                  : 'text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60',
              )}
            />
            <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wider">
              {group.label}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-sidebar-foreground/30 transition-transform duration-300',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        {/* CollapsibleContent sem forceMount nem framer-motion — elimina render loops */}
        <CollapsibleContent>
          <div className="mt-1 space-y-0.5 pb-1 pl-3">{group.items.map(renderNavLink)}</div>
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

SidebarNavGroup.displayName = 'SidebarNavGroup';
