import { forwardRef } from 'react';
import { AppLogo } from '../AppLogo';
import { useOptionalOnboardingContext } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';

interface SidebarBrandHeaderProps {
  isCollapsed: boolean;
}

export const SidebarBrandHeader = forwardRef<HTMLDivElement, SidebarBrandHeaderProps>(
  ({ isCollapsed }, ref) => {
    const navigate = useNavigate();
    const onboarding = useOptionalOnboardingContext();

    const handleLogoClick = () => {
      navigate('/');
      if (onboarding && !isCollapsed) {
        onboarding.restartTour();
      }
    };

    if (isCollapsed) {
      return (
        <div ref={ref} className="flex flex-col items-center justify-center py-5 transition-all duration-300">
          <AppLogo showText={false} variant="sidebar" onClick={handleLogoClick} iconClassName="shadow-none border-none bg-transparent" />
        </div>
      );
    }

    return (
      <div ref={ref} className="px-5 py-5 transition-all duration-300">
        <AppLogo variant="sidebar" textClassName="text-base" onClick={handleLogoClick} iconClassName="shadow-none border-none bg-transparent" />
      </div>
    );
  },
);

SidebarBrandHeader.displayName = 'SidebarBrandHeader';
