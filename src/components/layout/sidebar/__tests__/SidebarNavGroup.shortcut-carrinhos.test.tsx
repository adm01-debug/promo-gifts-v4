/**
 * Garante paridade do atalho **Alt+R** para "Carrinhos" com os atalhos
 * Alt+N (Novo Orçamento) e Alt+O (Orçamentos).
 *
 * Cobre:
 *  1. Navegação por atalho (Alt+R → /carrinhos).
 *  2. Guard contra inputs/textarea/contentEditable.
 *  3. Guard contra modificadores Ctrl/Meta combinados.
 *  4. preventDefault disparado quando o atalho navega.
 *  5. Hint visual "Alt+R" renderizado no item Carrinhos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Plus, FileText, ShoppingCart } from 'lucide-react';
import { type NavGroup, SidebarNavGroup } from '../SidebarNavGroup';

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
 * Reproduz o handler de atalhos da sidebar (SidebarReorganized.tsx, linhas
 * 215-238). Mantido fiel ao original para detectar regressões.
 */
function buildShortcutHandler(navigate: (href: string) => void) {
  const shortcutMap: Record<string, string> = {};
  group.items.forEach((item) => {
    if (item.shortcut) {
      const key = item.shortcut.replace('Alt+', '').toLowerCase();
      shortcutMap[key] = item.href;
    }
  });

  return (e: KeyboardEvent) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;
      const href = shortcutMap[e.key.toLowerCase()];
      if (href) {
        e.preventDefault();
        navigate(href);
      }
    }
  };
}

describe('Sidebar shortcut: Alt+R → /carrinhos', () => {
  let navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
  let handler: (e: KeyboardEvent) => void;

  beforeEach(() => {
    navigate = vi.fn<(href: string) => void>();
    handler = buildShortcutHandler(navigate);
    window.addEventListener('keydown', handler);
  });

  afterEach(() => {
    window.removeEventListener('keydown', handler);
  });

  it('navega para /carrinhos quando o usuário pressiona Alt+R', () => {
    fireEvent.keyDown(window, { key: 'r', altKey: true });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/carrinhos');
  });

  it('aceita Alt+R com tecla maiúscula (case-insensitive)', () => {
    fireEvent.keyDown(window, { key: 'R', altKey: true });
    expect(navigate).toHaveBeenCalledWith('/carrinhos');
  });

  it('dispara preventDefault quando o atalho navega', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'r',
      altKey: true,
      cancelable: true,
      bubbles: true,
    });
    const spy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/carrinhos');
  });

  it('ignora Alt+R quando o foco está em um <input>', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'r', altKey: true });
    expect(navigate).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('ignora Alt+R quando o foco está em um <textarea>', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    fireEvent.keyDown(ta, { key: 'r', altKey: true });
    expect(navigate).not.toHaveBeenCalled();

    document.body.removeChild(ta);
  });

  it('ignora Alt+R quando o foco está em um elemento contentEditable', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom não calcula `isContentEditable` a partir do atributo — força a
    // propriedade para refletir a guarda real do handler em produção.
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    document.body.appendChild(div);
    div.focus();

    fireEvent.keyDown(div, { key: 'r', altKey: true });
    expect(navigate).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it('não navega com Alt+Ctrl+R (modificador extra)', () => {
    fireEvent.keyDown(window, { key: 'r', altKey: true, ctrlKey: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('não navega com Alt+Meta+R (modificador extra)', () => {
    fireEvent.keyDown(window, { key: 'r', altKey: true, metaKey: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('não navega quando Alt não está pressionado', () => {
    fireEvent.keyDown(window, { key: 'r' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('não navega para Alt+<tecla desconhecida>', () => {
    fireEvent.keyDown(window, { key: 'z', altKey: true });
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Sidebar shortcut: hint visual de Alt+R', () => {
  it("renderiza o hint 'Alt+R' próximo ao item Carrinhos (paridade com Alt+N e Alt+O)", () => {
    render(
      <MemoryRouter initialEntries={['/carrinhos']}>
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

    // Os 3 hints devem estar presentes — paridade total entre os itens do grupo.
    expect(screen.getAllByText('Alt+N').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alt+O').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alt+R').length).toBeGreaterThan(0);
  });
});
