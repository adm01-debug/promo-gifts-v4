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
        <div ref={ref} className="mb-2 flex flex-col items-center justify-center py-6">
          <AppLogo showText={false} variant="sidebar" onClick={handleLogoClick} />
        </div>
      );
    }

    return (
      <div ref={ref} className="mb-2 px-4 py-5">
        <AppLogo variant="sidebar" textClassName="text-sm" onClick={handleLogoClick} />
      </div>
    );
  },
);

SidebarBrandHeader.displayName = 'SidebarBrandHeader';
