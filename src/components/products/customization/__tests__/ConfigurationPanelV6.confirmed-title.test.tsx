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
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
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

  it('transiciona do skeleton para o texto sem estado intermediário vazio (sem piscadas)', () => {
    // Estado 1: carregando, sem preço → skeleton visível, sem título
    hookState.price = null;
    hookState.loading = true;
    const { rerender } = renderPanel();

    const header = screen.getByTestId('customization-confirmed-header');
    expect(screen.getByTestId('customization-confirmed-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('customization-confirmed-title')).not.toBeInTheDocument();
    // Cabeçalho sempre tem conteúdo (ícone + skeleton), nunca colapsa a altura
    expect(header.children.length).toBeGreaterThan(0);

    // Estado 2: preço chega → skeleton some, título aparece na MESMA render
    hookState.price = { nome_tabela: 'FIBER LASER | PLANA' };
    hookState.loading = false;
    rerender(
      <ConfigurationPanelV6
        technique={technique}
        quantity={10}
        isConfirmed
        onPriceCalculated={() => {}}
      />,
    );

    expect(screen.queryByTestId('customization-confirmed-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('customization-confirmed-title')).toHaveTextContent(
      'Fiber Laser | Plana',
    );
    // O cabeçalho permanece montado durante toda a transição
    expect(screen.getByTestId('customization-confirmed-header')).toBe(header);
  });
});
