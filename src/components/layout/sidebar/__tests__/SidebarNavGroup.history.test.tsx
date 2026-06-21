/**
 * Garante que o destaque (active state) e a auto-expansão do grupo "Orçamentos"
 * permanecem consistentes para "Novo Orçamento" — em paridade com "Orçamentos"
 * e "Carrinhos" — quando o usuário navega usando o histórico do navegador
 * (back / forward), e não apenas em deep-links isolados.
 *
 * Usa createMemoryRouter (React Router v6) para obter um histórico real
 * navegável via router.navigate(delta).
 */
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
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

function Layout() {
  return (
    <>
      <SidebarNavGroup
        group={group}
        isOpen
        isCollapsed={false}
        onToggle={() => {}}
        onMobileClose={() => {}}
        isMobileSidebarOpen={false}
      />
      <Outlet />
    </>
  );
}

function setupHistory(initialEntries: string[], initialIndex = 0): Router {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <Layout />,
      },
    ],
    { initialEntries, initialIndex },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function getLink(label: string): HTMLAnchorElement {
  return screen.getByRole('link', { name: new RegExp(label, 'i') }) as HTMLAnchorElement;
}

function isActive(label: string): boolean {
  return getLink(label).className.includes('bg-primary/10');
}

/**
 * Normaliza o conjunto de classes para comparação de paridade entre itens:
 * remove a classe `active` adicionada pelo NavLink (do React Router), que é
 * baseada apenas no `to` e independente do nosso destaque visual baseado em
 * `isNavItemActive`. O foco aqui é a paridade do *layout/visual idle*.
 */
function classSetIgnoringNavLinkActive(label: string): string {
  return getLink(label)
    .className.split(/\s+/)
    .filter((c) => c !== 'active')
    .sort()
    .join(' ');
}

function groupShouldAutoOpen(pathname: string): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item.href, item.exact));
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

describe('SidebarNavGroup — back/forward (histórico real) preservam paridade entre os 3 itens', () => {
  it('back: /carrinhos -> /orcamentos/novo, voltar reativa Carrinhos e desativa Novo Orçamento', async () => {
    const router = setupHistory(['/carrinhos']);
    expect(isActive('Carrinhos')).toBe(true);
    expect(isActive('Novo Orçamento')).toBe(false);

    await pushTo(router, '/orcamentos/novo');
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Carrinhos')).toBe(false);

    // back
    await go(router, -1);
    expect(isActive('Carrinhos')).toBe(true);
    expect(isActive('Novo Orçamento')).toBe(false);
    expect(isActive('Orçamentos')).toBe(false);
  });

  it('forward: depois de voltar, avançar restaura o destaque de Novo Orçamento', async () => {
    const router = setupHistory(['/carrinhos']);
    await pushTo(router, '/orcamentos/novo');
    await go(router, -1); // back -> /carrinhos
    expect(isActive('Carrinhos')).toBe(true);

    await go(router, 1); // forward -> /orcamentos/novo
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Carrinhos')).toBe(false);
    expect(isActive('Orçamentos')).toBe(false);
  });

  it('back/forward atravessando os 3 itens mantém destaque correto a cada salto', async () => {
    // pilha: /dashboard -> /carrinhos -> /orcamentos -> /orcamentos/novo
    const router = setupHistory(['/dashboard', '/carrinhos', '/orcamentos', '/orcamentos/novo'], 3);

    expect(isActive('Novo Orçamento')).toBe(true);

    await go(router, -1); // /orcamentos
    expect(isActive('Orçamentos')).toBe(true);
    expect(isActive('Novo Orçamento')).toBe(false);

    await go(router, -1); // /carrinhos
    expect(isActive('Carrinhos')).toBe(true);
    expect(isActive('Orçamentos')).toBe(false);

    await go(router, -1); // /dashboard (neutro)
    expect(isActive('Carrinhos')).toBe(false);
    expect(isActive('Novo Orçamento')).toBe(false);
    expect(isActive('Orçamentos')).toBe(false);

    await go(router, 1); // /carrinhos
    expect(isActive('Carrinhos')).toBe(true);

    await go(router, 1); // /orcamentos
    expect(isActive('Orçamentos')).toBe(true);
    expect(isActive('Carrinhos')).toBe(false);

    await go(router, 1); // /orcamentos/novo
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Orçamentos')).toBe(false);
  });

  it('back de rota filha /carrinhos/abc-123 para /orcamentos/novo: paridade entre Novo e Carrinhos', async () => {
    const router = setupHistory(['/orcamentos/novo']);
    expect(isActive('Novo Orçamento')).toBe(true);

    await pushTo(router, '/carrinhos/abc-123');
    expect(isActive('Carrinhos')).toBe(true);
    expect(isActive('Novo Orçamento')).toBe(false);

    await go(router, -1);
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Carrinhos')).toBe(false);
  });

  it('o grupo Orçamentos deve permanecer auto-expandido em CADA passo de back/forward entre os 3 itens', async () => {
    const stack = ['/orcamentos/novo', '/orcamentos', '/carrinhos'];
    const router = setupHistory(stack, stack.length - 1);

    // /carrinhos
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(true);

    await go(router, -1); // /orcamentos
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(true);

    await go(router, -1); // /orcamentos/novo
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(true);

    await go(router, 1); // /orcamentos
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(true);

    await go(router, 1); // /carrinhos
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(true);
  });

  it('ao voltar para uma rota neutra (/dashboard), o grupo NÃO deveria estar auto-expandido', async () => {
    const router = setupHistory(['/dashboard', '/orcamentos/novo'], 1);
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(true);

    await go(router, -1); // /dashboard
    expect(groupShouldAutoOpen(router.state.location.pathname)).toBe(false);
    expect(isActive('Novo Orçamento')).toBe(false);
    expect(isActive('Orçamentos')).toBe(false);
    expect(isActive('Carrinhos')).toBe(false);
  });

  it('após back/forward, o conjunto de classes idle de Novo Orçamento permanece IGUAL ao de Carrinhos (sem drift)', async () => {
    const router = setupHistory(['/orcamentos/novo', '/carrinhos'], 1);
    // Em /carrinhos: Novo está idle, Orçamentos está idle
    const novoIdleA = classSetIgnoringNavLinkActive('Novo Orçamento');
    const orcamentosIdleA = classSetIgnoringNavLinkActive('Orçamentos');
    expect(novoIdleA).toBe(orcamentosIdleA);

    await go(router, -1); // /orcamentos/novo: Carrinhos está idle, Orçamentos está idle
    const carrinhosIdleB = classSetIgnoringNavLinkActive('Carrinhos');
    const orcamentosIdleB = classSetIgnoringNavLinkActive('Orçamentos');
    expect(carrinhosIdleB).toBe(orcamentosIdleB);

    // E o idle de Novo (em A) deve ser igual ao idle de Carrinhos (em B): paridade total.
    expect(novoIdleA).toBe(carrinhosIdleB);

    await go(router, 1); // /carrinhos novamente
    const novoIdleC = classSetIgnoringNavLinkActive('Novo Orçamento');
    expect(novoIdleC).toBe(novoIdleA); // idempotente após round-trip
  });
});

/**
 * Cobre o cenário em que apenas a query string muda (ex.: filtros, drafts,
 * `?cliente=42`) sem alterar o `pathname`. O destaque do "Novo Orçamento" deve
 * permanecer estável e o grupo "Orçamentos" NÃO pode abrir/fechar como efeito
 * colateral. Espelha exatamente a lógica de `computeAutoOpen` do
 * `SidebarReorganized`, que usa apenas `location.pathname`.
 */
describe('SidebarNavGroup — mudanças apenas na query string preservam estado', () => {
  /** Espelha SidebarReorganized.computeAutoOpen — usa SOMENTE pathname. */
  function autoOpenFromLocation(pathname: string): boolean {
    return groupShouldAutoOpen(pathname);
  }

  it('trocar ?a=1 por ?a=2 em /orcamentos/novo mantém Novo Orçamento ativo', async () => {
    const router = setupHistory(['/orcamentos/novo?a=1']);
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Orçamentos')).toBe(false);
    expect(isActive('Carrinhos')).toBe(false);

    await pushTo(router, '/orcamentos/novo?a=2');
    expect(router.state.location.pathname).toBe('/orcamentos/novo');
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Orçamentos')).toBe(false);
    expect(isActive('Carrinhos')).toBe(false);
  });

  it('adicionar query a /orcamentos/novo (sem query -> com query) não altera o destaque', async () => {
    const router = setupHistory(['/orcamentos/novo']);
    expect(isActive('Novo Orçamento')).toBe(true);

    await pushTo(router, '/orcamentos/novo?cliente=42&draft=1');
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Orçamentos')).toBe(false);
    expect(isActive('Carrinhos')).toBe(false);
  });

  it('remover query de /orcamentos/novo?cliente=42 (com query -> sem query) não altera o destaque', async () => {
    const router = setupHistory(['/orcamentos/novo?cliente=42']);
    expect(isActive('Novo Orçamento')).toBe(true);

    await pushTo(router, '/orcamentos/novo');
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Orçamentos')).toBe(false);
    expect(isActive('Carrinhos')).toBe(false);
  });

  it('hash-only change em /orcamentos/novo#secao não altera o destaque', async () => {
    const router = setupHistory(['/orcamentos/novo']);
    expect(isActive('Novo Orçamento')).toBe(true);

    await pushTo(router, '/orcamentos/novo#topo');
    expect(isActive('Novo Orçamento')).toBe(true);

    await pushTo(router, '/orcamentos/novo#rodape');
    expect(isActive('Novo Orçamento')).toBe(true);
  });

  it('o grupo Orçamentos permanece auto-aberto e estável quando só a query muda', async () => {
    const router = setupHistory(['/orcamentos/novo?step=1']);
    expect(autoOpenFromLocation(router.state.location.pathname)).toBe(true);

    await pushTo(router, '/orcamentos/novo?step=2');
    expect(autoOpenFromLocation(router.state.location.pathname)).toBe(true);

    await pushTo(router, '/orcamentos/novo?step=3&cliente=99');
    expect(autoOpenFromLocation(router.state.location.pathname)).toBe(true);
  });

  it('o conjunto de classes idle dos itens NÃO ativos não muda quando apenas a query muda', async () => {
    const router = setupHistory(['/orcamentos/novo?a=1']);
    const carrinhosIdleA = classSetIgnoringNavLinkActive('Carrinhos');
    const orcamentosIdleA = classSetIgnoringNavLinkActive('Orçamentos');

    await pushTo(router, '/orcamentos/novo?a=2&b=3');
    const carrinhosIdleB = classSetIgnoringNavLinkActive('Carrinhos');
    const orcamentosIdleB = classSetIgnoringNavLinkActive('Orçamentos');

    expect(carrinhosIdleB).toBe(carrinhosIdleA);
    expect(orcamentosIdleB).toBe(orcamentosIdleA);
  });

  it('query change + back: depois de voltar à URL anterior, o destaque permanece em Novo Orçamento', async () => {
    const router = setupHistory(['/orcamentos/novo?a=1']);
    await pushTo(router, '/orcamentos/novo?a=2');
    await pushTo(router, '/orcamentos/novo?a=3');

    await go(router, -1); // ?a=2
    expect(router.state.location.pathname).toBe('/orcamentos/novo');
    expect(router.state.location.search).toBe('?a=2');
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Carrinhos')).toBe(false);

    await go(router, -1); // ?a=1
    expect(isActive('Novo Orçamento')).toBe(true);
    expect(isActive('Carrinhos')).toBe(false);

    await go(router, 2); // forward até ?a=3
    expect(router.state.location.search).toBe('?a=3');
    expect(isActive('Novo Orçamento')).toBe(true);
  });

  it('query mudando em /carrinhos NÃO migra destaque para Novo Orçamento (não há vazamento entre itens)', async () => {
    const router = setupHistory(['/carrinhos?filtro=todos']);
    expect(isActive('Carrinhos')).toBe(true);
    expect(isActive('Novo Orçamento')).toBe(false);

    await pushTo(router, '/carrinhos?filtro=ativos&page=2');
    expect(isActive('Carrinhos')).toBe(true);
    expect(isActive('Novo Orçamento')).toBe(false);
    expect(isActive('Orçamentos')).toBe(false);
  });

  it('classes do próprio Novo Orçamento são idênticas antes e depois de uma mudança apenas de query', async () => {
    const router = setupHistory(['/orcamentos/novo?a=1']);
    const novoBefore = getLink('Novo Orçamento')
      .className.split(/\s+/)
      .filter((c) => c !== 'active')
      .sort()
      .join(' ');

    await pushTo(router, '/orcamentos/novo?a=2&b=3');
    const novoAfter = getLink('Novo Orçamento')
      .className.split(/\s+/)
      .filter((c) => c !== 'active')
      .sort()
      .join(' ');

    expect(novoAfter).toBe(novoBefore);
  });
});
