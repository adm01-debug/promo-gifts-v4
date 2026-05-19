import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * 🚀 PREFETCH CORE CHUNKS: Warm up the next predicted routes for instant feel.
 *
 * Triggers eager `import()` on contextually likely-next pages based on
 * current pathname. Has no DOM output — returns null.
 */
export function RoutePrefetcher() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Only prefetch if we're not on a mobile connection or low power mode
    const connection = (navigator as any).connection;
    if (connection && (connection.saveData || connection.effectiveType === '2g')) {
      return;
    }

    if (pathname === "/auth" || pathname === "/login") {
      // Prefetch dashboard early
      import("@/pages/Index");
      import("@/pages/FiltersPage");
    } else if (pathname === "/") {
      // Prefetch heavy pages from dashboard
      import("@/pages/FiltersPage");
      import("@/pages/QuotesListPage");
      import("@/pages/ClientsPage");
    } else if (pathname === "/produtos") {
      import("@/pages/ProductDetail");
      import("@/pages/PriceSimulatorPage");
    }

    // Secondary priority prefetch
    const timeoutId = setTimeout(() => {
      if (pathname !== "/orcamentos/novo") import("@/pages/QuoteBuilderPage");
      if (pathname === "/produtos") import("@/pages/MockupGenerator");
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}
