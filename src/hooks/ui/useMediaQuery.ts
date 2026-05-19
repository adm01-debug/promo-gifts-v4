import { useEffect, useState } from "react";

/**
 * useMediaQuery — boolean reativo para uma CSS media query.
 *
 * Compatível com SSR: durante o primeiro render no servidor (ou ambientes
 * sem `window.matchMedia`), retorna `false`. Depois do mount, sincroniza
 * com `matchMedia(query).matches` e atualiza em mudanças via listener.
 *
 * @example
 *   const isMobile = useMediaQuery("(max-width: 1023px)");
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = (): boolean => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = (): void => setMatches(mql.matches);

    // Garantir sync se o valor inicial divergiu (ex.: hydration)
    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Fallback Safari < 14
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
