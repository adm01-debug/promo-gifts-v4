/**
 * Testes do botão de colapso do ConfigurationPanelV6.
 * Cobrem: toggle de visibilidade, a11y (aria-expanded/controls),
 * persistência via localStorage e preservação dos tokens de cor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigurationPanelV6 } from '../ConfigurationPanelV6';
import type { TechniqueOption } from '@/types/customization';

// Hook de preço — sem rede
vi.mock('@/hooks/simulation', () => ({
  useCustomizationPriceReactive: () => ({ price: null, loading: false, error: null }),
}));

// Supabase — sem autenticação durante os testes; sync remoto vira no-op.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      upsert: async () => ({ error: null }),
    }),
  },
}));

const technique: TechniqueOption = {
  technique_id: 'tec-1',
  technique_name: 'Serigrafia',
  codigo_tabela: 'SER-001',
  grupo_tecnica: 'Serigrafia',
  usa_dimensao: false,
  cobra_por_cor: true,
  max_cores: 3,
  efetiva_largura_max: 0,
  efetiva_altura_max: 0,
  // outros campos opcionais
} as unknown as TechniqueOption;

function renderPanel(isConfirmed = true) {
  return render(
    <ConfigurationPanelV6
      technique={technique}
      quantity={10}
      isConfirmed={isConfirmed}
      onPriceCalculated={() => {}}
    />,
  );
}

describe('ConfigurationPanelV6 — botão de colapso', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('inicia expandido e oculta o conteúdo ao clicar no toggle', () => {
    renderPanel();
    const toggle = screen.getByTestId('customization-collapse-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const region = screen.getByRole('region', { name: /configurações da gravação/i });
    expect(region).not.toHaveAttribute('hidden');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(region).toHaveAttribute('hidden');
  });

  it('vincula o botão à região via aria-controls', () => {
    renderPanel();
    const toggle = screen.getByTestId('customization-collapse-toggle');
    const region = screen.getByRole('region', { name: /configurações da gravação/i });
    expect(toggle.getAttribute('aria-controls')).toBe(region.id);
  });

  it('persiste o estado de colapso em localStorage (mapa por technique_id)', () => {
    const { unmount } = renderPanel();
    fireEvent.click(screen.getByTestId('customization-collapse-toggle'));
    const raw = window.localStorage.getItem('customization-collapsed:v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({ 'tec-1': true });

    unmount();
    renderPanel();
    expect(screen.getByTestId('customization-collapse-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('preserva tokens de cor do estado confirmado (primary)', () => {
    const { container } = renderPanel(true);
    const card = container.querySelector('.rounded-lg.border');
    expect(card?.className).toMatch(/border-primary\/30/);
    expect(card?.className).toMatch(/bg-primary\/5/);
    // Tokens NÃO devem virar success/accent acidentalmente
    expect(card?.className).not.toMatch(/border-success|bg-success|border-accent|bg-accent/);
  });
});
