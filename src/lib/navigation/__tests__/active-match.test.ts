import { describe, it, expect } from 'vitest';
import { isNavItemActive } from '@/lib/navigation/active-match';

// Mirror of the real sidebar config for the routes under test.
// Keep in sync with src/components/layout/SidebarReorganized.tsx.
const quotesGroupItems = [
  { href: '/orcamentos/novo' },
  { href: '/orcamentos', exact: true as const },
  { href: '/carrinhos' },
];

describe('isNavItemActive', () => {
  describe('"Carrinhos" (/carrinhos, prefix match)', () => {
    it('highlights on the exact /carrinhos route', () => {
      expect(isNavItemActive('/carrinhos', '/carrinhos')).toBe(true);
    });

    it('highlights on child routes /carrinhos/:id', () => {
      expect(isNavItemActive('/carrinhos/abc-123', '/carrinhos')).toBe(true);
    });

    it('highlights on deep child routes /carrinhos/:id/editar', () => {
      expect(isNavItemActive('/carrinhos/abc-123/editar', '/carrinhos')).toBe(true);
    });

    it('does NOT highlight on unrelated routes', () => {
      expect(isNavItemActive('/orcamentos', '/carrinhos')).toBe(false);
      expect(isNavItemActive('/', '/carrinhos')).toBe(false);
    });

    it('does NOT match a sibling whose name starts with the same prefix', () => {
      // Regression: "/carrinhos-publicos" must not activate "/carrinhos"
      expect(isNavItemActive('/carrinhos-publicos', '/carrinhos')).toBe(false);
    });
  });

  describe('"Orçamentos" (/orcamentos, exact)', () => {
    it('highlights only on the exact /orcamentos route', () => {
      expect(isNavItemActive('/orcamentos', '/orcamentos', true)).toBe(true);
    });

    it('does NOT highlight on /orcamentos/novo when exact', () => {
      expect(isNavItemActive('/orcamentos/novo', '/orcamentos', true)).toBe(false);
    });

    it('does NOT highlight on /carrinhos', () => {
      expect(isNavItemActive('/carrinhos', '/orcamentos', true)).toBe(false);
    });
  });

  describe('Root item "/" (special-cased)', () => {
    it('highlights only on the exact root', () => {
      expect(isNavItemActive('/', '/')).toBe(true);
    });

    it('does NOT highlight on any non-root path', () => {
      expect(isNavItemActive('/carrinhos', '/')).toBe(false);
      expect(isNavItemActive('/orcamentos', '/')).toBe(false);
    });
  });
});

describe('"Orçamentos" group auto-open behavior', () => {
  // Replicates the rule used by SidebarReorganized:
  //   group is open when ANY item is active for the current pathname.
  const isGroupOpen = (pathname: string) =>
    quotesGroupItems.some((item) =>
      isNavItemActive(pathname, item.href, 'exact' in item ? item.exact : undefined),
    );

  it('opens the Orçamentos group on /carrinhos', () => {
    expect(isGroupOpen('/carrinhos')).toBe(true);
  });

  it('opens the Orçamentos group on /carrinhos/:id (child routes)', () => {
    expect(isGroupOpen('/carrinhos/abc-123')).toBe(true);
  });

  it('opens the Orçamentos group on /orcamentos', () => {
    expect(isGroupOpen('/orcamentos')).toBe(true);
  });

  it('opens the Orçamentos group on /orcamentos/novo', () => {
    expect(isGroupOpen('/orcamentos/novo')).toBe(true);
  });

  it('does NOT open the Orçamentos group on unrelated routes', () => {
    expect(isGroupOpen('/')).toBe(false);
    expect(isGroupOpen('/favoritos')).toBe(false);
    expect(isGroupOpen('/admin/usuarios')).toBe(false);
  });

  it('does NOT open the group when pathname only shares a prefix', () => {
    // Regression: "/carrinhos-publicos" or "/orcamentos-publicos" must NOT
    // open the Orçamentos group.
    expect(isGroupOpen('/carrinhos-publicos')).toBe(false);
    expect(isGroupOpen('/orcamentos-publicos')).toBe(false);
  });
});

describe('toggleGroup behavior (Radix-driven)', () => {
  // Replicates the toggleGroup reducer in SidebarReorganized: it must trust
  // the boolean Radix sends instead of inverting the previous state.
  const toggleGroup = (
    prev: Record<string, boolean>,
    groupId: string,
    next: boolean,
  ): Record<string, boolean> => (prev[groupId] === next ? prev : { ...prev, [groupId]: next });

  it('opens a closed group when Radix says open=true', () => {
    const out = toggleGroup({ quotes: false }, 'quotes', true);
    expect(out.quotes).toBe(true);
  });

  it('closes an open group when Radix says open=false', () => {
    const out = toggleGroup({ quotes: true }, 'quotes', false);
    expect(out.quotes).toBe(false);
  });

  it('is idempotent: re-emitting the same state returns the same reference', () => {
    // Regression: the old "invert" implementation would flip the group
    // closed if Radix re-fired onOpenChange(true) while already true.
    const prev = { quotes: true };
    const out = toggleGroup(prev, 'quotes', true);
    expect(out).toBe(prev);
    expect(out.quotes).toBe(true);
  });

  it('does not affect other groups', () => {
    const out = toggleGroup({ quotes: true, catalog: true }, 'quotes', false);
    expect(out).toEqual({ quotes: false, catalog: true });
  });
});
