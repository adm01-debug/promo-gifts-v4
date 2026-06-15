/**
 * Testes de visibilidade — `ProductStatusBadge` × `useBadgeVisibilityStore`.
 *
 * Garante que:
 *  - `type="urgency"` com `urgencyType="limited-stock"` (badge "Estoque baixo")
 *    RESPEITA o toggle global de badges (igual a out-of-stock/featured/...);
 *  - As demais urgências contextuais (`trending`, `ending-soon`) permanecem
 *    SEMPRE visíveis, mesmo com badges desligadas.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductStatusBadge } from '../ProductStatusBadge';
import { useBadgeVisibilityStore } from '@/stores/useBadgeVisibilityStore';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>
    <BrowserRouter>{children}</BrowserRouter>
  </TooltipProvider>
);

function setBadgesEnabled(enabled: boolean) {
  useBadgeVisibilityStore.setState({ routeSettings: {}, badgesEnabled: enabled });
}

describe('ProductStatusBadge — toggle global de badges', () => {
  beforeEach(() => {
    cleanup();
    setBadgesEnabled(true);
  });

  it('renderiza "Estoque baixo" (urgency/limited-stock) quando badges ligadas', () => {
    setBadgesEnabled(true);
    render(
      <Wrapper>
        <ProductStatusBadge type="urgency" urgencyType="limited-stock" value="Estoque baixo" />
      </Wrapper>,
    );
    expect(screen.getByText(/Estoque baixo/i)).toBeInTheDocument();
  });

  it('OCULTA "Estoque baixo" (urgency/limited-stock) quando badges desligadas', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="urgency" urgencyType="limited-stock" value="Estoque baixo" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Estoque baixo/i)).not.toBeInTheDocument();
  });

  it('mantém urgência "trending" visível mesmo com badges desligadas', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="urgency" urgencyType="trending" value="Em alta" />
      </Wrapper>,
    );
    expect(screen.getByText(/Em alta/i)).toBeInTheDocument();
  });

  it('mantém urgência "ending-soon" visível mesmo com badges desligadas', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="urgency" urgencyType="ending-soon" value="Última chance" />
      </Wrapper>,
    );
    expect(screen.getByText(/Última chance/i)).toBeInTheDocument();
  });

  it('OCULTA out-of-stock quando badges desligadas (comportamento já existente)', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="out-of-stock" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Estoque zerado/i)).not.toBeInTheDocument();
  });
});
