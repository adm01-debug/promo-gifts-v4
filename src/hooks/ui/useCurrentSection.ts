import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

const sectionMap: Record<string, string> = {
  '/': 'Catálogo',
  '/produtos': 'Catálogo',
  '/filtros': 'Super Filtro',
  '/novidades': 'Novidades',
  '/colecoes': 'Coleções',
  '/estoque': 'Estoque',
  '/orcamentos': 'Orçamentos',
  '/simulador': 'Simulador',
  '/simulador-precos': 'Preços por Tiragem',
  '/mockup-generator': 'Mockups',
  '/magic-up': 'Magic Up',
  '/favoritos': 'Favoritos',
  '/comparar': 'Comparar',

  '/configuracoes': 'Configurações',
  '/admin': 'Administração',
  '/admin/temas': 'Skins',
  '/seguranca': 'Segurança',
};

export function useCurrentSection(): string {
  const { pathname } = useLocation();

  return useMemo(() => {
    // Try exact match first
    if (sectionMap[pathname]) return sectionMap[pathname];

    // Special handling for dynamic routes
    if (pathname.startsWith('/produto/')) return 'Detalhes do Produto';
    if (pathname.startsWith('/cliente/')) return 'Detalhes do Cliente';
    if (pathname.startsWith('/orcamento/')) return 'Detalhes do Orçamento';

    // Try progressively shorter prefixes
    const parts = pathname.split('/').filter(Boolean);
    while (parts.length > 0) {
      const prefix = `/${parts.join('/')}`;
      if (sectionMap[prefix]) return sectionMap[prefix];
      parts.pop();
    }

    return 'Início';
  }, [pathname]);
}
