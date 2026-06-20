/**
 * Comportamento dos tooltips: aparecem ao passar o mouse e somem ao sair.
 * Cobre itens públicos, admin-only e dev-only — todos com tooltip declarado.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, UNSAFE_DataRouterContext } from 'react-router-dom';
import {
  Plus,
  FileText,
  ShoppingCart,
  ShieldCheck,
  Users,
  FolderOpen,
  Package,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarNavGroup, type NavGroup } from '../SidebarNavGroup';

void UNSAFE_DataRouterContext; // garante import válido (silencia tree-shake)

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

// Radix Tooltip usa PointerEvent — jsdom não implementa nativamente.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    // @ts-expect-error jsdom shim
    window.PointerEvent = class extends MouseEvent {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
});

const FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

const PUBLIC_TOOLTIPS = {
  'Novo Orçamento': 'Monte uma proposta em poucos cliques e envie para o cliente.',
  Orçamentos: 'Acompanhe propostas abertas, aprovadas e em negociação.',
  Carrinhos: 'Retome carrinhos salvos e converta em orçamento sem perder tempo.',
};

const ADMIN_TOOLTIPS = {
  Usuários: 'Gerencie a equipe: cadastre vendedores e defina permissões.',
  Segurança: 'Controle acessos e proteja os dados sensíveis dos seus clientes.',
};

function makeGroup(): NavGroup {
  return {
    id: 'mixed',
    label: 'Mixed',
    icon: FileText,
    defaultOpen: true,
    items: [
      {
        icon: Plus,
        label: 'Novo Orçamento',
        href: '/orcamentos/novo',
        tooltip: PUBLIC_TOOLTIPS['Novo Orçamento'],
      },
      {
        icon: FileText,
        label: 'Orçamentos',
        href: '/orcamentos',
        exact: true,
        tooltip: PUBLIC_TOOLTIPS['Orçamentos'],
      },
      {
        icon: ShoppingCart,
        label: 'Carrinhos',
        href: '/carrinhos',
        tooltip: PUBLIC_TOOLTIPS.Carrinhos,
      },
      {
        icon: Users,
        label: 'Usuários',
        href: '/admin/usuarios',
        adminOnly: true,
        tooltip: ADMIN_TOOLTIPS['Usuários'],
      },
      {
        icon: ShieldCheck,
        label: 'Segurança',
        href: '/admin/seguranca',
        devOnly: true,
        tooltip: ADMIN_TOOLTIPS['Segurança'],
      },
      {
        icon: FolderOpen,
        label: 'Cadastros',
        href: '/admin/cadastros',
        adminOnly: true,
        tooltip: 'Mantenha produtos, fornecedores e gravações sempre atualizados.',
        children: [
          {
            icon: Package,
            label: 'Produtos',
            href: '/admin/cadastros?tab=products',
            tooltip: 'Cadastre e edite os produtos do catálogo de vendas.',
          },
        ],
      },
    ],
  };
}

function renderGroup() {
  return render(
    <MemoryRouter initialEntries={['/']} future={FUTURE_FLAGS}>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <SidebarNavGroup
          group={makeGroup()}
          isOpen
          isCollapsed={false}
          onToggle={() => {}}
          onMobileClose={() => {}}
          isMobileSidebarOpen={false}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

const ALL_TOOLTIPS: Record<string, string> = {
  ...PUBLIC_TOOLTIPS,
  ...ADMIN_TOOLTIPS,
};

describe('SidebarNavGroup — tooltips on hover (público + admin/dev)', () => {
  it.each(Object.entries(ALL_TOOLTIPS))(
    'mostra tooltip ao passar o mouse em "%s" e fecha ao pressionar Escape',
    async (label, message) => {
      const user = userEvent.setup();
      renderGroup();

      const link = screen.getByRole('link', { name: new RegExp(label, 'i') });

      expect(screen.queryByRole('tooltip', { name: message })).not.toBeInTheDocument();

      await user.hover(link);
      await waitFor(() => {
        expect(screen.getByRole('tooltip', { name: message })).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('tooltip', { name: message })).not.toBeInTheDocument();
      });
    },
  );

  it('item-pai com children (Cadastros) também exibe tooltip ao hover', async () => {
    const user = userEvent.setup();
    renderGroup();

    const parentBtn = screen.getByRole('button', { name: /expandir cadastros/i });
    const msg = 'Mantenha produtos, fornecedores e gravações sempre atualizados.';

    expect(screen.queryByRole('tooltip', { name: msg })).not.toBeInTheDocument();

    await user.hover(parentBtn);
    await waitFor(() => {
      expect(screen.getByRole('tooltip', { name: msg })).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { name: msg })).not.toBeInTheDocument();
    });
  });
});
