import { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Lazy-loaded global components
const OnboardingTour = lazyWithRetry(() =>
  import('@/components/onboarding/OnboardingTour').then((m) => ({ default: m.OnboardingTour })),
);
const EnhancedSpotlight = lazyWithRetry(() =>
  import('@/components/common/EnhancedSpotlight').then((m) => ({ default: m.EnhancedSpotlight })),
);
const SmartMobileNav = lazyWithRetry(() =>
  import('@/components/mobile/SmartMobileNav').then((m) => ({ default: m.SmartMobileNav })),
);
const QuickQuoteFAB = lazyWithRetry(() =>
  import('@/components/quotes/QuickQuoteFAB').then((m) => ({ default: m.QuickQuoteFAB })),
);
const FloatingCompareBar = lazyWithRetry(() =>
  import('@/components/compare/FloatingCompareBar').then((m) => ({
    default: m.FloatingCompareBar,
  })),
);
const ScrollToTopButton = lazyWithRetry(() =>
  import('@/components/common/ScrollToTopButton').then((m) => ({ default: m.ScrollToTopButton })),
);
const ScrollProgressIndicator = lazyWithRetry(() =>
  import('@/components/common/ScrollProgress').then((m) => ({
    default: m.ScrollProgressIndicator,
  })),
);

export function GlobalOverlay() {
  return (
    <div className="print:hidden">
      <Suspense fallback={null}>
        <ScrollProgressIndicator color="primary" height={3} />
      </Suspense>
      <Suspense fallback={null}>
        <EnhancedSpotlight />
      </Suspense>
      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
      <Suspense fallback={null}>
        <QuickQuoteFAB />
      </Suspense>
      <Suspense fallback={null}>
        <FloatingCompareBar />
      </Suspense>
      <Suspense fallback={null}>
        <SmartMobileNav />
      </Suspense>
      <Suspense fallback={null}>
        <ScrollToTopButton threshold={150} />
      </Suspense>
    </div>
  );
}
