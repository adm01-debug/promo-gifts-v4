/**
 * Testes de visibilidade — `ProductStatusBadge` × `useBadgeVisibilityStore`.
 *
 * Garante que TODOS os badge types — incluindo urgência contextual (trending,
 * ending-soon) — são ocultados quando o toggle "Etiquetas dos Produtos" está
 * desligado.
 *
 * fix_version: badge-toggle-v2 — cobertura total de urgency badges
 * Badges de fornecedor, categoria e cores ficam sempre visíveis (renderizados
 * por outros componentes, não passam por ProductStatusBadge).
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

  it('OCULTA urgência "trending" quando badges desligadas (badge-toggle-v2)', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="urgency" urgencyType="trending" value="Em alta" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Em alta/i)).not.toBeInTheDocument();
  });

  it('OCULTA urgência "ending-soon" quando badges desligadas (badge-toggle-v2)', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="urgency" urgencyType="ending-soon" value="Última chance" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Última chance/i)).not.toBeInTheDocument();
  });

  it('OCULTA out-of-stock quando badges desligadas', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="out-of-stock" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Estoque zerado/i)).not.toBeInTheDocument();
  });

  it('OCULTA featured quando badges desligadas', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="featured" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Destaque/i)).not.toBeInTheDocument();
  });

  it('OCULTA packaging quando badges desligadas', () => {
    setBadgesEnabled(false);
    render(
      <Wrapper>
        <ProductStatusBadge type="packaging" value="Embalagem" />
      </Wrapper>,
    );
    expect(screen.queryByText(/Embalagem/i)).not.toBeInTheDocument();
  });

  it('renderiza featured normalmente quando badges ligadas', () => {
    setBadgesEnabled(true);
    render(
      <Wrapper>
        <ProductStatusBadge type="featured" />
      </Wrapper>,
    );
    expect(screen.getByText(/Destaque/i)).toBeInTheDocument();
  });
});
