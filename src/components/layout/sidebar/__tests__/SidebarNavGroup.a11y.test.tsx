/* eslint-disable @typescript-eslint/require-await */
/**
 * Testes de acessibilidade do grupo de navegação que contém "Novo Orçamento".
 *
 * Cobre os atributos ARIA gerenciados pelo Radix Collapsible (via
 * CollapsibleTrigger / CollapsibleContent) e pelo nosso wrapper:
 *   - aria-expanded no header (true quando aberto, false quando colapsado)
 *   - aria-controls no header apontando para o id do conteúdo
 *   - id do CollapsibleContent (ponta correspondente do aria-controls)
 *   - data-state ("open" | "closed") em ambos
 *   - aria-label do header (fixo/estável para leitores de tela)
 *   - aria-current="page" no NavLink ativo (Novo Orçamento, Orçamentos, Carrinhos)
 *
 * Inclui transições back/forward para garantir que os ARIA acompanham a rota.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

/** Wrapper que espelha SidebarReorganized: auto-open síncrono em troca de rota. */
function ControlledSidebarGroup() {
  const location = useLocation();
  const computeAutoOpen = React.useCallback(
    () =>
      group.items.some((item) => isNavItemActive(location.pathname, item.href, item.exact)) ||
      (group.defaultOpen ?? false),
    [location.pathname],
  );
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

function getHeaderButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /alternar grupo|orçamentos/i }) as HTMLButtonElement;
}

function getNavLink(label: string): HTMLAnchorElement | null {
  return screen.queryByRole('link', { name: new RegExp(label, 'i') }) as HTMLAnchorElement | null;
}

async function pushTo(router: Router, path: string) {
  await act(async () => {
    await router.navigate(path);
  });
}

async function go(router: Router, delta: number) {
  await act(async () => {
    router.navigate(delta);
  });
}

describe('SidebarNavGroup — atributos ARIA do Collapsible (header e content)', () => {
  it("em rota relevante (/orcamentos/novo) o header é aria-expanded='true' e tem aria-controls válido", () => {
    setupRouter(['/orcamentos/novo']);
    const header = getHeaderButton();

    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(header.getAttribute('data-state')).toBe('open');

    const controlsId = header.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const content = document.getElementById(controlsId!);
    expect(content).not.toBeNull();
    expect(content?.getAttribute('data-state')).toBe('open');
  });

  it("o aria-label do header reflete a ação disponível: 'Recolher' quando aberto, 'Expandir' quando colapsado", async () => {
    const router = setupRouter(['/orcamentos/novo']);
    const labelOpen = getHeaderButton().getAttribute('aria-label') ?? '';
    expect(labelOpen).toMatch(/recolher/i);
    expect(labelOpen).toMatch(/orçamentos/i);

    await act(async () => {
      getHeaderButton().click();
    });
    const labelClosed = getHeaderButton().getAttribute('aria-label') ?? '';
    expect(labelClosed).toMatch(/expandir/i);
    expect(labelClosed).toMatch(/orçamentos/i);
    expect(labelClosed).not.toBe(labelOpen);

    // Ao trocar de rota relevante, auto-open reaplica e o label volta para "Recolher".
    await pushTo(router, '/carrinhos');
    expect(getHeaderButton().getAttribute('aria-label') ?? '').toMatch(/recolher/i);
  });

  it('aria-expanded e data-state alternam corretamente ao toggle manual', async () => {
    setupRouter(['/orcamentos/novo']);
    const header = getHeaderButton();
    const controlsId = header.getAttribute('aria-controls')!;

    expect(header.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      header.click();
    });

    expect(getHeaderButton().getAttribute('aria-expanded')).toBe('false');
    expect(getHeaderButton().getAttribute('data-state')).toBe('closed');

    // O Content é desmontado quando isOpen=false (CollapsibleContent atrás de `isOpen && ...`).
    // O aria-controls do header continua válido como identificador, mas o nó pode não estar no DOM.
    const content = document.getElementById(controlsId);
    // Aceitamos null (desmontado) ou data-state=closed se ainda presente.
    if (content) {
      expect(content.getAttribute('data-state')).toBe('closed');
    } else {
      expect(content).toBeNull();
    }
  });

  it("ao alternar rotas relevantes (/orcamentos/novo -> /carrinhos -> /orcamentos), aria-expanded permanece 'true' e aria-controls aponta a um nó existente", async () => {
    const router = setupRouter(['/orcamentos/novo']);

    for (const path of ['/carrinhos', '/orcamentos', '/orcamentos/novo']) {
      await pushTo(router, path);
      const header = getHeaderButton();
      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(header.getAttribute('data-state')).toBe('open');

      const controlsId = header.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();
      const content = document.getElementById(controlsId!);
      expect(content).not.toBeNull();
      expect(content?.getAttribute('data-state')).toBe('open');
    }
  });

  it('back/forward atualizam aria-expanded e data-state em sincronia com a rota', async () => {
    const router = setupRouter(['/dashboard', '/orcamentos/novo'], 1);
    expect(getHeaderButton().getAttribute('aria-expanded')).toBe('true');

    // Colapsa manualmente em /orcamentos/novo
    await act(async () => {
      getHeaderButton().click();
    });
    expect(getHeaderButton().getAttribute('aria-expanded')).toBe('false');

    // back -> /dashboard (defaultOpen=true) reaplica auto-open
    await go(router, -1);
    const headerAfterBack = getHeaderButton();
    expect(headerAfterBack.getAttribute('aria-expanded')).toBe('true');
    expect(headerAfterBack.getAttribute('data-state')).toBe('open');

    // forward -> /orcamentos/novo: rota relevante, reaplica auto-open
    await go(router, 1);
    const headerAfterFwd = getHeaderButton();
    expect(headerAfterFwd.getAttribute('aria-expanded')).toBe('true');
    expect(headerAfterFwd.getAttribute('data-state')).toBe('open');
  });

  it('mudanças apenas na query string NÃO causam reset dos ARIA do header (estado preservado)', async () => {
    const router = setupRouter(['/orcamentos/novo?a=1']);
    const before = {
      expanded: getHeaderButton().getAttribute('aria-expanded'),
      state: getHeaderButton().getAttribute('data-state'),
      controls: getHeaderButton().getAttribute('aria-controls'),
    };

    await pushTo(router, '/orcamentos/novo?a=2');
    await pushTo(router, '/orcamentos/novo?a=3&b=4');

    const after = {
      expanded: getHeaderButton().getAttribute('aria-expanded'),
      state: getHeaderButton().getAttribute('data-state'),
      controls: getHeaderButton().getAttribute('aria-controls'),
    };

    expect(after.expanded).toBe(before.expanded);
    expect(after.state).toBe(before.state);
    expect(after.controls).toBe(before.controls); // mesmo nó controlado
  });
});

describe('SidebarNavGroup — aria-current nos NavLinks acompanha a rota', () => {
  /**
   * Conjunto de labels que DEVEM ter aria-current='page' em cada rota.
   * Reflete o comportamento real do `NavLink` (RR v6) sem `end`: links cuja
   * `to` é prefixo do pathname recebem aria-current. O item "Orçamentos" usa
   * `exact: true` no nosso modelo (afeta o destaque visual via
   * `isNavItemActive`), mas o `NavLink` em si NÃO recebe `end`, então em
   * `/orcamentos/novo` tanto "Novo Orçamento" quanto "Orçamentos" recebem
   * aria-current. Esse contrato é validado para evitar regressão silenciosa.
   */
  const ARIA_CURRENT_BY_ROUTE: Record<string, string[]> = {
    '/orcamentos/novo': ['Novo Orçamento', 'Orçamentos'],
    '/orcamentos': ['Orçamentos'],
    '/carrinhos': ['Carrinhos'],
    '/carrinhos/abc-123': ['Carrinhos'],
  };

  it.each(Object.entries(ARIA_CURRENT_BY_ROUTE))(
    "em %s os links com aria-current='page' são exatamente %j",
    (path, expectedActive) => {
      setupRouter([path]);
      const labels = ['Novo Orçamento', 'Orçamentos', 'Carrinhos'];
      for (const label of labels) {
        const link = getNavLink(label);
        expect(link).not.toBeNull();
        const cur = link!.getAttribute('aria-current');
        if ((expectedActive as string[]).includes(label)) {
          expect(cur).toBe('page');
        } else {
          expect(cur === null || cur === 'false').toBe(true);
        }
      }
    },
  );

  it('ao navegar /carrinhos -> /orcamentos/novo, aria-current migra (Carrinhos sai, Novo Orçamento entra)', async () => {
    const router = setupRouter(['/carrinhos']);
    expect(getNavLink('Carrinhos')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).not.toBe('page');

    await pushTo(router, '/orcamentos/novo');
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Carrinhos')!.getAttribute('aria-current')).not.toBe('page');
  });

  it('após back/forward, aria-current permanece consistente com a rota corrente', async () => {
    const router = setupRouter(['/carrinhos', '/orcamentos/novo', '/orcamentos'], 2);
    // Em /orcamentos: só Orçamentos é ativo (não há subpath)
    expect(getNavLink('Orçamentos')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).not.toBe('page');
    expect(getNavLink('Carrinhos')!.getAttribute('aria-current')).not.toBe('page');

    await go(router, -1); // /orcamentos/novo
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).toBe('page');
    // Em /orcamentos/novo, "Orçamentos" também recebe aria-current via prefixo do NavLink (sem `end`).
    expect(getNavLink('Orçamentos')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Carrinhos')!.getAttribute('aria-current')).not.toBe('page');

    await go(router, -1); // /carrinhos
    expect(getNavLink('Carrinhos')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).not.toBe('page');
    expect(getNavLink('Orçamentos')!.getAttribute('aria-current')).not.toBe('page');

    await go(router, 2); // forward até /orcamentos
    expect(getNavLink('Orçamentos')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).not.toBe('page');
  });

  it("em rota neutra (/dashboard) NENHUM link do grupo tem aria-current='page'", () => {
    setupRouter(['/dashboard']);
    for (const label of ['Novo Orçamento', 'Orçamentos', 'Carrinhos']) {
      const link = getNavLink(label)!;
      expect(link.getAttribute('aria-current')).not.toBe('page');
    }
  });

  it('query-only change em /orcamentos/novo NÃO altera aria-current', async () => {
    const router = setupRouter(['/orcamentos/novo?a=1']);
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).toBe('page');

    await pushTo(router, '/orcamentos/novo?a=2&b=3');
    expect(getNavLink('Novo Orçamento')!.getAttribute('aria-current')).toBe('page');
    expect(getNavLink('Carrinhos')!.getAttribute('aria-current')).not.toBe('page');
  });
});
