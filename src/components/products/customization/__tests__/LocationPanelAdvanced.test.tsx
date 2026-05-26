/**
 * LocationPanel — Avançado: Clamp, Acessibilidade e Estabilidade
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { LocationPanel } from '../LocationPanel';
import type {
  GravacaoLocation,
  TechniqueOption,
  CustomizationPriceResponseV6,
} from '@/types/customization';

// Mock leve do ConfigurationPanelV6
vi.mock('../ConfigurationPanelV6', () => ({
  ConfigurationPanelV6: (props: {
    technique: TechniqueOption;
    initialWidth?: number;
    initialHeight?: number;
    initialColors?: number;
    onPriceCalculated?: (tid: string, p: CustomizationPriceResponseV6 | null) => void;
    onDimensionsChange?: (d: { width?: number; height?: number; colors?: number }) => void;
  }) => {
    // Simula cálculo de preço baseado na técnica
    const mockPrice: CustomizationPriceResponseV6 = {
      success: true,
      preco_unitario: props.technique.technique_id === 'tech-A' ? 1.5 : 2.5,
      setup_total: 50,
      total_cobrado: 200,
    };

    return (
      <div
        data-testid="config-panel"
        data-technique-id={props.technique.technique_id}
        data-initial-width={props.initialWidth ?? ''}
        data-initial-height={props.initialHeight ?? ''}
        data-initial-colors={props.initialColors ?? ''}
      >
        <div data-testid="mock-price-value">{mockPrice.preco_unitario}</div>
        <button
          type="button"
          data-testid="emit-dims"
          onClick={() => props.onDimensionsChange?.({ width: 7, height: 4, colors: 2 })}
        >
          emit
        </button>
        <button
          type="button"
          data-testid="emit-many-colors"
          onClick={() => props.onDimensionsChange?.({ width: 2, height: 2, colors: 10 })}
        >
          emit-many-colors
        </button>
      </div>
    );
  },
}));

// Sonner toast — silencia em ambiente de teste
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeTechnique(over: Partial<TechniqueOption> = {}): TechniqueOption {
  return {
    technique_id: 'tech-1',
    codigo_tabela: 'SILK-01',
    tecnica_nome: 'Silk 1 cor',
    grupo_tecnica: 'SERIGRAFIA',
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
  usa_dimensao: true,
  efetiva_largura_max: 10,
  efetiva_altura_max: 10,
});
const techB = makeTechnique({
  technique_id: 'tech-B',
  tecnica_nome: 'Transfer Digital',
  grupo_tecnica: 'TRANSFER',
  cobra_por_cor: true,
  max_cores: 4,
  efetiva_largura_max: 10,
  efetiva_altura_max: 10,
});
const techSmall = makeTechnique({
  technique_id: 'tech-small',
  tecnica_nome: 'Laser pequeno',
  efetiva_largura_max: 5,
  efetiva_altura_max: 3,
  usa_dimensao: true,
});
const techNoColor = makeTechnique({
  technique_id: 'tech-no-color',
  tecnica_nome: 'Gravação especial',
  cobra_por_cor: false,
  max_cores: 1,
});

const location: GravacaoLocation = {
  location_code: 'LADO-A',
  location_name: 'Lado A',
  location_order: 1,
  options: [techA, techB, techSmall, techNoColor],
};

describe('LocationPanel — Avançado: Clamp, Acessibilidade e Estabilidade', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('mostra aviso (clamp notice) ao trocar para técnica que reduz as dimensões digitadas', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Laser pequeno'),
    );

    const notice = screen.getByTestId('clamp-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(/dimensões \(Largura, Altura\) foram ajustadas/i);
  });

  it('trocas múltiplas preservam os valores mais recentes e recalcula o preço', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims')); // 7x4

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );

    let panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-initial-width', '7');

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Laser pequeno'),
    );

    panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-initial-width', '5');
    expect(panel).toHaveAttribute('data-initial-height', '3');
  });

  it('limpa cores ao trocar para técnica com cobra_por_cor=false', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText('Transfer Digital'));
    fireEvent.click(screen.getByTestId('emit-many-colors'));

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Gravação especial'),
    );

    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-initial-colors', '');
  });

  it('gerencia o foco corretamente', () => {
    const { container } = render(
      <LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('Silk 1 cor'));
    const changeBtn = screen.getByTestId('customization-change-technique');

    fireEvent.click(changeBtn);
    const firstCard = container.querySelector("[role='radio'],[role='button']");
    expect(document.activeElement).toBe(firstCard);

    const picker = screen.getByTestId('customization-technique-picker');
    fireEvent.click(within(picker).getByText('Transfer Digital'));

    expect(screen.queryByTestId('customization-technique-picker')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(changeBtn);
  });

  it('anuncia via aria-live as transições', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);
    const announcer = screen.getByTestId('customization-aria-announcer');

    fireEvent.click(screen.getByText('Silk 1 cor'));
    expect(announcer).toHaveTextContent('Técnica selecionada: Silk 1 cor.');

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    expect(announcer).toHaveTextContent('Seletor de técnicas aberto. Técnica atual: Silk 1 cor.');
  });

  it('garante que técnica e dimensões persistam no sessionStorage', () => {
    const productId = 'p123';
    const { unmount } = render(
      <LocationPanel
        location={location}
        quantity={100}
        productId={productId}
        onPriceCalculated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    unmount();

    render(
      <LocationPanel
        location={location}
        quantity={100}
        productId={productId}
        onPriceCalculated={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-technique-id', 'tech-A');
    expect(panel).toHaveAttribute('data-initial-width', '7');
  });

  it('valida que o preço muda ao trocar de técnica', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText('Silk 1 cor'));
    expect(screen.getByTestId('mock-price-value')).toHaveTextContent('1.5');

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );

    expect(screen.getByTestId('mock-price-value')).toHaveTextContent('2.5');
  });

  it('clampa cores em 1 ao trocar para técnica com max_cores=1', () => {
    const techCobra1 = makeTechnique({
      technique_id: 'tech-cobra-1',
      tecnica_nome: 'Tampo 1 cor',
      cobra_por_cor: true,
      max_cores: 1,
    });
    const loc: GravacaoLocation = { ...location, options: [...location.options, techCobra1] };

    render(<LocationPanel location={loc} quantity={100} onPriceCalculated={vi.fn()} />);

    // 1. Tech B (permite cores) -> emite 10 (clampa p/ 4 no config do mock)
    fireEvent.click(screen.getByText('Transfer Digital'));
    fireEvent.click(screen.getByTestId('emit-many-colors'));

    // 2. Troca p/ Tampo 1 cor
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Tampo 1 cor'),
    );

    expect(screen.getByTestId('config-panel')).toHaveAttribute('data-initial-colors', '1');
  });

  it('garante consistência em trocas cíclicas (A->B->A)', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );
    expect(screen.getByTestId('config-panel')).toHaveAttribute('data-initial-width', '7');

    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Silk 1 cor'),
    );
    expect(screen.getByTestId('config-panel')).toHaveAttribute('data-initial-width', '7');
  });
});
