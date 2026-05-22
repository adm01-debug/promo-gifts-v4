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

/**
 * Versão opcional: retorna `null` se chamado fora do Provider em vez de throw.
 * Use quando o componente pode ser renderizado em árvores sem OnboardingProvider
 * (ex.: Sidebar/Spotlight/ShortcutsDialog em layout admin sem tour).
 *
 * Sempre chama o hook (cumpre rules-of-hooks), evitando o anti-pattern
 * `try { useOnboardingContext() } catch {}` que viola a regra estaticamente.
 */
export function useOptionalOnboardingContext(): OnboardingContextType | null {
  return useContext(OnboardingContext);
}
