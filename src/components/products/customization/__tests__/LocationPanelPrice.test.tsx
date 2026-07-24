/* eslint-disable @typescript-eslint/require-await */
/**
 * LocationPanel — Avançado: Validação de Preço, Clamp e Persistência
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LocationPanel } from '../LocationPanel';
import type {
  GravacaoLocation,
  TechniqueOption,
  CustomizationPriceResponseV6,
} from '@/types/customization';

// Mock do ConfigurationPanelV6 corrigido para usar hooks dentro do componente
vi.mock('../ConfigurationPanelV6', () => ({
  ConfigurationPanelV6: (props: {
    technique: TechniqueOption;
    initialWidth?: number;
    initialHeight?: number;
    initialColors?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onPriceCalculated?: (tid: string, p: CustomizationPriceResponseV6 | null, dims?: any) => void;
    onDimensionsChange?: (d: { width?: number; height?: number; colors?: number }) => void;
  }) => {
    // Lógica de preço simulada:
    // tech-A (Silk): 1.5 por unidade + 50 setup
    // tech-B (Transfer): 2.5 por unidade + 100 setup
    const isTechA = props.technique.technique_id === 'tech-A';
    const unitPrice = isTechA ? 1.5 : 2.5;
    const setup = isTechA ? 50 : 100;

    // Simula impacto de cores se a técnica cobra por cor
    const colorMultiplier = props.technique.cobra_por_cor ? props.initialColors || 1 : 1;

    const mockPrice: CustomizationPriceResponseV6 = {
      success: true,
      preco_unitario: unitPrice * colorMultiplier,
      setup_total: setup,
      total_cobrado: unitPrice * colorMultiplier * 100 + setup, // Assumindo quantity 100
    };

    // Usar useEffect corretamente dentro do corpo do componente mock
    React.useEffect(() => {
      props.onPriceCalculated?.(props.technique.technique_id, mockPrice, {
        width: props.initialWidth,
        height: props.initialHeight,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      props.technique.technique_id,
      props.initialWidth,
      props.initialHeight,
      props.initialColors,
    ]);

    return (
      <div
        data-testid="config-panel"
        data-technique-id={props.technique.technique_id}
        data-initial-width={props.initialWidth ?? ''}
        data-initial-height={props.initialHeight ?? ''}
        data-initial-colors={props.initialColors ?? ''}
      >
        <div data-testid="total-price-display">{mockPrice.total_cobrado}</div>
        <button
          type="button"
          data-testid="emit-dims"
          onClick={() => props.onDimensionsChange?.({ width: 7, height: 4, colors: 2 })}
        >
          emit 7x4 c2
        </button>
      </div>
    );
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeTechnique(over: Partial<TechniqueOption> = {}): TechniqueOption {
  return {
    technique_id: 'tech-1',
    codigo_tabela: 'SILK-01',
    tecnica_nome: 'Técnica Teste',
    grupo_tecnica: 'TESTE',
    variacao_label: 'padrão',
    max_width: 10,
    max_height: 10,
    gravacao_largura_max: 10,
    gravacao_altura_max: 10,
    efetiva_largura_max: 10,
    efetiva_altura_max: 10,
    shape: 'rectangle',
    is_curved: false,
    usa_dimensao: true,
    cobra_por_cor: false,
    max_cores: 1,
    ...over,
  };
}

const techA = makeTechnique({
  technique_id: 'tech-A',
  tecnica_nome: 'Silk 1 cor',
  cobra_por_cor: false,
  max_cores: 1,
});

const techB = makeTechnique({
  technique_id: 'tech-B',
  tecnica_nome: 'Transfer Digital',
  cobra_por_cor: true,
  max_cores: 4,
});

const techSmall = makeTechnique({
  technique_id: 'tech-small',
  tecnica_nome: 'Laser pequeno',
  efetiva_largura_max: 5,
  efetiva_altura_max: 3,
  usa_dimensao: true,
});

const location: GravacaoLocation = {
  location_code: 'LADO-A',
  location_name: 'Lado A',
  location_order: 1,
  options: [techA, techB, techSmall],
};

describe('LocationPanel — Validação de Preço e Clamp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('totalPrice muda corretamente ao trocar de técnica usando dimensões já digitadas', async () => {
    const onPrice = vi.fn();
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={onPrice} />);

    // 1. Seleciona Tech A e emite dimensões
    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    // Aguarda preço A ser reportado
    await waitFor(() => {
      expect(onPrice).toHaveBeenCalledWith(
        expect.any(String),
        'tech-A',
        expect.objectContaining({ total_cobrado: 200 }),
        expect.any(Object),
      );
    });

    // 2. Troca para Tech B
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );

    // Preço B: (2.5 * 2 cores * 100) + 100 = 600
    await waitFor(() => {
      expect(onPrice).toHaveBeenCalledWith(
        expect.any(String),
        'tech-B',
        expect.objectContaining({ total_cobrado: 600 }),
        expect.any(Object),
      );
    });
    expect(screen.getByTestId('total-price-display')).toHaveTextContent('600');
  });

  it('exibe Alert e recalcula preço imediatamente quando técnica força clamp de dimensões', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    // 1. Tech A com 7x4
    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    // 2. Troca para techSmall (5x3)
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Laser pequeno'),
    );

    // 3. Verifica Alert e clamp
    expect(screen.getByTestId('clamp-notice')).toBeInTheDocument();
    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-initial-width', '5');
    expect(panel).toHaveAttribute('data-initial-height', '3');
  });

  it('técnicas com cobra_por_cor=false limpam/ignoram cores de técnicas anteriores', async () => {
    const onPrice = vi.fn();
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={onPrice} />);

    // 1. Tech B (Cobra cor) -> emite 2 cores
    fireEvent.click(screen.getByText('Transfer Digital'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    // 2. Troca para Tech A (NÃO cobra cor)
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Silk 1 cor'),
    );

    // 3. Verifica initial-colors vazio e preço base
    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-initial-colors', '');
    await waitFor(() => {
      expect(onPrice).toHaveBeenLastCalledWith(
        expect.any(String),
        'tech-A',
        expect.objectContaining({ total_cobrado: 200 }),
        expect.any(Object),
      );
    });
  });

  it('restaura totalPrice corretamente do sessionStorage ao sair e voltar', async () => {
    const productId = 'p999';
    const onPrice = vi.fn();

    // 1. Setup e salva
    const { unmount } = render(
      <LocationPanel
        location={location}
        quantity={100}
        productId={productId}
        onPriceCalculated={onPrice}
      />,
    );
    fireEvent.click(screen.getByText('Transfer Digital'));

    // Simula alteração de dimensões/cores via componente (emite evento)
    // O emit-dims emite: width 7, height 4, colors 2
    fireEvent.click(screen.getByTestId('emit-dims'));

    // O rascunho é persistido em handleDimensionsChange.
    // Vamos verificar se foi escrito no sessionStorage.
    const key = `qb:loc-draft:${productId}:LADO-A`;
    await waitFor(() => {
      const raw = sessionStorage.getItem(key);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).colors).toBe(2);
    });
    unmount();

    // 2. Volta e restaura
    vi.clearAllMocks();
    render(
      <LocationPanel
        location={location}
        quantity={100}
        productId={productId}
        onPriceCalculated={onPrice}
      />,
    );

    // O rascunho deve ter salvo colors: 2.
    // O mock recalcula o preço (600) logo no mount baseado na prop initialColors.
    await waitFor(() => {
      const panel = screen.getByTestId('config-panel');
      expect(panel).toHaveAttribute('data-initial-colors', '2');
      expect(panel).toHaveAttribute('data-initial-width', '7');
      expect(panel).toHaveAttribute('data-initial-height', '4');
    });

    expect(screen.getByTestId('total-price-display')).toHaveTextContent('600');
  });
});
