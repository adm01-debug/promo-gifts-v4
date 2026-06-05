import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * useMobileSidebarFix — Correção global para fechar a sidebar automaticamente
 * ao mudar de rota em dispositivos móveis, prevenindo que o overlay bloqueie
 * a navegação ou o scroll.
 *
 * @param onToggle Função para alternar o estado da sidebar (tipicamente setSidebarOpen)
 * @param isOpen Estado atual da sidebar
 */
export function useMobileSidebarFix(onToggle: () => void, isOpen: boolean) {
  const { pathname } = useLocation();

  useEffect(() => {
    // Se a sidebar estiver aberta e a rota mudar (mobile), fecha a sidebar
    if (isOpen && window.innerWidth < 1024) {
      onToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // intentionally omit isOpen/onToggle: effect must only fire on route change
}
