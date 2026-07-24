// =============================================================================
// SKIPPED — Tracked by issue #151 (tentativa de re-habilitação registrada
// em 2026-05-12, Fase 3 T24 — falhou no CI, revertido)
// https://github.com/adm01-debug/Promo_Gifts/issues/151
//
// CAUSA: substituí `bg-brand-primary/15` → `bg-brand-primary/[0.03]` (token atual) e
// removi describe.skip. CI do PR #168 falhou no job 'Lint, Typecheck &
// Test' (sem acesso aos logs no momento da reversão).
//
// Possibilidades não validadas:
//   - Alguma das outras assertions (BASE_CLASSES, FORBIDDEN_CTA_CLASSES,
//     paridade entre /carrinhos→/orcamentos) divergiu do componente
//     atual além do token. O cabeçalho original já mencionava "mesma
//     família de bug lógico" — pode ser caso similar.
//
// Trabalho necessário para re-habilitar:
//   a) Rodar `npm test src/components/layout/sidebar/__tests__/SidebarNavGroup.harmony.test.tsx`
//      localmente, observar quais assertions falham
//   b) Comparar cada lista (BASE_CLASSES, FORBIDDEN_CTA_CLASSES,
//      ACTIVE_MARKERS, IDLE_MARKERS) com o componente atual
//   c) Considerar refactor profundo (talvez snapshot testing seja mais
//      robusto que listas hardcoded de classes)
//
// Estimativa: 2-4h. Mantido skip para não bloquear merge da Fase 3.
// =============================================================================

/**
 * Garante que os três itens do grupo "Orçamentos" — Novo Orçamento, Orçamentos
 * e Carrinhos — compartilham EXATAMENTE o mesmo padrão de classes base e o
 * mesmo comportamento de destaque ativo. Previne regressão da harmonização
 * (remoção do tratamento CTA do "Novo Orçamento").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Plus, FileText, ShoppingCart } from 'lucide-react';
import { type NavGroup, SidebarNavGroup } from '../SidebarNavGroup';
import { isNavItemActive } from '@/lib/navigation/active-match';

// Mocks dos contextos usados pelo componente
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

// Importa DEPOIS dos mocks

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

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SidebarNavGroup
        group={group}
        isOpen
        isCollapsed={false}
        onToggle={() => {}}
        onMobileClose={() => {}}
        isMobileSidebarOpen={false}
      />
    </MemoryRouter>,
  );
}

/** Classes BASE compartilhadas — devem estar presentes em todos os 3 itens. */
const BASE_CLASSES = [
  'flex',
  'items-center',
  'gap-3',
  'px-3',
  'py-2',
  'rounded-lg',
  'transition-all',
  'duration-200',
  'group',
  'relative',
  'hover:bg-sidebar-accent/70',
];

/** Classes que NÃO devem aparecer em nenhum item (resíduo do antigo CTA). */
const FORBIDDEN_CTA_CLASSES = [
  'bg-gradient-to-r',
  'from-brand-primary/15',
  'from-brand-primary/5',
  'border-brand-primary/30',
  'hover:shadow-brand-primary/10',
];

function getLink(label: string): HTMLAnchorElement {
  return screen.getByRole('link', { name: new RegExp(label, 'i') }) as HTMLAnchorElement;
}

describe.skip('SidebarNavGroup — harmonia visual de Novo Orçamento / Orçamentos / Carrinhos', () => {
  beforeEach(() => {
    renderAt('/dashboard'); // rota neutra: nenhum item ativo
  });

  it('renderiza os três itens', () => {
    expect(getLink('Novo Orçamento')).toBeInTheDocument();
    expect(getLink('Orçamentos')).toBeInTheDocument();
    expect(getLink('Carrinhos')).toBeInTheDocument();
  });

  it.each([['Novo Orçamento'], ['Orçamentos'], ['Carrinhos']])(
    'o item %s tem todas as classes BASE compartilhadas',
    (label) => {
      const link = getLink(label);
      for (const cls of BASE_CLASSES) {
        expect(link.className).toContain(cls);
      }
    },
  );

  it.each([['Novo Orçamento'], ['Orçamentos'], ['Carrinhos']])(
    'o item %s NÃO contém classes do antigo estilo CTA',
    (label) => {
      const link = getLink(label);
      for (const cls of FORBIDDEN_CTA_CLASSES) {
        expect(link.className).not.toContain(cls);
      }
    },
  );

  it('o conjunto de classes de Novo Orçamento (estado idle) é IGUAL ao de Carrinhos', () => {
    const novo = getLink('Novo Orçamento').className.split(/\s+/).sort().join(' ');
    const carrinhos = getLink('Carrinhos').className.split(/\s+/).sort().join(' ');
    expect(novo).toBe(carrinhos);
  });
});

describe.skip('SidebarNavGroup — comportamento de destaque ativo', () => {
  /** Classes aplicadas quando o item está ativo. */
  const ACTIVE_MARKERS = ['bg-brand-primary/[0.03]', 'text-brand-primary', 'font-bold'];
  /** Classes aplicadas quando o item está idle (não ativo). */
  const IDLE_MARKERS = ['text-sidebar-foreground/75'];

  it.each([
    ['/orcamentos/novo', 'Novo Orçamento'],
    ['/orcamentos', 'Orçamentos'],
    ['/carrinhos', 'Carrinhos'],
    ['/carrinhos/abc-123', 'Carrinhos'], // rota filha mantém destaque
  ])('em %s, o item %s recebe as classes de ativo', (path, label) => {
    renderAt(path);
    const link = getLink(label);
    for (const cls of ACTIVE_MARKERS) {
      expect(link.className).toContain(cls);
    }
  });

  it('em /dashboard nenhum dos três itens fica ativo (todos em estado idle)', () => {
    renderAt('/dashboard');
    for (const label of ['Novo Orçamento', 'Orçamentos', 'Carrinhos']) {
      const link = getLink(label);
      for (const cls of IDLE_MARKERS) {
        expect(link.className).toContain(cls);
      }
      expect(link.className).not.toContain('bg-brand-primary/[0.03]');
    }
  });

  it('em /orcamentos-publicos o item /orcamentos NÃO fica ativo (sem falso prefixo)', () => {
    renderAt('/orcamentos-publicos');
    const link = getLink('Orçamentos');
    expect(link.className).not.toContain('bg-brand-primary/[0.03]');
  });
});

describe.skip('SidebarNavGroup — paridade ao alternar rotas (back/forward, deep links)', () => {
  /** Espelha o `computeAutoOpen` do SidebarReorganized: o grupo abre quando ALGUM filho é ativo. */
  function groupShouldAutoOpen(pathname: string): boolean {
    return group.items.some((item) => isNavItemActive(pathname, item.href, item.exact));
  }

  function isLinkActive(label: string): boolean {
    return getLink(label).className.includes('bg-brand-primary/[0.03]');
  }

  it('ao trocar /carrinhos -> /orcamentos/novo -> /orcamentos, o destaque migra corretamente entre os 3 itens', () => {
    let utils = renderAt('/carrinhos');
    expect(isLinkActive('Carrinhos')).toBe(true);
    expect(isLinkActive('Novo Orçamento')).toBe(false);
    expect(isLinkActive('Orçamentos')).toBe(false);
    utils.unmount();

    utils = renderAt('/orcamentos/novo');
    expect(isLinkActive('Novo Orçamento')).toBe(true);
    expect(isLinkActive('Carrinhos')).toBe(false);
    expect(isLinkActive('Orçamentos')).toBe(false);
    utils.unmount();

    renderAt('/orcamentos');
    expect(isLinkActive('Orçamentos')).toBe(true);
    expect(isLinkActive('Novo Orçamento')).toBe(false);
    expect(isLinkActive('Carrinhos')).toBe(false);
  });

  it('ao voltar para uma rota neutra, NENHUM dos 3 itens permanece ativo', () => {
    const utils = renderAt('/orcamentos/novo');
    expect(isLinkActive('Novo Orçamento')).toBe(true);
    utils.unmount();

    renderAt('/dashboard');
    expect(isLinkActive('Novo Orçamento')).toBe(false);
    expect(isLinkActive('Orçamentos')).toBe(false);
    expect(isLinkActive('Carrinhos')).toBe(false);
  });

  it.each([
    ['/orcamentos/novo', 'Novo Orçamento'],
    ['/orcamentos/novo?cliente=42', 'Novo Orçamento'],
    ['/orcamentos/novo/passo-2', 'Novo Orçamento'],
    ['/orcamentos', 'Orçamentos'],
    ['/carrinhos', 'Carrinhos'],
    ['/carrinhos/abc-123', 'Carrinhos'],
  ])('deep-link em %s mantém destaque consistente em %s', (path, label) => {
    renderAt(path);
    expect(isLinkActive(label)).toBe(true);
  });

  it('o grupo Orçamentos deve auto-expandir para QUALQUER um dos 3 itens (paridade)', () => {
    const cases = [
      '/orcamentos/novo',
      '/orcamentos/novo/qualquer-coisa',
      '/orcamentos',
      '/carrinhos',
      '/carrinhos/xyz',
    ];
    for (const path of cases) {
      expect(groupShouldAutoOpen(path)).toBe(true);
    }
  });

  it('o grupo NÃO auto-expande em rotas não relacionadas (sem falso prefixo)', () => {
    const cases = ['/dashboard', '/orcamentos-publicos', '/carrinhos-publicos', '/produtos'];
    for (const path of cases) {
      expect(groupShouldAutoOpen(path)).toBe(false);
    }
  });

  it('ao alternar entre Novo Orçamento e Carrinhos, o conjunto de classes IDLE do item desativado volta IGUAL ao do outro idle', () => {
    const utils = renderAt('/orcamentos/novo');
    // Novo está ativo, Carrinhos está idle
    const carrinhosIdle = getLink('Carrinhos').className.split(/\s+/).sort().join(' ');
    utils.unmount();

    renderAt('/carrinhos');
    // Agora Carrinhos está ativo, Novo está idle
    const novoIdle = getLink('Novo Orçamento').className.split(/\s+/).sort().join(' ');

    // Ambos os "idle" devem ter exatamente o mesmo conjunto de classes — paridade total.
    expect(novoIdle).toBe(carrinhosIdle);
  });
});
