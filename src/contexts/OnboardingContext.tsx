import React, { createContext, useContext } from 'react';
import { useOnboarding as useOnboardingHook } from '@/hooks/ui';

type OnboardingContextType = ReturnType<typeof useOnboardingHook>;

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const onboarding = useOnboardingHook();
  return <OnboardingContext.Provider value={onboarding}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingContext(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider');
  }
  return ctx;
}

// Same context, but returns null instead of throwing when used outside the
// provider. Call sites that wrap useOnboardingContext() in try/catch (e.g.,
// global shortcuts, sidebar header, spotlight, shortcuts dialog — components
// that may render outside MainLayout) violate Rules of Hooks. Use this
// variant instead.
export function useOnboardingContextOptional(): OnboardingContextType | null {
  return useContext(OnboardingContext);
}
