import { forwardRef } from 'react';
import { AppLogo } from '../AppLogo';
import { useNavigate } from 'react-router-dom';

interface SidebarBrandHeaderProps {
  isCollapsed: boolean;
}

export const SidebarBrandHeader = forwardRef<HTMLDivElement, SidebarBrandHeaderProps>(
  ({ isCollapsed }, ref) => {
    const navigate = useNavigate();

    const handleLogoClick = () => {
      navigate('/');
    };

    if (isCollapsed) {
      return (
        <div
          ref={ref}
          data-testid="sidebar-brand-header"
          className="ultra-wide:py-6 flex flex-col items-center justify-center py-4 transition-all duration-300 2xl:py-5"
        >
          <AppLogo showText={false} variant="sidebar" onClick={handleLogoClick} iconClassName="" />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-testid="sidebar-brand-header"
        className="ultra-wide:px-6 ultra-wide:py-6 px-3 py-4 transition-all duration-300 sm:px-4 2xl:px-5 2xl:py-5"
      >
        <AppLogo variant="sidebar" textClassName="" onClick={handleLogoClick} iconClassName="" />
      </div>
    );
  },
);

SidebarBrandHeader.displayName = 'SidebarBrandHeader';
