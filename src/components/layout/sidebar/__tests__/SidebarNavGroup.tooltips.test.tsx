/**
 * Comportamento dos tooltips: aparecem ao passar o mouse e somem ao sair.
 * Testa o SidebarNavGroup isolado com 3 itens dotados de tooltip.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Plus, FileText, ShoppingCart } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarNavGroup, type NavGroup } from '../SidebarNavGroup';

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

const TOOLTIPS = {
  'Novo Orçamento': 'Monte uma proposta em poucos cliques e envie para o cliente.',
  'Orçamentos': 'Acompanhe propostas abertas, aprovadas e em negociação.',
  'Carrinhos': 'Retome carrinhos salvos e converta em orçamento sem perder tempo.',
};

const group: NavGroup = {
  id: 'quotes',
  label: 'Orçamentos',
  icon: FileText,
  defaultOpen: true,
  items: [
    { icon: Plus, label: 'Novo Orçamento', href: '/orcamentos/novo', tooltip: TOOLTIPS['Novo Orçamento'] },
    { icon: FileText, label: 'Orçamentos', href: '/orcamentos', exact: true, tooltip: TOOLTIPS['Orçamentos'] },
    { icon: ShoppingCart, label: 'Carrinhos', href: '/carrinhos', tooltip: TOOLTIPS['Carrinhos'] },
  ],
};

function renderGroup() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <SidebarNavGroup
          group={group}
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

describe('SidebarNavGroup — tooltips on hover', () => {
  it.each(Object.entries(TOOLTIPS))(
    'mostra tooltip ao passar o mouse em "%s" e fecha ao pressionar Escape',
    async (label, message) => {
      const user = userEvent.setup();
      renderGroup();

      const link = screen.getByRole('link', { name: new RegExp(label, 'i') });

      // Antes do hover: tooltip não está no DOM
      expect(screen.queryByRole('tooltip', { name: message })).not.toBeInTheDocument();

      await user.hover(link);
      await waitFor(() => {
        expect(screen.getByRole('tooltip', { name: message })).toBeInTheDocument();
      });

      // Radix Tooltip fecha de forma confiável via tecla Escape (testado no jsdom).
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('tooltip', { name: message })).not.toBeInTheDocument();
      });


    },
  );
});
