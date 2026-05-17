import { forwardRef } from "react";
import { AppLogo } from "../AppLogo";

interface SidebarBrandHeaderProps {
  isCollapsed: boolean;
}

export const SidebarBrandHeader = forwardRef<HTMLDivElement, SidebarBrandHeaderProps>(
  ({ isCollapsed }, ref) => {
    if (isCollapsed) {
      return (
        <div ref={ref} className="flex flex-col items-center justify-center py-6 mb-2">
          <AppLogo showText={false} variant="sidebar" />
        </div>
      );
    }

    return (
      <div ref={ref} className="px-4 py-5 mb-2 border-b border-sidebar-border/10 bg-gradient-to-b from-sidebar-accent/5 to-transparent">
        <AppLogo variant="sidebar" textClassName="text-sm" />
      </div>
    );
  }
);

SidebarBrandHeader.displayName = "SidebarBrandHeader";

SidebarBrandHeader.displayName = "SidebarBrandHeader";
