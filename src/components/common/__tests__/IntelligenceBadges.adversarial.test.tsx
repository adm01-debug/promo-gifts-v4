/**
 * BATERIA ADVERSARIAL — IntelligenceBadges × useBadgeVisibilityStore
 *
 * Cobre exaustivamente o comportamento do toggle "Etiquetas dos Produtos"
 * para todos os 9 badge types do sistema de inteligência de mercado.
 *
 * fix_version: badge-toggle-v2
 * Nota: o componente renderiza `{badge.icon} {badge.label}` — texto completo
 * inclui o emoji. Usamos data-testid para verificação robusta.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IntelligenceBadges } from '@/components/common/IntelligenceBadges';
import { useBadgeVisibilityStore } from '@/stores/useBadgeVisibilityStore';
import type { IntelligenceBadge } from '@/hooks/products';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>
    <BrowserRouter>{children}</BrowserRouter>
  </TooltipProvider>
);

function setState(opts: {
  enabled: boolean;
  routeSettings?: Record<string, { light: boolean; dark: boolean }>;
}) {
  useBadgeVisibilityStore.setState({
    badgesEnabled: opts.enabled,
    routeSettings: opts.routeSettings ?? {},
  });
}

const ALL_BADGE_TYPES: IntelligenceBadge['type'][] = [
  'featured',
  'new-arrival',
  'hot-item',
  'emerging',
  'declining',
  'frequent-restock',
  'last-units',
  'best-seller',
  'class-a',
];

const makeB = (type: IntelligenceBadge['type']): IntelligenceBadge => ({
  type,
  label: `Label-${type}`,
  icon: '🔥',
  description: `Desc-${type}`,
});

// ─────────────────────────────────────────────────────────────
// GRUPO A: Toggle OFF → container inteiro não é montado (return null)
// Verificação por ausência do data-testid
// ─────────────────────────────────────────────────────────────
describe('[A] Toggle OFF — TODOS os 9 tipos desaparecem (data-testid)', () => {
  beforeEach(() => {
    cleanup();
    setState({ enabled: false });
  });

  it.each(ALL_BADGE_TYPES)('OCULTA type="%s" quando toggle OFF', (type) => {
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB(type)]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId(`intelligence-badge-${type}`)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO B: Toggle ON → data-testid presente para todos os tipos
// ─────────────────────────────────────────────────────────────
describe('[B] Toggle ON — TODOS os 9 tipos visíveis (data-testid)', () => {
  beforeEach(() => {
    cleanup();
    setState({ enabled: true });
  });

  it.each(ALL_BADGE_TYPES)('EXIBE type="%s" quando toggle ON', (type) => {
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB(type)]} />
      </Wrapper>,
    );
    expect(screen.getByTestId(`intelligence-badge-${type}`)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO C: Array vazio — null invariante
// ─────────────────────────────────────────────────────────────
describe('[C] Array vazio — render null invariante', () => {
  it('toggle ON + badges[] vazio → container null', () => {
    cleanup();
    setState({ enabled: true });
    const { container } = render(
      <Wrapper>
        <IntelligenceBadges badges={[]} />
      </Wrapper>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('toggle OFF + badges[] vazio → container null', () => {
    cleanup();
    setState({ enabled: false });
    const { container } = render(
      <Wrapper>
        <IntelligenceBadges badges={[]} />
      </Wrapper>,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO D: Múltiplos badges simultâneos
// ─────────────────────────────────────────────────────────────
describe('[D] Múltiplos badges simultâneos', () => {
  it('ON → hot-item + best-seller ambos presentes', () => {
    cleanup();
    setState({ enabled: true });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item'), makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-hot-item')).toBeInTheDocument();
    expect(screen.getByTestId('intelligence-badge-best-seller')).toBeInTheDocument();
  });

  it('OFF → hot-item + best-seller ambos ausentes', () => {
    cleanup();
    setState({ enabled: false });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item'), makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('intelligence-badge-hot-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intelligence-badge-best-seller')).not.toBeInTheDocument();
  });

  it('ON → todos os 9 types renderizados simultaneamente', () => {
    cleanup();
    setState({ enabled: true });
    render(
      <Wrapper>
        <IntelligenceBadges badges={ALL_BADGE_TYPES.map(makeB)} />
      </Wrapper>,
    );
    for (const type of ALL_BADGE_TYPES) {
      expect(screen.getByTestId(`intelligence-badge-${type}`)).toBeInTheDocument();
    }
  });

  it('OFF → nenhum dos 9 types renderizado', () => {
    cleanup();
    setState({ enabled: false });
    render(
      <Wrapper>
        <IntelligenceBadges badges={ALL_BADGE_TYPES.map(makeB)} />
      </Wrapper>,
    );
    for (const type of ALL_BADGE_TYPES) {
      expect(screen.queryByTestId(`intelligence-badge-${type}`)).not.toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO E: turnoverScore e isDemo não vazam com toggle OFF
// O return null ocorre ANTES de renderizar qualquer filho
// ─────────────────────────────────────────────────────────────
describe('[E] turnoverScore + isDemo não vazam com toggle OFF', () => {
  it('turnoverScore não aparece quando toggle OFF', () => {
    cleanup();
    setState({ enabled: false });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} turnoverScore={85} />
      </Wrapper>,
    );
    expect(screen.queryByText(/Potencial/i)).not.toBeInTheDocument();
  });

  it('isDemo chip não aparece quando toggle OFF', () => {
    cleanup();
    setState({ enabled: false });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} isDemo />
      </Wrapper>,
    );
    expect(screen.queryByText(/dados ilustrativos/i)).not.toBeInTheDocument();
  });

  it('turnoverScore APARECE quando toggle ON', () => {
    cleanup();
    setState({ enabled: true });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} turnoverScore={90} />
      </Wrapper>,
    );
    expect(screen.getByText(/Potencial: 90/i)).toBeInTheDocument();
  });

  it('isDemo chip APARECE quando toggle ON', () => {
    cleanup();
    setState({ enabled: true });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} isDemo />
      </Wrapper>,
    );
    expect(screen.getByText(/dados ilustrativos/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO F: Cycling ON→OFF→ON
// ─────────────────────────────────────────────────────────────
describe('[F] Cycling do toggle ON→OFF→ON', () => {
  it('hot-item: aparece → desaparece → reaparece', () => {
    cleanup();
    setState({ enabled: true });
    const { rerender } = render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-hot-item')).toBeInTheDocument();

    setState({ enabled: false });
    rerender(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('intelligence-badge-hot-item')).not.toBeInTheDocument();

    setState({ enabled: true });
    rerender(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-hot-item')).toBeInTheDocument();
  });

  it('best-seller: aparece → desaparece → reaparece', () => {
    cleanup();
    setState({ enabled: true });
    const { rerender } = render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-best-seller')).toBeInTheDocument();

    setState({ enabled: false });
    rerender(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('intelligence-badge-best-seller')).not.toBeInTheDocument();

    setState({ enabled: true });
    rerender(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-best-seller')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO G: className forwarding quando toggle ON
// ─────────────────────────────────────────────────────────────
describe('[G] className prop forwarding', () => {
  it('classe custom aplicada ao container quando toggle ON', () => {
    cleanup();
    setState({ enabled: true });
    const { container } = render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} className="minha-classe gap-1.5" />
      </Wrapper>,
    );
    expect(container.querySelector('.minha-classe')).not.toBeNull();
  });

  it('classe custom NÃO presente quando toggle OFF (return null)', () => {
    cleanup();
    setState({ enabled: false });
    const { container } = render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} className="minha-classe gap-1.5" />
      </Wrapper>,
    );
    expect(container.querySelector('.minha-classe')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// GRUPO H: Regressão — hot-item e best-seller eram o caso crítico
// (antes do PR #1524 apareciam mesmo com toggle OFF)
// ─────────────────────────────────────────────────────────────
describe('[H] Regressão PR #1524 — hot-item + best-seller', () => {
  it('[REGRESSÃO] hot-item respeita toggle OFF (era bug antes #1524)', () => {
    cleanup();
    setState({ enabled: false });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('intelligence-badge-hot-item')).not.toBeInTheDocument();
  });

  it('[REGRESSÃO] best-seller respeita toggle OFF (era bug antes #1524)', () => {
    cleanup();
    setState({ enabled: false });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('intelligence-badge-best-seller')).not.toBeInTheDocument();
  });

  it('[REGRESSÃO] hot-item ainda visível quando toggle ON', () => {
    cleanup();
    setState({ enabled: true });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('hot-item')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-hot-item')).toBeInTheDocument();
  });

  it('[REGRESSÃO] best-seller ainda visível quando toggle ON', () => {
    cleanup();
    setState({ enabled: true });
    render(
      <Wrapper>
        <IntelligenceBadges badges={[makeB('best-seller')]} />
      </Wrapper>,
    );
    expect(screen.getByTestId('intelligence-badge-best-seller')).toBeInTheDocument();
  });
});
