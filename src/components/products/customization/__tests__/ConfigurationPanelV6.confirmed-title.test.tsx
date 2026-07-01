/**
 * Cabeçalho da gravação confirmada em ConfigurationPanelV6:
 *  - exibe `price.nome_tabela` (formatado) quando disponível
 *  - cai para `technique.name` / `technique.technique_name` quando não
 *  - mostra skeleton enquanto o preço está carregando
 *  - permite trocar o ícone de check via prop `confirmedIcon`
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigurationPanelV6 } from '../ConfigurationPanelV6';
import type { TechniqueOption } from '@/types/customization';

const hookState: { price: unknown; loading: boolean; error: unknown } = {
  price: null,
  loading: false,
  error: null,
};

vi.mock('@/hooks/simulation', () => ({
  useCustomizationPriceReactive: () => hookState,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      upsert: async () => ({ error: null }),
    }),
  },
}));

const technique = {
  technique_id: 'tec-1',
  technique_name: 'fiber laser',
  name: 'fiber laser',
  codigo_tabela: 'FL-001',
  grupo_tecnica: 'Laser',
  usa_dimensao: false,
  cobra_por_cor: false,
  max_cores: 1,
  efetiva_largura_max: 0,
  efetiva_altura_max: 0,
} as unknown as TechniqueOption;

function renderPanel(extra: Partial<React.ComponentProps<typeof ConfigurationPanelV6>> = {}) {
  return render(
    <ConfigurationPanelV6
      technique={technique}
      quantity={10}
      isConfirmed
      onPriceCalculated={() => {}}
      {...extra}
    />,
  );
}

describe('ConfigurationPanelV6 — cabeçalho da gravação confirmada', () => {
  it('exibe price.nome_tabela formatado quando disponível', () => {
    hookState.price = { nome_tabela: 'FIBER LASER | PLANA' };
    hookState.loading = false;
    renderPanel();
    expect(screen.getByTestId('customization-confirmed-title')).toHaveTextContent(
      'Fiber Laser | Plana',
    );
  });

  it('usa fallback do technique.name quando price.nome_tabela está vazio', () => {
    hookState.price = { nome_tabela: '' };
    hookState.loading = false;
    renderPanel();
    expect(screen.getByTestId('customization-confirmed-title')).toHaveTextContent('Fiber Laser');
  });

  it('mostra skeleton enquanto o preço carrega e ainda não há nome_tabela', () => {
    hookState.price = null;
    hookState.loading = true;
    renderPanel();
    expect(screen.getByTestId('customization-confirmed-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('customization-confirmed-title')).not.toBeInTheDocument();
  });

  it('permite trocar o ícone de check via prop confirmedIcon', () => {
    hookState.price = { nome_tabela: 'Fiber Laser' };
    hookState.loading = false;
    renderPanel({
      confirmedIcon: <span data-testid="custom-icon">★</span>,
    });
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('oculta o ícone quando confirmedIcon={null}', () => {
    hookState.price = { nome_tabela: 'Fiber Laser' };
    hookState.loading = false;
    renderPanel({ confirmedIcon: null });
    const header = screen.getByTestId('customization-confirmed-header');
    // Nenhum ícone SVG ou span custom antes do título
    expect(header.querySelector('svg')).toBeNull();
  });
});
