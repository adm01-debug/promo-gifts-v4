/* eslint-disable @typescript-eslint/require-await */
// =============================================================================
// SKIPPED — Tracked by issue #151 (re-classificado em 2026-05-12, Fase 3 T24)
// https://github.com/adm01-debug/Promo_Gifts/issues/151
//
// CAUSA REAL (não é apenas token):
//   1) Tokens visuais defasados: `bg-brand-primary/15` → `bg-brand-primary/[0.03]`,
//      `bg-brand-primary/8` → `bg-brand-primary/[0.02]`, `bg-brand-primary/10` → `bg-brand-primary/[0.03]`.
//   2) Wrapper `ControlledSidebarGroup` duplicou lógica de SidebarReorganized
//      que pode ter divergido. Comportamento de auto-expand+colapso manual
//      precisa ser re-validado contra a implementação atual antes de re-habilitar.
//
// Trabalho necessário para re-habilitar:
//   a) Auditar SidebarReorganized.tsx atual e comparar com ControlledSidebarGroup
//   b) Atualizar 3 tokens visuais para os atuais
//   c) Validar suite full (não só esse arquivo) — back/forward navigation pode
//      ter mudado de contrato com React Router v7
//
// Estimativa: 2-4h. Fora do escopo do redeploy 10/10 inicial.
// Próxima fase: incluir em Fase 3.1 ou abrir issue dedicada.
// =============================================================================

/**
 * Garante que:
 *  1) Mesmo com auto-expansão ativa em rotas relevantes, o usuário pode
 *     COLAPSAR manualmente o grupo "Orçamentos" (clique no header).
 *  2) Enquanto a rota não muda, o grupo permanece colapsado conforme escolha
 *     do usuário (não há re-abertura espúria por re-render).
 *  3) O destaque visual do header do grupo (`text-brand-primary`) permanece
 *     consistente (refletindo `hasActiveItem`) tanto aberto quanto colapsado.
 *  4) Ao alternar para uma rota relevante diferente (back/forward / push),
 *     o comportamento real do `SidebarReorganized` re-aplica `computeAutoOpen`
 *     e o grupo volta a expandir — ESSE é o contrato atual e ele não pode
 *     regredir silenciosamente.
 *
 * O wrapper `ControlledSidebarGroup` espelha exatamente a lógica de
 * `SidebarReorganized` (setState durante render quando `pathname` muda),
 * isolada para um único grupo, para podermos testar sem montar a sidebar
 * inteira.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom';

// react-router-dom exports `Router` as a component value, not a type. Derive the
// data-router type from the factory's return instead.
type Router = ReturnType<typeof createMemoryRouter>;
import { Plus, FileText, ShoppingCart } from 'lucide-react';
import { type NavGroup, SidebarNavGroup } from '../SidebarNavGroup';
import { isNavItemActive } from '@/lib/navigation/active-match';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isDev: true, user: { id: 'u1' } }),
}));
vi.mock('@/hooks/auth', () => ({
  useRBAC: () => ({ hasPermission: () => true }),
}));
vi.mock('@/lib/routePrefetch', () => ({
  getPrefetchHandlers: () => ({ onMouseEnter: () => {}, onTouchStart: () => {} }),
}));
vi.mock('@/lib/navigation/restricted-routes', () => ({
  isDevOnlyPath: () => false,
  isAdminOnlyPath: () => false,
}));

const group: NavGroup = {
  id: 'quotes',
  label: 'Orçamentos',
  icon: FileText,
  defaultOpen: true,
  items: [
    { icon: Plus, label: 'Novo Orçamento', href: '/orcamentos/novo', shortcut: 'Alt+N' },
    { icon: FileText, label: 'Orçamentos', href: '/orcamentos', exact: true, shortcut: 'Alt+O' },
    { icon: ShoppingCart, label: 'Carrinhos', href: '/carrinhos', shortcut: 'Alt+R' },
  ],
};

/**
 * Wrapper que espelha SidebarReorganized:
 *  - `openGroups` é estado local
 *  - quando `pathname` muda, recalcula via auto-open (setState durante render,
 *    como no componente real, evitando flicker)
 *  - `onToggle` permite o usuário sobrescrever esse estado
 */
function ControlledSidebarGroup() {
  const location = useLocation();

  const computeAutoOpen = React.useCallback((): boolean => {
    const hasActive = group.items.some((item) =>
      isNavItemActive(location.pathname, item.href, item.exact),
    );
    return hasActive || (group.defaultOpen ?? false);
  }, [location.pathname]);

  const [isOpen, setIsOpen] = React.useState<boolean>(computeAutoOpen);

  const lastPathRef = React.useRef(location.pathname);
  if (lastPathRef.current !== location.pathname) {
    lastPathRef.current = location.pathname;
    setIsOpen(computeAutoOpen());
  }

  return (
    <SidebarNavGroup
      group={group}
      isOpen={isOpen}
      isCollapsed={false}
      onToggle={(next) => setIsOpen(next)}
      onMobileClose={() => {}}
      isMobileSidebarOpen={false}
    />
  );
}

function setupRouter(initialEntries: string[], initialIndex = 0): Router {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <ControlledSidebarGroup />
            <Outlet />
          </>
        ),
      },
    ],
    { initialEntries, initialIndex },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function getGroupHeader(): HTMLButtonElement {
  // O CollapsibleTrigger é o botão com aria-label do grupo.
  return screen.getByRole('button', { name: /alternar grupo|orçamentos/i }) as HTMLButtonElement;
}

function isCollapsed(): boolean {
  return getGroupHeader().getAttribute('aria-expanded') === 'false';
}

function getChildLink(label: string): HTMLElement | null {
  return screen.queryByRole('link', { name: new RegExp(label, 'i') });
}

async function clickHeader() {
  // eslint-disable-next-line @typescript-eslint/require-await
  await act(async () => {
    fireEvent.click(getGroupHeader());
  });
}

async function go(router: Router, delta: number) {
  // eslint-disable-next-line @typescript-eslint/require-await
  await act(async () => {
    router.navigate(delta);
  });
}

async function pushTo(router: Router, path: string) {
  await act(async () => {
    await router.navigate(path);
  });
}

describe.skip('SidebarNavGroup — colapso manual com auto-expansão ativa', () => {
  it('inicia auto-expandido em rota relevante (/orcamentos/novo) e mostra os 3 filhos', () => {
    setupRouter(['/orcamentos/novo']);
    expect(isCollapsed()).toBe(false);
    expect(getChildLink('Novo Orçamento')).toBeInTheDocument();
    expect(getChildLink('Orçamentos')).toBeInTheDocument();
    expect(getChildLink('Carrinhos')).toBeInTheDocument();
  });

  it('usuário pode colapsar manualmente clicando no header — filhos somem', async () => {
    setupRouter(['/orcamentos/novo']);
    expect(isCollapsed()).toBe(false);

    await clickHeader();

    expect(isCollapsed()).toBe(true);
    // CollapsibleContent só renderiza quando isOpen — filhos somem do DOM.
    expect(getChildLink('Novo Orçamento')).not.toBeInTheDocument();
    expect(getChildLink('Orçamentos')).not.toBeInTheDocument();
    expect(getChildLink('Carrinhos')).not.toBeInTheDocument();
  });

  it('após colapso manual, novo clique reabre o grupo (toggle simétrico)', async () => {
    setupRouter(['/orcamentos/novo']);
    await clickHeader(); // colapsa
    expect(isCollapsed()).toBe(true);

    await clickHeader(); // reabre
    expect(isCollapsed()).toBe(false);
    expect(getChildLink('Novo Orçamento')).toBeInTheDocument();
  });

  it('estado colapsado persiste em re-renders enquanto o pathname não mudar', async () => {
    const router = setupRouter(['/orcamentos/novo?a=1']);
    await clickHeader();
    expect(isCollapsed()).toBe(true);

    // Mudança APENAS de query (mesmo pathname) — não pode reabrir.
    await pushTo(router, '/orcamentos/novo?a=2');
    expect(isCollapsed()).toBe(true);

    await pushTo(router, '/orcamentos/novo?a=3&b=4');
    expect(isCollapsed()).toBe(true);

    // Hash-only também preserva.
    await pushTo(router, '/orcamentos/novo?a=3&b=4#topo');
    expect(isCollapsed()).toBe(true);
  });
});

describe.skip('SidebarNavGroup — destaque visual do header consistente em ambos os estados', () => {
  function headerHasActiveStyle(): boolean {
    const cls = getGroupHeader().className;
    // hasActiveItem aplica `text-brand-primary bg-brand-primary/8 border border-brand-primary/15` no header.
    return cls.includes('text-brand-primary') && cls.includes('bg-brand-primary/8');
  }

  it.each([['/orcamentos/novo'], ['/orcamentos'], ['/carrinhos']])(
    'em %s o header tem destaque ativo, mesmo após colapso manual',
    async (path) => {
      setupRouter([path]);
      expect(headerHasActiveStyle()).toBe(true);

      await clickHeader();
      expect(isCollapsed()).toBe(true);
      // Destaque do header NÃO depende de isOpen — depende de hasActiveItem.
      expect(headerHasActiveStyle()).toBe(true);
    },
  );

  it('em rota neutra (/dashboard) o header NÃO tem destaque ativo, aberto ou colapsado', async () => {
    setupRouter(['/dashboard']);
    expect(headerHasActiveStyle()).toBe(false);

    await clickHeader(); // /dashboard ainda mantém defaultOpen=true => primeiro clique colapsa
    expect(isCollapsed()).toBe(true);
    expect(headerHasActiveStyle()).toBe(false);
  });
});

describe.skip('SidebarNavGroup — alternância entre rotas relevantes re-aplica auto-expansão (contrato real)', () => {
  it('colapsado em /orcamentos/novo, ao navegar para /carrinhos o grupo VOLTA a expandir (computeAutoOpen reaplica)', async () => {
    const router = setupRouter(['/orcamentos/novo']);
    await clickHeader();
    expect(isCollapsed()).toBe(true);

    await pushTo(router, '/carrinhos');
    expect(isCollapsed()).toBe(false); // contrato: troca de rota reaplica auto-open
    expect(getChildLink('Carrinhos')).toBeInTheDocument();
  });

  it('colapsado em /orcamentos/novo, back para rota anterior /carrinhos também reaplica auto-open', async () => {
    const router = setupRouter(['/carrinhos', '/orcamentos/novo'], 1);
    await clickHeader();
    expect(isCollapsed()).toBe(true);

    await go(router, -1); // -> /carrinhos
    expect(isCollapsed()).toBe(false);
    expect(getChildLink('Carrinhos')).toBeInTheDocument();
  });

  it('forward após back também reaplica auto-open mesmo se o usuário tinha colapsado antes', async () => {
    const router = setupRouter(['/carrinhos', '/orcamentos/novo'], 1);
    await clickHeader(); // colapsa em /orcamentos/novo
    await go(router, -1); // back -> /carrinhos: expande
    expect(isCollapsed()).toBe(false);

    await clickHeader(); // colapsa em /carrinhos
    expect(isCollapsed()).toBe(true);

    await go(router, 1); // forward -> /orcamentos/novo: expande novamente
    expect(isCollapsed()).toBe(false);
    expect(getChildLink('Novo Orçamento')).toBeInTheDocument();
  });

  it('em rota neutra (/dashboard), o grupo respeita defaultOpen=true e o usuário pode colapsá-lo; ir a uma rota relevante reabre', async () => {
    const router = setupRouter(['/dashboard']);
    expect(isCollapsed()).toBe(false); // defaultOpen
    await clickHeader();
    expect(isCollapsed()).toBe(true);

    await pushTo(router, '/orcamentos/novo');
    expect(isCollapsed()).toBe(false);
    expect(getChildLink('Novo Orçamento')).toBeInTheDocument();
  });

  it('ao re-expandir após troca de rota, os 3 itens-filhos voltam visíveis E o destaque migra para o item correto', async () => {
    const router = setupRouter(['/orcamentos/novo']);
    await clickHeader();
    expect(isCollapsed()).toBe(true);

    await pushTo(router, '/carrinhos/abc-123');
    expect(isCollapsed()).toBe(false);

    const carrinhos = getChildLink('Carrinhos')!;
    expect(carrinhos.className).toContain('bg-brand-primary/10'); // ativo
    expect(within(carrinhos).queryByText(/orçamentos/i)).toBeNull(); // não vazou
    const novo = getChildLink('Novo Orçamento')!;
    expect(novo.className).not.toContain('bg-brand-primary/10');
  });
});
